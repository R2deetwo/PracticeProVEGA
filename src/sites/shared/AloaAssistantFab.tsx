import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AloaIcon } from '../../constants';
import { Z_CLASS } from '../../overlays/constants';
import { getAssistantName } from '../../utils/assistantIdentity';

/**
 * AloaAssistantFab — the website assistant (bank-style FAB + panel).
 *
 * 2026-11-22 ROLE SPLIT (owner spec, "Landing-Page ALOA — Deep Product
 * Specialist"):
 *   VEGA → ALOA is strictly an expert PRODUCT GUIDE & ONBOARDING
 *   SPECIALIST for Vega: features explained with concrete law-firm
 *   examples, plans/pricing, workspace setup, inviting staff. It does
 *   NOT answer substantive legal questions, gives no legal advice or
 *   education, and NEVER invites visitors to contact PracticePro for
 *   legal help (PracticePro is a B2B software provider, not a law
 *   firm). Legal questions get the approved 2–3 sentence boundary reply
 *   + the Official Legal Directories card (NBA resources only — RPC
 *   Rule 39: no touting, no endorsement, no "vetted lawyers").
 *   ATRIUM → ARIA keeps the everyday property-guide register (the
 *   rework is a Vega-only directive).
 *
 * WHAT THIS IS (owner direction, 2026-11-16):
 *   "I wanted it like how the banks have it: it's there, but it doesn't
 *    do anything until you start scrolling or doing something, and then
 *    it asks you whether you need assistance — and you can go in there
 *    and ask your question."
 *
 * OWNER REFINEMENTS (same day, post-launch review):
 *   1. PRODUCT PAGES ONLY. The assistant is a VEGA thing (ALOA) and an
 *      ATRIUM thing (ARIA) — "it should not be on the PracticePro page.
 *      It's a Vega thing." The hub no longer mounts this component; the
 *      LandingProduct type is narrowed to 'vega' | 'atrium' so an
 *      accidental re-mount fails to compile.
 *   2. OWNERSHIP COPY. ALOA introduces itself as VEGA'S product guide
 *      (not "PracticePro's"); ARIA as ATRIUM'S property guide.
 *   3. TOPICS COLLAPSE. Once the visitor picks a topic or asks a
 *      question, the chip cloud collapses to a toggle so the ANSWER gets
 *      the space (owner: "you would expect it to sort of drop down…
 *      it's being blocked up").
 *   4. USEFUL REPLIES. Vega topic answers are product walkthroughs with
 *      concrete examples (the catalogue doubles as the AI grounding
 *      reference); Atrium keeps its structured property mini-guides.
 *   5. NO PREMATURE FUNNEL. Per-reply "send this to our team" CTAs are
 *      gone — "funneling… it's a bit too early" for the lawyer
 *      marketplace. One subtle "Ask our team" link rides the footer.
 *      Product chips keep the trial CTA — those visitors ARE the customers.
 *   6. PILL EMERGES FROM THE BUTTON (owner review round 2): the nudge
 *      pill is docked INSIDE the FAB row — not a floating card — and
 *      animates OUT of the icon button on a transform-origin:right
 *      timeline, then folds BACK INTO it when answered. "The pill should
 *      animate out of the button so that you know that it's the button
 *      you're supposed to click. We want to get you associated with
 *      clicking that button."
 *   7. QUESTIONS GET ANSWERED, NOT FUNNELLED (owner review round 2):
 *      a free-text question is matched against the topic catalogue and
 *      ANSWERED in the panel; the message drawer opens ONLY when the
 *      visitor clicks a link themselves — never an auto-jump, and never
 *      a purchase funnel. For VEGA (2026-11-22): out-of-scope (legal)
 *      questions get the product-boundary reply + the Official Legal
 *      Directories card (NBA resources only — never "reach out to us
 *      for legal help"); for ATRIUM they keep the honest
 *      qualified-professional boundary reply.
 *
 * LIVE AI ENGINE (owner direction, 2026-11-18: "we cannot have something
 *   that is not smart or answers only preset answers"; 2026-11-20: "I
 *   need ALOA that works in the app to work on the landing page as a
 *   preview for visitors — not the canned answers"):
 *   Every question — free text AND topic chips — is answered by the real
 *   AI through the PUBLIC rate-limited /ai/landing-chat action on Convex
 *   (CORS allow-list + per-IP hourly/daily limits + global daily cap;
 *   see convex/landingChat.ts), in the SAME CONVERSATIONAL MARKDOWN
 *   VOICE as the in-app ALOA — free-flowing prose with a bold takeaway,
 *   a compact list only when steps genuinely help — rendered rich here
 *   and revealed with a streaming-style typewriter so the panel feels
 *   like the product's assistant, not a form. The matched topic's
 *   owner-approved copy rides along as background REFERENCE (facts must
 *   stay consistent; wording must NOT be copied — see the server prompt)
 *   so answers stay reliable without looking canned. The deterministic
 *   catalogue below is now the FALLBACK: if the AI surface is unreachable
 *   (key rotation, network, timeout) the panel answers exactly as it did
 *   before — it never regresses to silence. A failed call falls back for
 *   THAT QUESTION ONLY and starts a 60s cooldown (no hammering a dead
 *   surface); the next question retries the engine. Rate-limit replies
 *   are shown HONESTLY, never impersonated by the catalogue (owner bug
 *   report 2026-11-20: two hiccups used to silently disable the AI for
 *   the whole visit, which read as "still a canned dispenser").
 *
 * NAMING (assistantIdentity.ts is the single source of truth):
 *   vega → ALOA (legal guide), atrium → ARIA (property guide).
 */

export type LandingProduct = 'vega' | 'atrium';

/** OpenContactOptions — the extended drawer-open signature. Every
 *  pre-existing caller passes a plain source string, so the second
 *  argument is optional and fully backward-compatible. */
export interface OpenContactOptions {
    prefill?: string;
    variant?: 'sales' | 'assist';
}

interface AssistantTopic {
    id: string;
    chip: string;
    /** Intro sentence of the reply. */
    reply: string;
    /** Numbered plain-language steps — the substance of the guide. */
    steps?: string[];
    /** Caution line, rendered as a tinted callout. */
    note?: string;
    /** Show the "start free trial" CTA (product-pitch topics). */
    signupCta?: boolean;
    /** Lowercased match terms for the free-text question router.
     *  Multi-word phrases score 2, single words 1 (see matchTopic). */
    keywords?: string[];
}

const NUDGE_SESSION_KEY = 'practicepro_landing_nudge_dismissed_v1';
const OPENED_ONCE_KEY = 'practicepro_landing_aloa_opened_v1';
const NUDGE_AUTO_HIDE_MS = 12000;
/** How long the fold-back-into-the-button animation runs before the
 *  pill unmounts (owner review round 2 — see aloa-nudge-retract). */
const NUDGE_RETRACT_MS = 210;
const NUDGE_DWELL_MS = 15000;
const NUDGE_SCROLL_PX = 220;

/** Per-surface brand tokens for the FAB / pill / panel accents.
 *  Task 97 (product parity): the widget's ACTION accents — the send
 *  button, the visitor's chat bubble, the numbered-step avatar, the
 *  trial CTA and the header wash — are product tokens now. They had
 *  leaked the UNSCOPED primary ramp (corporate green) onto /vega's
 *  widget while the FAB/avatar/chips were already Vega blue — a green
 *  send button and green user bubbles inside a blue-branded panel.
 *  Vega wears the vega-gilt register; Atrium keeps its emerald. */
const BRAND: Record<LandingProduct, {
    fab: string; pill: string; chipAccent: string; avatar: string;
    wash: string; bubble: string; step: string; send: string; cta: string;
}> = {
    vega: {
        fab: 'bg-[#1E3A8A] hover:bg-[#1E40AF] hover:shadow-[rgb(30_58_138/0.35)]',
        pill: 'text-[#1E3A8A]',
        chipAccent: 'text-[#1E3A8A] border-slate-300 hover:border-[#1E3A8A] hover:bg-blue-50',
        avatar: 'bg-[#1E3A8A]',
        wash: 'from-[#EFF6FF] to-white',
        bubble: 'bg-[#1E3A8A]',
        step: 'bg-[#1E3A8A]',
        send: 'bg-[#1E3A8A] hover:bg-[#1E40AF]',
        cta: 'bg-[#1E3A8A] hover:bg-[#1E40AF]',
    },
    atrium: {
        fab: 'bg-atrium-emerald hover:brightness-110',
        pill: 'text-emerald-700',
        chipAccent: 'text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
        avatar: 'bg-atrium-emerald',
        wash: 'from-emerald-50 to-white',
        bubble: 'bg-atrium-emerald',
        step: 'bg-atrium-emerald',
        send: 'bg-atrium-emerald hover:brightness-110',
        cta: 'bg-atrium-emerald hover:brightness-110',
    },
};

// ── Live AI engine (owner direction 2026-11-18) ──────────────────────────
// Public, rate-limited Convex action — see convex/landingChat.ts. The
// catalogue below becomes the grounding reference + fallback, never the
// primary engine.

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string) || 'https://gregarious-malamute-537.convex.cloud';

/** HTTP actions are served on the deployment's .convex.site URL — .convex.cloud
 *  hosts only the client API (queries/mutations over WebSocket). Calling
 *  /ai/landing-chat on .convex.cloud returns 404 (verified live 2026-11-18),
 *  which would silently downgrade every visitor to the catalogue fallback.
 *  Same pattern as geminiService.ts /ai/stream. */
const CONVEX_HTTP_URL = CONVEX_URL.replace('.convex.cloud', '.convex.site');

interface LandingAiAnswer {
    /** Conversational markdown — the in-app ALOA voice. */
    text: string;
    /** True when the engine flagged the reply as a legal-question decline
 *     (the [[OFFICIAL_DIRECTORIES]] marker) — the panel renders the
 *     Official Legal Directories card under the reply. */
    directoriesAction?: boolean;
}

interface LandingAiHistoryItem {
    role: 'user' | 'assistant';
    text: string;
}

/** Client-side budget — the server gives itself 20s, but a visitor
 *  should never wait that long for a panel answer; the catalogue
 *  fallback answers instantly when this fires. (2026-11-20: was 9s,
 *  which raced real answers on slow mobile networks — measured live at
 *  3.5–5s on a good line; a mobile first-connection can double that.) */
const LANDING_AI_TIMEOUT_MS = 14000;

/** Ask the live engine. Returns:
 *  - an answer (conversational markdown) when the engine replied — the
 *    NEW {text} shape is preferred, and the legacy {intro, steps, note}
 *    shape is flattened client-side so a half-deployed pair can never
 *    break the panel;
 *  - 'rate_limited' when the visitor hit the per-IP fence — the caller
 *    shows an honest “you’ve reached the limit” message, NEVER a canned
 *    card (a canned card after real answers reads as the AI breaking —
 *    owner bug report 2026-11-20);
 *  - null on any other failure (network, timeout, key unavailable,
 *    malformed payload) — callers fall back to the deterministic
 *    catalogue for that question, so the panel never breaks. */
async function askLandingAI(payload: {
    question: string;
    product: LandingProduct;
    history: LandingAiHistoryItem[];
    reference?: { chip: string; reply: string; steps?: string[]; note?: string };
    /** Vega audience toggle: 'non_lawyer' reinforces the product-only
 *     boundary server-side. Omitted for atrium (no toggle there). */
    userRole?: 'lawyer' | 'non_lawyer';
}): Promise<LandingAiAnswer | 'rate_limited' | null> {
    try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), LANDING_AI_TIMEOUT_MS);
        let res: Response;
        try {
            res = await fetch(`${CONVEX_HTTP_URL}/ai/landing-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        } finally {
            window.clearTimeout(timer);
        }
        if (res.status === 429) return 'rate_limited';
        if (!res.ok) return null;
        const data = await res.json();
        const a = data?.answer;
        const directoriesAction = data?.action === 'official_directories' || a?.action === 'official_directories';
        // New shape: free conversational markdown text.
        if (typeof a?.text === 'string' && a.text.trim()) {
            return { text: a.text.trim().slice(0, 2000), directoriesAction };
        }
        // Legacy shape (intro/steps/note): flatten to markdown so the
        // panel renders one consistent experience either way.
        if (a && typeof a.intro === 'string' && a.intro.trim()) {
            const parts: string[] = [a.intro.trim()];
            const steps = Array.isArray(a.steps)
                ? a.steps.filter((s: unknown): s is string => typeof s === 'string' && !!s.trim()).slice(0, 6)
                : [];
            if (steps.length) parts.push(steps.map((s: string, i: number) => `${i + 1}. ${s.trim()}`).join('\n'));
            if (typeof a.note === 'string' && a.note.trim()) parts.push(`**Note:** ${a.note.trim()}`);
            return { text: parts.join('\n\n').slice(0, 2000), directoriesAction };
        }
        return null;
    } catch {
        return null;
    }
}

/** Minimal, ESCAPE-FIRST markdown renderer for live AI answers —
 *  paragraphs, **bold**, *italic*, `code`, https links and compact
 *  ul/ol lists. Every character is HTML-escaped BEFORE any tag is
 *  introduced, so model output can never inject markup. Deliberately
 *  NOT the in-app parseAloaMarkdown: that one carries interactive
 *  in-product affordances (task pills, “Draft in DraftPro” hovers) that
 *  would be dead weight + confusing noise on a public marketing page. */
function renderLandingMarkdown(md: string): string {
    const esc = (s: string) => s
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (s: string) => esc(s)
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-200/70 text-[0.85em]">$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-semibold underline underline-offset-2 hover:opacity-80">$1</a>');
    const blocks = md.replace(/\r/g, '').split(/\n\s*\n/);
    const out: string[] = [];
    for (const raw of blocks) {
        const block = raw.trim();
        if (!block) continue;
        const lines = block.split('\n').map((l) => l.trim());
        const isOl = lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l));
        const isUl = lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l));
        if (isOl || isUl) {
            const items = lines.map((l) => inline(l.replace(isOl ? /^\d+[.)]\s+/ : /^[-*•]\s+/, '')));
            const tag = isOl ? 'ol' : 'ul';
            const cls = isOl ? 'list-decimal' : 'list-disc';
            out.push(`<${tag} class="${cls} list-inside space-y-1 my-1.5 pl-1">${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
        } else {
            out.push(`<p class="my-1.5 first:mt-0 last:mb-0">${lines.map(inline).join('<br/>')}</p>`);
        }
    }
    return out.join('');
}

interface Bubble {
    role: 'aloa' | 'you';
    text: string;
    steps?: string[];
    note?: string;
    /** True when this answer came from the LIVE AI engine (vs the
     * deterministic catalogue fallback). Rendered as a subtle pulsing
     * "live AI" tag so a regression to canned answers is VISIBLE at a
     * glance (owner bug report 2026-11-19: "ALOA on the landing page is
     * still giving canned answers"). */
    live?: boolean;
    /** Render `text` as conversational markdown (the in-app ALOA voice)
     *  instead of the intro/steps/note card. Set on every live answer. */
    markdown?: boolean;
    /** Professional-conduct-safe boundary line ("general information,
     *  not legal advice — speak with a qualified lawyer"). */
    lawyerNote?: string;
    /** Vega only: render the Official Legal Directories action card —
     *  set on legal-question declines (the engine's
     *  [[OFFICIAL_DIRECTORIES]] marker) and the offline boundary reply. */
    directoriesAction?: boolean;
    /** Topic chips to offer as follow-ups (matched by chip label). */
    suggestions?: string[];
    /** When set, renders the opt-in "send this to our team" link with
     *  this text pre-typed — the visitor clicks it themselves; nothing
     *  auto-opens. */
    teamPrefill?: string;
}

/**
 * Topic catalogue. 2026-11-22 split:
 *   VEGA — product prompts with concrete law-firm scenarios (owner
 *   spec: "suggested product prompts with concrete scenarios"). Each
 *   answer is a product walkthrough; the copy doubles as the AI
 *   grounding reference. No legal-advice topics, no consumer legal
 *   guidance — those questions now route to the product-boundary reply
 *   + the Official Legal Directories card.
 *   ATRIUM — the everyday property mini-guides (unchanged register).
 */
function buildTopics(product: LandingProduct, name: string): AssistantTopic[] {
    // The one consumer-legal topic ATRIUM still carries (landlord/tenant
    // basics). The other former consumer-legal topics (court letters,
    // documents, CAC) retired with the 2026-11-22 Vega product-specialist
    // rework — Vega's chip cloud is product prompts only.
    const landlordTenant: AssistantTopic = {
        id: 'landlord_tenant',
        chip: 'Landlord or tenant problem',
        reply: 'These disputes move in steps — and the steps matter as much as who is \u201Cright\u201D.',
        steps: [
            'Put your position in writing. A dated letter or message creates a record; phone calls do not.',
            'Keep everything: rent receipts, bank transfers, the agreement, messages, photos of the property.',
            'Know the notice rules. In Lagos (Tenancy Law 2011), a notice to quit must match the tenancy period: 1 week for a weekly tenancy, 1 month for monthly, 3 months for quarterly, 6 months for yearly. A notice that understates the period is invalid.',
            'In Lagos a landlord cannot recover possession without a court order — even after the notice expires, self-help eviction is unlawful. Other states follow a similar pattern; confirm the rule where the property is.',
        ],
        note: 'Never resort to self-help — changing locks, removing belongings, cutting power. Courts treat that seriously even when the rent is genuinely owed.',
        keywords: ['landlord', 'tenant', 'rent', 'eviction', 'evict', 'quit notice', 'notice to quit', 'tenancy', 'lease', 'deposit', 'premises', 'occupancy'],
    };

    const propertyTopics: AssistantTopic[] = [
        {
            id: 'service_charge',
            chip: 'Service charge dispute',
            reply: 'A service charge should be accountable — you are entitled to know what you are paying for.',
            steps: [
                'Ask for the breakdown in writing: what the charge covers, how it was computed, and what was actually delivered.',
                'Compare it with your tenancy agreement — a charge can only lawfully demand what the agreement provides for.',
                'Keep your receipts and previous statements so you can spot jumps year on year.',
                'Address your questions in writing to the estate manager and keep the trail — a specific, dated question is far harder to ignore than a verbal complaint.',
            ],
            note: 'Withholding the entire charge while disputing part of it can backfire — the undisputed part remains owed. Disputing properly, in writing, is the leverage that works.',
            keywords: ['service charge', 'service fee', 'levy', 'dues', 'estate bill', 'facility fee'],
        },
        {
            id: 'maintenance',
            chip: 'Maintenance not being done',
            reply: 'A maintenance issue becomes enforceable when it becomes a documented one.',
            steps: [
                'Report it in writing — or through the residents portal if your estate has one — and keep the ticket or reference number.',
                'Add photos and dates. \u201CThey never fix anything\u201D is a feeling; a dated photo trail is a complaint.',
                'Give a reasonable time, then follow up in writing, addressed to the estate manager and copied to the landlord where relevant.',
                'If it still drags on, a clear written statement of the impact — and what you will ask for if it continues — is the next rung before any formal demand.',
            ],
            keywords: ['maintenance', 'not being done', 'not being fixed', 'not working', 'repair', 'fix', 'broken', 'leaking', 'leak', 'plumbing', 'generator', 'water supply', 'electricity', 'cleaning', 'waste'],
        },
        {
            id: 'tenancy_agreement',
            chip: 'Tenancy agreement review',
            reply: 'A tenancy agreement is the document you will lean on when things go wrong — make sure it can hold you up.',
            steps: [
                'Cover the essentials: the parties\u2019 full names, the premises, the rent and when it is payable, the duration, and how it renews or ends.',
                'Check the notice provisions against the law — in Lagos, notice-to-quit periods are fixed by the Tenancy Law 2011 (1 week for weekly, 1 month for monthly, 3 months for quarterly, 6 months for yearly tenancies), and a notice that understates the period is invalid.',
                'Inventory the condition of the premises at handover — photos protect both sides when the deposit is disputed later.',
                'Get the agreement stamped and keep a signed copy — an unstamped document can face evidential problems exactly when you need it most.',
            ],
            note: 'Read the service charge and utility clauses carefully — that is where most estate disputes actually start.',
            keywords: ['tenancy agreement', 'agreement review', 'review my agreement', 'renew', 'renewal'],
        },
    ];

    const lawyerFirm: AssistantTopic = {
        id: 'lawyer_firm',
        chip: "I'm a lawyer / I run a firm",
        reply:
            `Then you are in the right place — Vega is the practice side of PracticePro: matters and cause list, court-rule-aware document drafting, billing and trust accounting, client portals, and ${name} as an in-app legal assistant. The trial is free and you can be running in minutes.`,
        signupCta: true,
        keywords: ['lawyer', 'law firm', 'solicitor', 'barrister', 'advocate', 'attorney', 'legal practice', 'i run a firm', 'practice'],
    };

    // ── VEGA PRODUCT PROMPTS (2026-11-22 owner spec) ─────────────────
    // Concrete-scenario product prompts for the lawyer-first default
    // state. Answers are product walkthroughs with realistic law-firm
    // examples; prices come from src/constants/tiers.ts (the single
    // source of truth — never edit them here without touching that).
    const vegaProductTopics: AssistantTopic[] = [
        {
            id: 'matters_example',
            chip: 'Show me how Vega tracks court matters',
            reply: 'Every case lives as a Matter — one file with the parties, counsel, court dates, filing deadlines and documents, that the whole firm works from.',
            steps: [
                'A litigator opens the matter for a Lagos High Court suit and the next adjourned date is the first thing on the file — with hearing reminders firing 7, 3 and 1 days before, delivered to assigned counsel on WhatsApp.',
                'Parties, opposing counsel and the presiding judge sit on the matter, so an associate picking up the file sees the whole picture without a handover meeting.',
                'Filing deadlines ride the same timeline as hearings under the matter’s Civil Procedure Rules — the diary keeps itself instead of depending on one person’s memory.',
                'Notes, documents and bills attach to the matter — the file IS the workspace.',
            ],
            keywords: ['matter', 'matters', 'case', 'court', 'track', 'tracking', 'deadline', 'adjournment', 'hearing', 'cause list', 'litigation', 'diary', 'reminder', 'case management'],
        },
        {
            id: 'vox_draftpro',
            chip: 'How do Vox and DraftPro work together?',
            reply: 'Vox captures what you say; DraftPro turns it into the document the matter needs — one chain from courtroom to draft.',
            steps: [
                'Walking out of court, you dictate into Vox — “adjourned to the 14th, counsel to file written addresses” — and it lands as a structured note on the matter, with the date picked up as a task.',
                'Back at the desk, DraftPro drafts the follow-up — the letter of notification or the written addresses — from the matter’s own details and your templates, formatted to Nigerian court practice.',
                'The draft files back onto the matter for review. Capture, organise, draft — one chain, no retyping.',
            ],
            keywords: ['vox', 'draftpro', 'voice', 'dictate', 'dictation', 'draft', 'drafting', 'template', 'document', 'speech', 'recording', 'transcribe'],
        },
        {
            id: 'plans_onboarding',
            chip: 'Walk me through Vega plans & onboarding',
            reply: 'Four plans, one free tier to start, and setup a firm can finish in an afternoon.',
            steps: [
                'Free — ₦0: 1 user, 10 active matters, legal billing & ledger record-keeping, and the standard DraftPro contract analyzer. No card needed.',
                'Growth — ₦45,000/month (₦432,000/year): 5 users, unlimited matters, court rules intelligence, Client Portal for up to 20 clients, ALOA copilot, automated retainer billing and court date reminders.',
                'Pro — ₦80,000/month (₦768,000/year): everything in Growth, plus unlimited users, Vox voice capture and the hybrid Legal Pad, uncapped Client Portal, priority ALOA copilot, advanced billing analytics and the Billing Monitor.',
                'Enterprise — custom: the regulatory cross-referencing engine, custom court document archives, and sales-assisted onboarding.',
                'Getting started: create the firm workspace, invite your associates and staff, and matters can start the same day.',
            ],
            signupCta: true,
            keywords: ['plan', 'plans', 'pricing', 'price', 'cost', 'tier', 'tiers', 'onboarding', 'onboard', 'setup', 'invite', 'team', 'staff', 'trial', 'free', 'subscription', 'how much', 'naira'],
        },
        {
            id: 'trust_accounts',
            chip: 'Client funds, compliance & data privacy',
            reply: 'Client money and office money never mix — the segregation is the default workflow, not a discipline.',
            steps: [
                'Client accounts are segregated from the office account, aligned with Nigerian trust-accounting standards (RPC Rule 23) — a corporate lawyer keeping a client’s completion funds apart from the firm’s professional fees is working the standard flow, not being careful.',
                'Ledgers record every movement against the right matter and the right account, with retainer billing, auto-invoicing and partner-level monitor controls on top.',
                'NDPA 2023-aligned safeguards — matter records stay inside permissioned workflows, encrypted in transit and at rest.',
            ],
            keywords: ['client account', 'trust', 'trust account', 'accounting', 'ledger', 'funds', 'money', 'compliance', 'rule 23', 'ndpa', 'privacy', 'data protection', 'billing', 'safe', 'security'],
        },
        lawyerFirm,
    ];

    const estateManager: AssistantTopic = {
        id: 'estate_manager',
        chip: 'I manage property / an estate',
        reply:
            `Atrium is the property side of PracticePro — rent rolls and tenancy ledgers, service-charge monitoring, maintenance queues, resident portals and WhatsApp automation, with ${name} keeping an eye on the numbers. The trial is free.`,
        signupCta: true,
        keywords: ['estate manager', 'manage property', 'property manager', 'caretaker', 'facility manager', 'estate agent', 'agent'],
    };

    if (product === 'atrium') {
        return [
            landlordTenant,
            propertyTopics[0], // service charge
            propertyTopics[1], // maintenance
            propertyTopics[2], // tenancy agreement review
            estateManager,
            lawyerFirm,
        ];
    }
    // Vega — the lawyer-first product prompts (2026-11-22): concrete
    // scenarios, zero consumer-legal guidance in the chip cloud.
    return vegaProductTopics;
}

const AloaAssistantFab: React.FC<{
    product: LandingProduct;
    onContactSales: (source: string, opts?: OpenContactOptions) => void;
    onSignup?: () => void;
    /** Vega only: opens the Official Legal Directories drawer (triggered
 *     by the legal-question action pill and the non-lawyer notice link). */
    onOpenDirectories?: () => void;
}> = ({ product, onContactSales, onSignup, onOpenDirectories }) => {
    const name = getAssistantName(product === 'atrium');
    const brand = BRAND[product];
    const topics = useMemo(() => buildTopics(product, name), [product, name]);
    const isProperty = product === 'atrium';

    const [isPanelOpen, setPanelOpen] = useState(false);
    // Owner review round 2: the pill no longer floats on its own — it is
    // docked INSIDE the FAB row and animates out of / back into the icon
    // button. 'out' plays aloa-nudge-emerge, 'retract' plays
    // aloa-nudge-retract (the fold-back-into-the-button beat) before
    // unmounting. See index.css.
    const [nudgePhase, setNudgePhase] = useState<'hidden' | 'out' | 'retract'>('hidden');
    const [bubbles, setBubbles] = useState<Bubble[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [question, setQuestion] = useState('');
    const [questionError, setQuestionError] = useState<string | null>(null);
    const [usedTopics, setUsedTopics] = useState<Set<string>>(new Set());
    // Owner review: once the visitor picks a topic or asks a question, the
    // chip cloud collapses to a toggle so the ANSWER gets the space.
    // Task 97 (owner: "I don't want the common questions drawer to be
    // opened up by default"): the drawer starts COLLAPSED — the visitor
    // opens the chip cloud themselves via the toggle.
    const [topicsOpen, setTopicsOpen] = useState(false);
    // ── Audience toggle (2026-11-22 owner spec, VEGA ONLY): "I am a
    //    Lawyer" (default — full practitioner experience) vs "I am not
    //    a Lawyer" (reveals the product-only notice + the NBA directory
    //    link, and passes userRole:'non_lawyer' to the engine so the
    //    boundary is reinforced on every reply). Atrium has no toggle.
    const [audience, setAudience] = useState<'lawyer' | 'non_lawyer'>('lawyer');

    const panelRef = useRef<HTMLDivElement>(null);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const thinkTimer = useRef<number | null>(null);
    const handoffTimer = useRef<number | null>(null);
    const nudgeTimers = useRef<number[]>([]);
    // Live-AI session state: a failed call falls back for THAT question
    // only, with a 60s cooldown so the panel never hammers a dead surface.
    // There is deliberately NO permanent session disable — two hiccups
    // (a rate limit, a slow mobile network) used to silently downgrade the
    // whole visit to the catalogue, which read as “still a canned
    // dispenser” (owner bug report 2026-11-20).
    const liveAiCooldownUntilRef = useRef(0);

    // ── Streaming-style reveal (owner direction 2026-11-20: the landing
    //    ALOA must feel like the in-app one). Live answers arrive whole
    //    (the anonymous endpoint is a single POST, not SSE), so the panel
    //    reveals them with a typewriter: chunks land every ~18ms and the
    //    full answer is visible within ~2s regardless of length — the
    //    perceived cadence of token streaming without a streaming
    //    transport. revealIdx = index of the bubble currently revealing;
    //    -1 = idle. */
    const [revealIdx, setRevealIdx] = useState(-1);
    const [revealChars, setRevealChars] = useState(0);
    const revealTimer = useRef<number | null>(null);

    const introBubble = useMemo<Bubble>(
        () => ({
            role: 'aloa',
            // Owner review: ALOA is VEGA'S tool, ARIA is ATRIUM'S — never
            // "PracticePro's guide". 2026-11-22: Vega's ALOA is the
            // PRODUCT guide (lawyer-first); ARIA keeps the everyday
            // property-guide register.
            text: isProperty
                ? `Hi, I'm ${name} — Atrium's property guide. You don't need to be a property professional to ask here. Tell me what's on your mind, or pick a topic below.`
                : `Hi, I'm ${name} — Vega's product guide. Ask me about features, workflows, plans, or getting your firm set up — or pick a prompt below.`,
        }),
        [name, isProperty],
    );

    // ── Panel lifecycle (declared before the nudge callbacks that use
    //    them — useCallback consts are not hoisted) ────────────────────
    const openPanel = useCallback(() => {
        setPanelOpen(true);
        try { localStorage.setItem(OPENED_ONCE_KEY, '1'); } catch { /* best-effort */ }
    }, []);

    const closePanel = useCallback(() => setPanelOpen(false), []);

    /** Fold the pill back INTO the button, then unmount it. The retract
     *  beat is the association the owner asked for: the pill visibly
     *  returns to the icon it emerged from. */
    const retractNudge = useCallback((silenceSession: boolean) => {
        setNudgePhase((phase) => (phase === 'out' ? 'retract' : phase));
        nudgeTimers.current.forEach((t) => window.clearTimeout(t));
        nudgeTimers.current = [];
        if (silenceSession) {
            try { sessionStorage.setItem(NUDGE_SESSION_KEY, '1'); } catch { /* best-effort */ }
        }
        // Let the retract animation land before unmounting.
        nudgeTimers.current.push(window.setTimeout(() => setNudgePhase('hidden'), NUDGE_RETRACT_MS));
    }, []);

    /** Ask-from-the-pill: retract first, THEN open — the visitor sees the
     *  pill fold into the button and the panel take its place, which is
     *  how they learn the button is the thing to click. */
    const askFromNudge = useCallback(() => {
        retractNudge(false);
        nudgeTimers.current.push(window.setTimeout(() => openPanel(), NUDGE_RETRACT_MS - 30));
    }, [retractNudge, openPanel]);

    // ── Proactive nudge (bank-style): scroll intent OR dwell, once ──────
    useEffect(() => {
        if (isPanelOpen || nudgePhase !== 'hidden') return;
        // Respect explicit "Maybe later" for the session, and anyone who
        // has already opened the panel (they know the bubble is there).
        try {
            if (sessionStorage.getItem(NUDGE_SESSION_KEY) === '1') return;
            if (localStorage.getItem(OPENED_ONCE_KEY) === '1') return;
        } catch { /* storage can be unavailable (private mode) — skip gating */ }

        let fired = false;
        const fire = () => {
            if (fired) return;
            fired = true;
            setNudgePhase('out');
            nudgeTimers.current.push(
                window.setTimeout(() => retractNudge(false), NUDGE_AUTO_HIDE_MS),
            );
        };
        // Scroll events do not bubble, but they ARE visible to a capture
        // listener on document — the sites scroll inside their own
        // h-[100dvh] container, so this catches every surface.
        const onScroll = (e: Event) => {
            const t = e.target as HTMLElement | Document;
            let top = 0;
            if (t === document || t === document.documentElement || t === document.body) {
                top = window.scrollY;
            } else if (t && typeof (t as HTMLElement).scrollTop === 'number') {
                top = (t as HTMLElement).scrollTop;
            }
            if (top > NUDGE_SCROLL_PX) fire();
        };
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        const dwell = window.setTimeout(fire, NUDGE_DWELL_MS);
        return () => {
            document.removeEventListener('scroll', onScroll, { capture: true } as AddEventListenerOptions);
            window.clearTimeout(dwell);
            nudgeTimers.current.forEach((t) => window.clearTimeout(t));
            nudgeTimers.current = [];
        };
    }, [isPanelOpen, nudgePhase, retractNudge]);

    // Clear the nudge the moment the panel opens.
    useEffect(() => {
        if (isPanelOpen) setNudgePhase('hidden');
    }, [isPanelOpen]);

    // While the panel is open, hide the first-visit cookie bar (scoped CSS
    // via body.practicepro-aloa-open — see index.css). The bar returns when
    // the panel closes; consent is never implied by asking a question.
    // Cleanup on unmount keeps the class from leaking onto the app shell.
    useEffect(() => {
        if (!isPanelOpen) return;
        document.body.classList.add('practicepro-aloa-open');
        return () => document.body.classList.remove('practicepro-aloa-open');
    }, [isPanelOpen]);

    useEffect(() => {
        if (!isPanelOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
        window.addEventListener('keydown', onKey);
        // Autofocus the composer on pointer-precise devices only — popping
        // the mobile keyboard uninvited is hostile on small screens.
        const media = window.matchMedia('(min-width: 768px)');
        if (media.matches) {
            const t = window.setTimeout(() => inputRef.current?.focus(), 250);
            return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(t); };
        }
        return () => window.removeEventListener('keydown', onKey);
    }, [isPanelOpen, closePanel]);

    // ── Scroll UX (2026-11-22 owner spec): the transcript ANCHORS, it
    //    does not PIN. Old bug: every reveal tick set scrollTop =
    //    scrollHeight, so a long answer yanked the viewport to the
    //    BOTTOM mid-read and the visitor had to scroll back up to the
    //    opening paragraph. New contract:
    //    1. On submit, ONE smooth scroll anchors the user's prompt near
    //       the TOP of the transcript viewport — ALOA's reply then grows
    //       downward below the fold without moving it.
    //    2. When the reply lands, one corrective re-anchor (skipped if
    //       the visitor has scrolled on their own since submitting).
    //    3. Continuous bottom-pinning during the typewriter reveal is
    //       GONE; instead a quiet "More below" pill appears when content
    //       overflows past the fold and the visitor has not scrolled.
    const [showMoreBelow, setShowMoreBelow] = useState(false);
    const userTookScrollRef = useRef(false);
    const programmaticScrollUntilRef = useRef(0);

    const scrollTranscriptTo = useCallback((top: number, behavior: ScrollBehavior = 'auto') => {
        const el = transcriptRef.current;
        if (!el) return;
        // Anchors are INSTANT by default: the submit-time and reply-land
        // scrolls race layout churn (the chip cloud collapsing, the
        // typewriter reveal re-rendering every ~18ms) which cancels or
        // retargets smooth programmatic scrolls mid-flight (measured live:
        // a smooth scroll to 123 landed at 0). Only the user-initiated
        // pill click asks for 'smooth'.
        programmaticScrollUntilRef.current = Date.now() + 700; // scroll events in this window are ours
        el.scrollTo({ top, behavior });
    }, []);

    const anchorBubbleTop = useCallback((idx: number) => {
        const el = transcriptRef.current;
        if (!el) return;
        const node = el.querySelector<HTMLElement>(`[data-bubble="${idx}"]`);
        if (!node) return;
        scrollTranscriptTo(Math.max(0, node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12));
    }, [scrollTranscriptTo]);

    const onTranscriptScroll = useCallback(() => {
        const el = transcriptRef.current;
        if (!el) return;
        if (Date.now() > programmaticScrollUntilRef.current) userTookScrollRef.current = true;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowMoreBelow(distance > 140);
    }, []);

    // The anchor driver: watches the conversation, not the reveal — the
    // reveal only grows content BELOW the anchor, so it never re-fires.
    const lastAnchoredYouRef = useRef(-1);
    const lastAnchoredReplyRef = useRef(-1);
    useEffect(() => {
        const el = transcriptRef.current;
        if (!el || !isPanelOpen) return;
        let lastYou = -1;
        for (let i = bubbles.length - 1; i >= 0; i--) {
            if (bubbles[i].role === 'you') { lastYou = i; break; }
        }
        if (lastYou < 0) return;
        const last = bubbles[bubbles.length - 1];
        if (lastYou !== lastAnchoredYouRef.current) {
            // A new prompt was just submitted — anchor it at the top.
            lastAnchoredYouRef.current = lastYou;
            lastAnchoredReplyRef.current = -1;
            userTookScrollRef.current = false;
            anchorBubbleTop(lastYou);
        } else if (
            last?.role === 'aloa' &&
            bubbles.length - 1 !== lastAnchoredReplyRef.current &&
            !userTookScrollRef.current
        ) {
            // The reply just landed — one corrective re-anchor so the
            // user's prompt + the reply's opening sit near the top (the
            // chip collapse above can shift layout). Skipped entirely if
            // the visitor has taken over scrolling.
            lastAnchoredReplyRef.current = bubbles.length - 1;
            anchorBubbleTop(lastYou);
        }
    }, [bubbles, isPanelOpen, anchorBubbleTop]);

    // Overflow bookkeeping for the "More below" pill. Content growth
    // (reveal ticks) does NOT fire scroll events, so the distance is
    // recomputed on conversation/reveal changes as well as on scroll.
    useEffect(() => {
        const el = transcriptRef.current;
        if (!el || !isPanelOpen) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowMoreBelow(distance > 140);
    }, [bubbles, revealIdx, revealChars, isThinking, isPanelOpen, topicsOpen, audience]);

    // Pending timers must never fire into an unmounted tree, and the
    // cookie-bar suppression class must never outlive the panel.
    useEffect(() => () => {
        if (thinkTimer.current) window.clearTimeout(thinkTimer.current);
        if (handoffTimer.current) window.clearTimeout(handoffTimer.current);
        if (revealTimer.current) window.clearInterval(revealTimer.current);
        document.body.classList.remove('practicepro-aloa-open');
    }, []);

    // The reveal driver: grow revealChars until the target bubble's full
    // text is visible, then park at -1. Chunks scale with length so short
    // answers still read as typing and long ones never drag.
    useEffect(() => {
        if (revealIdx < 0) return;
        const target = bubbles[revealIdx];
        const total = target ? target.text.length : 0;
        if (revealChars >= total) {
            if (revealTimer.current) { window.clearInterval(revealTimer.current); revealTimer.current = null; }
            return;
        }
        if (revealTimer.current) return; // already ticking
        const chunk = Math.max(2, Math.ceil(total / 110)); // ≈110 ticks → ~2s
        revealTimer.current = window.setInterval(() => {
            setRevealChars((c) => {
                const next = c + chunk;
                if (next >= total && revealTimer.current) {
                    window.clearInterval(revealTimer.current);
                    revealTimer.current = null;
                }
                return next;
            });
        }, 18);
        return () => {
            if (revealTimer.current) { window.clearInterval(revealTimer.current); revealTimer.current = null; }
        };
    }, [revealIdx, bubbles]);

    const pushAloaReply = useCallback((content: {
        text: string;
        steps?: string[];
        note?: string;
        lawyerNote?: string;
        suggestions?: string[];
        teamPrefill?: string;
    }) => {
        // A short "typing" beat makes the exchange feel attended without
        // faking AI — the reply is honest scripted guidance.
        setIsThinking(true);
        thinkTimer.current = window.setTimeout(() => {
            setIsThinking(false);
            setBubbles((prev) => [...prev, { role: 'aloa', ...content }]);
        }, 450);
    }, []);

    /** Professional-conduct-safe boundary line. 2026-11-22: Vega's line
     *  is the PRODUCT boundary (software provider, not a law firm —
     *  representation questions go to the official NBA directories);
     *  Atrium keeps the qualified-professional line. Neutral wording
     *  only: no referral-for-gain, no purchase conditioning. */
    const lawyerNoteCopy = isProperty
        ? 'General property guidance only — for advice on your specific situation, speak with a qualified professional.'
        : 'Product guidance for Vega only — PracticePro is a software provider, not a law firm. For legal matters, consult a qualified legal practitioner.';

    /** Live-AI answer path (owner direction 2026-11-18). Pushes the answer
     *  bubble and returns true when handled (a real answer OR an honest
     *  rate-limit message); returns false WITHOUT pushing so the caller
     *  falls back to the deterministic catalogue for THIS question. The
     *  Vega audience toggle rides along as userRole ('non_lawyer'
     *  reinforces the product-only boundary server-side). */
    const askAi = useCallback(
        async (
            question: string,
            reference?: { chip: string; reply: string; steps?: string[]; note?: string },
            suggestions?: string[],
        ): Promise<boolean> => {
            if (Date.now() < liveAiCooldownUntilRef.current) return false;
            setIsThinking(true);
            // Prior turns only — the current question is sent separately.
            const history: LandingAiHistoryItem[] = bubbles
                .slice(-6)
                .map((b) => ({
                    role: b.role === 'you' ? ('user' as const) : ('assistant' as const),
                    text: (b.steps?.length ? `${b.text} ${b.steps.join(' ')}` : b.text).slice(0, 300),
                }));
            const result = await askLandingAI({
                question,
                product,
                history,
                reference,
                // Vega audience toggle: 'non_lawyer' flips the engine's
                // visitor context so the product-only boundary is
                // reinforced on every reply. Atrium has no toggle.
                ...(product === 'vega' ? { userRole: audience } : {}),
            });
            setIsThinking(false);
            if (result === 'rate_limited') {
                // The visitor asked too much too fast — say so honestly.
                // Never impersonate the catalogue here: after real answers,
                // a canned card reads as the AI breaking.
                pushAloaReply({
                    text: 'You’ve reached the questions limit for a little while — the live assistant will be back soon. The topic cards still work anytime.',
                });
                return true;
            }
            if (result) {
                liveAiCooldownUntilRef.current = 0; // healthy again — clear any cooldown
                const nextIdx = bubbles.length; // the index this bubble will land at
                setBubbles((prev) => [...prev, {
                    role: 'aloa' as const,
                    // Conversational markdown — the in-app ALOA voice,
                    // revealed with the streaming-style typewriter.
                    text: result.text,
                    live: true,
                    markdown: true,
                    lawyerNote: lawyerNoteCopy,
                    suggestions,
                    teamPrefill: question,
                    // Legal-question decline (the engine's
                    // [[OFFICIAL_DIRECTORIES]] marker) → the Official
                    // Legal Directories card rides under the reply.
                    ...(result.directoriesAction ? { directoriesAction: true } : {}),
                }]);
                setRevealChars(0);
                setRevealIdx(nextIdx);
                return true;
            }
            // Transient failure (network/timeout/key): answer THIS question
            // from the catalogue and cool down 60s — the next question
            // retries the live engine. The visit is never permanently
            // downgraded.
            liveAiCooldownUntilRef.current = Date.now() + 60_000;
            return false;
        },
        [bubbles, product, lawyerNoteCopy, pushAloaReply],
    );

    const handleTopic = useCallback(
        (topic: AssistantTopic) => {
            setUsedTopics((prev) => new Set(prev).add(topic.id));
            setBubbles((prev) => [...prev, { role: 'you', text: topic.chip }]);
            // The answer needs the room — collapse the chip cloud.
            setTopicsOpen(false);
            // Live AI first (owner direction 2026-11-18), grounded on this
            // topic's owner-approved copy; the catalogue answer is the
            // fallback when the AI surface is unavailable.
            void (async () => {
                const answered = await askAi(
                    topic.chip,
                    { chip: topic.chip, reply: topic.reply, steps: topic.steps, note: topic.note },
                );
                if (!answered) {
                    pushAloaReply({ text: topic.reply, steps: topic.steps, note: topic.note, lawyerNote: lawyerNoteCopy });
                }
            })();
        },
        [askAi, pushAloaReply, lawyerNoteCopy],
    );

    /** Chip CTAs that hand off to the drawer, pre-typed. */
    const handoff = useCallback(
        (source: string, opts?: OpenContactOptions) => {
            setPanelOpen(false);
            // Let the sheet's exit transition land before the drawer slides
            // in — stacking two instant overlays reads as a glitch.
            handoffTimer.current = window.setTimeout(
                () => onContactSales(source, opts),
                180,
            );
        },
        [onContactSales],
    );

    /** Free-text question router (owner review round 2): score every
     *  topic by keyword overlap against the normalised question. Multi-
     *  word phrases count double — they signal intent, not vocabulary
     *  collision. Score >= 2 is a confident match; 1 is a suggestion. */
    const matchTopic = useCallback(
        (q: string): { topic: AssistantTopic; score: number } | null => {
            const hay = ` ${q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
            let best: { topic: AssistantTopic; score: number } | null = null;
            for (const t of topics) {
                let score = 0;
                for (const kw of t.keywords ?? []) {
                    if (hay.includes(` ${kw} `) || hay.endsWith(` ${kw}`) || hay.startsWith(`${kw} `)) {
                        score += kw.includes(' ') ? 2 : 1;
                    }
                }
                if (score > 0 && (!best || score > best.score)) best = { topic: t, score };
            }
            return best;
        },
        [topics],
    );

    const submitQuestion = useCallback(() => {
        const q = question.trim();
        if (q.length < 10) {
            setQuestionError('Tell me a little more — a sentence is enough.');
            return;
        }
        if (isThinking) return; // one exchange at a time — no double sends
        setQuestionError(null);
        setBubbles((prev) => [...prev, { role: 'you', text: q }]);
        setQuestion('');
        // The exchange is now the main event — collapse the topics.
        setTopicsOpen(false);

        const match = matchTopic(q);
        // Live AI first (owner direction 2026-11-18): the real engine
        // answers, grounded on the best-matched curated topic when there is
        // one. Everything below is the fallback that keeps the panel alive
        // when the AI surface is unavailable.
        const reference = match
            ? { chip: match.topic.chip, reply: match.topic.reply, steps: match.topic.steps, note: match.topic.note }
            : undefined;
        const suggestions = match ? [match.topic.chip] : undefined;

        void (async () => {
            const answered = await askAi(q, reference, suggestions);
            if (answered) {
                if (match && match.score >= 2) setUsedTopics((prev) => new Set(prev).add(match.topic.id));
                return;
            }

            // Owner review round 2 — QUESTIONS GET ANSWERED, NOT FUNNELLED:
            // the old flow auto-jumped into the message drawer (which reads
            // as a purchase funnel). A question now gets a real answer in the
            // panel; the drawer opens only if the visitor clicks the opt-in
            // link themselves. 2026-11-22: for Vega the matched fallback is
            // the product walkthrough (the catalogue IS the product prompts);
            // unmatched questions fall to the product-boundary reply below.
            if (match && match.score >= 2) {
                const t = match.topic;
                setUsedTopics((prev) => new Set(prev).add(t.id));
                pushAloaReply({
                    text: t.reply,
                    steps: t.steps,
                    note: t.note,
                    lawyerNote: lawyerNoteCopy,
                });
                return;
            }

            // 2. UNMATCHED or weakly-matched question, engine unavailable
            //    → the boundary reply. 2026-11-22: Vega's boundary is the
            //    PRODUCT boundary (no legal answers, no "contact us for
            //    legal help") + the Official Legal Directories card; a
            //    legal question or a product question both land here and
            //    both are handled honestly. Atrium keeps the honest
            //    qualified-professional boundary reply.
            pushAloaReply({
                text: isProperty
                    ? 'Straight answer: that looks outside what I can walk through reliably here. I cover everyday property situations — service charges, maintenance, tenancy agreements, landlord and tenant basics — in plain language. For your specific situation the details are where it matters, and that is exactly what a qualified professional is for.'
                    : 'I am here specifically as Vega’s product guide — features, workflows, plans, and getting your firm set up. I am not able to help with legal matters themselves: PracticePro is a software provider, not a law firm. If you are looking for legal representation, the official Nigerian Bar Association directories are the right place — the card below takes you there.',
                steps: isProperty ? [
                    'For your specific situation, the right next step is a qualified professional — a directory of vetted practitioners is coming to Vega to make that step easy.',
                    'For tenancy and property disputes, your local Nigerian Bar Association (NBA) branch can point you to a property-law practitioner today.',
                    'If it is an everyday matter, try the common questions below — those I can walk through properly.',
                ] : [
                    'For anything about Vega — a feature, a workflow, a plan — try the prompts below, or ask me again in a moment.',
                ],
                ...(isProperty ? {} : { directoriesAction: true }),
                lawyerNote: lawyerNoteCopy,
                suggestions: match ? [match.topic.chip] : undefined,
                teamPrefill: q,
            });
        })();
    }, [question, isThinking, matchTopic, pushAloaReply, askAi, isProperty, lawyerNoteCopy]);

    const onQuestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuestion();
        }
    };
    const nudgeCopy = isProperty
        ? { title: 'Property question?', sub: `Ask ${name} — free, no sign-up needed.` }
        : { title: 'Questions about Vega?', sub: `Ask ${name} — Vega's product guide. Free, no sign-up.` };
    // ── Render ──────────────────────────────────────────────────────────
    return (
        <>
            {/* ── The FAB row (+ the nudge pill that grows OUT of the button).
                Hidden while the panel is open (same rule as the in-app
                AloaFAB): the open panel IS the affordance.

                OWNER REVIEW ROUND 2: the pill is NOT a separate floating
                card anymore. It is docked to the LEFT of the icon button,
                emerges from the button's edge (aloa-nudge-emerge —
                transform-origin: right) and folds back INTO it
                (aloa-nudge-retract) when answered, dismissed or
                auto-hidden — "the pill should animate out of the button
                so that you know that it's the button you're supposed to
                click. We want to get you associated with clicking that
                button." While the pill is out, the icon carries a quiet
                attention ring (aloa-fab-attention) so the eye lands on
                the BUTTON, and the static desktop label yields its slot
                to the pill. */}
            {!isPanelOpen && (
            <div className={`aloa-fab-dock fixed bottom-24 md:bottom-6 right-4 md:right-6 ${Z_CLASS.shellFab} flex items-center gap-3 transition-[bottom] duration-300`}>
                {nudgePhase !== 'hidden' && (
                    <div
                        className={`relative shrink-0 w-[300px] max-w-[calc(100vw-6rem)] ${nudgePhase === 'out' ? 'aloa-nudge-emerge' : 'aloa-nudge-retract'}`}
                        role="status"
                        aria-live="polite"
                    >
                        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 p-3.5">
                            <div className="flex items-start gap-2.5">
                                <div className={`w-8 h-8 rounded-lg ${brand.avatar} text-white flex items-center justify-center shrink-0 shadow-md`}>
                                    <AloaIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 leading-snug">{nudgeCopy.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{nudgeCopy.sub}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={askFromNudge}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                >
                                    Ask {name}
                                </button>
                                <button
                                    onClick={() => retractNudge(true)}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                            {/* caret tying the pill to the button it grew from */}
                            <div className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-r border-t border-slate-200 rotate-45" aria-hidden="true" />
                        </div>
                    </div>
                )}
                {nudgePhase === 'hidden' && (
                <button
                    onClick={openPanel}
                    aria-label={`Ask ${name} — ${isProperty ? 'property help' : 'Vega product guide'}, free`}
                    className={`hidden md:flex flex-col items-start pl-3 pr-4 py-1.5 rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] group`}
                >
                    <span className={`text-sm font-bold leading-tight ${brand.pill}`}>Ask {name}</span>
                    <span className="text-2xs text-slate-500 leading-tight">{isProperty ? 'Property help · Free' : 'Vega product guide · Free'}</span>
                </button>
                )}
                <button
                    onClick={openPanel}
                    aria-label={`Ask ${name} — ${isProperty ? 'property help' : 'Vega product guide'}, free`}
                    title={`Ask ${name}`}
                    style={nudgePhase === 'out'
                        ? ({ '--aloa-ring': isProperty ? 'rgba(5, 150, 105, 0.5)' : 'rgba(30, 58, 138, 0.5)' } as React.CSSProperties)
                        : undefined}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-150 active:scale-95 hover:shadow-lg ${brand.fab} ${nudgePhase === 'out' ? 'aloa-fab-attention' : ''}`}
                >
                    <AloaIcon className="w-7 h-7 md:w-8 md:h-8" />
                </button>
            </div>
            )}

            {/* ── The assistant panel ── */}
            {isPanelOpen &&
                createPortal(
                    <>
                        {/* Lightweight veil — click-away only, never traps scroll.
                            Kept two rungs under the contact drawer so a handoff
                            stacks correctly. */}
                        <div
                            className={`fixed inset-0 ${Z_CLASS.alaoPanel} bg-black/20 md:bg-transparent`}
                            onClick={closePanel}
                            aria-hidden="true"
                        />
                        <div
                            ref={panelRef}
                            role="dialog"
                            aria-label={`${name} website assistant`}
                            className={`fixed ${Z_CLASS.alaoPanel} inset-x-0 bottom-0 md:inset-x-auto md:right-6 md:bottom-24 md:w-[400px] md:max-w-[calc(100vw-3rem)] flex flex-col bg-white md:rounded-2xl rounded-t-2xl border border-slate-200 shadow-2xl shadow-slate-900/20 max-h-[85dvh] md:max-h-[min(80vh,720px)] animate-slide-up overflow-hidden`}
                        >
                            {/* Header */}
                            <div className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r ${brand.wash}`}>
                                <div className={`relative w-10 h-10 rounded-lg ${brand.avatar} text-white flex items-center justify-center shadow-md shrink-0`}>
                                    <AloaIcon className="w-6 h-6" />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 leading-tight">
                                        {name} <span className="text-slate-400 font-medium">·</span>{' '}
                                        <span className="font-semibold text-slate-600">{isProperty ? 'Atrium\u2019s property guide' : 'Vega\u2019s product guide'}</span>
                                    </p>
                                    <p className="text-2xs text-slate-500 mt-0.5">{isProperty ? 'General property guidance, not professional advice' : 'Features, workflows & plans — product guidance, not legal advice'}</p>
                                </div>
                                <button
                                    onClick={closePanel}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                                    aria-label="Close assistant"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Chat utility area — VEGA: the audience toggle
                                (2026-11-22 owner spec); ATRIUM: the trust
                                chips. Default is "I am a Lawyer" — the full
                                practitioner experience, zero consumer
                                directory clutter. "I am not a Lawyer"
                                reveals the quiet product-only notice + the
                                NBA directory link, and flips the userRole
                                sent to the engine. */}
                            {isProperty ? (
                                <div className="flex items-center gap-2 px-4 pt-3 text-2xs font-semibold text-slate-500">
                                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Free</span>
                                    <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-100">No sign-up</span>
                                    <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-100">You don't need to be a property pro</span>
                                </div>
                            ) : (
                                <div className="px-4 pt-3 pb-1">
                                    <div
                                        role="radiogroup"
                                        aria-label="Are you a lawyer?"
                                        className="flex items-center p-0.5 rounded-full border border-slate-200 bg-slate-50"
                                    >
                                        {([
                                            { value: 'lawyer', label: 'I am a Lawyer' },
                                            { value: 'non_lawyer', label: 'I am not a Lawyer' },
                                        ] as const).map((opt) => (
                                            <button
                                                key={opt.value}
                                                role="radio"
                                                aria-checked={audience === opt.value}
                                                onClick={() => setAudience(opt.value)}
                                                className={`flex-1 py-1.5 rounded-full text-2xs font-bold transition-all active:scale-[0.98] ${
                                                    audience === opt.value
                                                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {audience === 'non_lawyer' && (
                                        <p className="mt-2 text-2xs leading-[1.7] text-slate-500 animate-fade-in">
                                            Vega by PracticePro is practice management software built exclusively for lawyers and law firms. Looking for legal representation in Lagos?{' '}
                                            <button
                                                onClick={onOpenDirectories}
                                                className="font-semibold text-[#1E3A8A] underline underline-offset-2 decoration-slate-300 hover:decoration-[#1E3A8A] transition-colors"
                                            >
                                                Locate a licensed practitioner via official NBA directories →
                                            </button>
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Transcript — the scroll container (the
                                "More below" pill rides INSIDE it as a
                                sticky element, so it floats over the
                                content without needing a wrapper).
                                flex-basis 300px: the long product prompt
                                chips below are content-sized siblings —
                                a plain flex-1 (basis 0) let them squeeze
                                the transcript to a sliver on fresh open
                                (measured 24px); the basis floor keeps the
                                conversation the main event while the
                                panel is content-sized, and grow fills the
                                panel once it hits its max-height cap. */}
                            <div ref={transcriptRef} onScroll={onTranscriptScroll} className="flex-[1_1_300px] overflow-y-auto px-4 py-3 space-y-3">
                                {/* Intro */}
                                <div className="flex items-start gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg ${brand.avatar} text-white flex items-center justify-center shrink-0`}>
                                        <AloaIcon className="w-4 h-4" />
                                    </div>
                                    <div className="bg-slate-100 rounded-lg rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                                        <p className="text-sm text-slate-700 leading-relaxed">{introBubble.text}</p>
                                    </div>
                                </div>

                                {bubbles.map((b, i) =>
                                    b.role === 'you' ? (
                                        <div key={i} data-bubble={i} className="flex justify-end">
                                            <div className={` rounded-lg rounded-tr-sm px-3.5 py-2.5 max-w-[85%] ${brand.bubble} text-white`}>
                                                <p className="text-sm leading-relaxed">{b.text}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={i} data-bubble={i} className="flex items-start gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg ${brand.avatar} text-white flex items-center justify-center shrink-0`}>
                                                <AloaIcon className="w-4 h-4" />
                                            </div>
                                            <div className="bg-slate-100 rounded-lg rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`text-2xs font-bold uppercase tracking-wide ${isProperty ? 'text-emerald-700' : 'text-[#1E3A8A]'}`}>
                                                        {isProperty ? 'ARIA' : 'ALOA'}
                                                    </span>
                                                    {b.live ? (
                                                        <span className="inline-flex items-center gap-1 text-2xs text-slate-400">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isProperty ? 'bg-emerald-500' : 'bg-[#1D4ED8]'} animate-pulse`} />
                                                            live AI
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {b.markdown ? (
                                                    // Live AI answer — conversational markdown rendered
                                                    // rich (the in-app ALOA voice), revealed with the
                                                    // streaming-style typewriter. Partial text is
                                                    // re-parsed each frame; unclosed markers just render
                                                    // literally for a tick. Escape-first renderer — no
                                                    // model output can inject markup.
                                                    <div className="text-sm text-slate-700 leading-relaxed [&_a]:break-all">
                                                        <span
                                                            dangerouslySetInnerHTML={{
                                                                __html: renderLandingMarkdown(
                                                                    i === revealIdx ? b.text.slice(0, revealChars) : b.text,
                                                                ),
                                                            }}
                                                        />
                                                        {i === revealIdx && revealChars < b.text.length && (
                                                            <span className={`inline-block w-[2px] h-[1em] align-text-bottom ml-0.5 ${isProperty ? 'bg-emerald-500' : 'bg-[#1D4ED8]'} animate-pulse`} />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-slate-700 leading-relaxed">{b.text}</p>
                                                        {/* Numbered steps — the substance of the guide. */}
                                                        {b.steps && b.steps.length > 0 && (
                                                            <ol className="mt-2 space-y-1">
                                                                {b.steps.map((s, si) => (
                                                                    <li key={si} className="flex gap-2 items-start">
                                                                        <span className={`mt-px w-4 h-4 rounded-full text-2xs font-bold text-white flex items-center justify-center shrink-0 ${brand.step}`}>
                                                                            {si + 1}
                                                                        </span>
                                                                        <span className="text-xs text-slate-700 leading-relaxed">{s}</span>
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        )}
                                                        {/* Caution callout — visually distinct from the steps. */}
                                                        {b.note && (
                                                            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 border-l-2 border-amber-300 bg-amber-50 rounded-r-lg px-2.5 py-1">
                                                                {b.note}
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                                {/* Lawyer boundary line (owner review round 2): the
                                                    professional-conduct-safe "this is the amount of
                                                    information we can give you" note — quiet, neutral,
                                                    never a sales or referral pitch. */}
                                                {b.lawyerNote && (
                                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 border-l-2 border-slate-300 bg-slate-50 rounded-r-lg px-2.5 py-1">
                                                        {b.lawyerNote}
                                                    </p>
                                                )}
                                                {/* Legal-question decline (Vega product guide):
                                                    the Official Legal Directories action card —
                                                    RPC-neutral, NBA resources only. */}
                                                {b.directoriesAction && (
                                                    <button
                                                        onClick={onOpenDirectories}
                                                        className="mt-2 w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white hover:border-[#1E3A8A]/40 hover:shadow-sm transition-all text-left px-3 py-2.5"
                                                    >
                                                        <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0" aria-hidden="true">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5" />
                                                            </svg>
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-xs font-bold text-slate-900">Official Legal Directories</span>
                                                            <span className="block text-2xs text-slate-500 leading-snug">NBA resources to locate a licensed practitioner</span>
                                                        </span>
                                                        <span className="text-slate-300 shrink-0" aria-hidden="true">→</span>
                                                    </button>
                                                )}
                                                {/* Follow-up topic suggestions (weak match). */}
                                                {b.suggestions && b.suggestions.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {b.suggestions.map((chip) => {
                                                            const st = topics.find((tp) => tp.chip === chip);
                                                            if (!st) return null;
                                                            return (
                                                                <button
                                                                    key={chip}
                                                                    onClick={() => handleTopic(st)}
                                                                    className={`px-2.5 py-1 rounded-full border text-2xs font-semibold bg-white transition-all active:scale-[0.97] hover:shadow-sm ${brand.chipAccent}`}
                                                                >
                                                                    {chip}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {/* Opt-in human handoff (owner review round 2): a
                                                    link the visitor clicks THEMSELVES — nothing
                                                    auto-opens. Wording stays team-neutral, never a
                                                    purchase pitch. */}
                                                {i === bubbles.length - 1 && b.teamPrefill && (
                                                    <button
                                                        onClick={() => handoff('Aloa Landing Assistant', { prefill: b.teamPrefill, variant: 'assist' })}
                                                        className="mt-2 block text-2xs font-semibold text-slate-500 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-500 hover:text-slate-700 transition-colors text-left"
                                                    >
                                                        Prefer a human? Send this to our team — a real person replies within one business day.
                                                    </button>
                                                )}
                                                {/* Product topics keep their trial CTA; informational
                                                    replies deliberately carry NO sales CTA (owner:
                                                    the lawyer funnel comes later, in its own round). */}
                                                {i === bubbles.length - 1 &&
                                                    (() => {
                                                        const t = topics.find(
                                                            (tp) => tp.chip === bubbles[i - 1]?.text,
                                                        );
                                                        if (!t?.signupCta || !onSignup) return null;
                                                        return (
                                                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                                                <button
                                                                    onClick={() => { setPanelOpen(false); onSignup(); }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors ${brand.cta}`}
                                                                >
                                                                    Start free trial
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                            </div>
                                        </div>
                                    ),
                                )}

                                {isThinking && (
                                    <div className="flex items-start gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg ${brand.avatar} text-white flex items-center justify-center shrink-0`}>
                                            <AloaIcon className="w-4 h-4" />
                                        </div>
                                        <div className="bg-slate-100 rounded-lg rounded-tl-sm px-4 py-3 flex items-center gap-1.5" aria-label={`${name} is typing`}>
                                            {[0, 150, 300].map((d) => (
                                                <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* "More below" — sticky at the bottom edge of
                                    the visible transcript area; rendered ONLY
                                    when content overflows the fold and the
                                    visitor has not scrolled down
                                    (2026-11-22 scroll spec). Disappears on
                                    click or reaching the bottom. */}
                                {showMoreBelow && (
                                    <div className="sticky bottom-2 flex justify-center pointer-events-none">
                                        <button
                                            onClick={() => {
                                                const el = transcriptRef.current;
                                                if (el) scrollTranscriptTo(el.scrollHeight, 'smooth');
                                            }}
                                            className="pointer-events-auto px-3 py-1.5 rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-md text-2xs font-bold text-slate-600 hover:text-slate-900 hover:shadow-lg transition-all active:scale-[0.97]"
                                            aria-label="Scroll to the rest of the reply"
                                        >
                                            ↓ More below
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Quick topics — collapse to a toggle once the
                                conversation starts, so the answer gets the
                                space (owner review: "it's being blocked up"). */}
                            <div className="px-4 pb-1 pt-1 border-t border-slate-100">
                                <button
                                    onClick={() => setTopicsOpen((v) => !v)}
                                    aria-expanded={topicsOpen}
                                    className="w-full flex items-center justify-between py-1.5 group"
                                >
                                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700">
                                        Common questions
                                    </span>
                                    <svg
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${topicsOpen ? 'rotate-180' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {topicsOpen && (
                                    <div className="flex flex-wrap gap-2 pb-1.5">
                                        {topics.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleTopic(t)}
                                                className={`px-3 py-1.5 rounded-full border text-xs font-semibold bg-white transition-all active:scale-[0.97] hover:shadow-sm ${brand.chipAccent} ${usedTopics.has(t.id) ? 'opacity-60' : ''}`}
                                            >
                                                {t.chip}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Composer */}
                            <div className="p-4 pt-3">
                                <div className={`flex items-end gap-2 rounded-2xl border bg-white transition-colors ${questionError ? 'border-red-300' : 'border-slate-200 focus-within:border-slate-400'}`}>
                                    <textarea
                                        ref={inputRef}
                                        rows={1}
                                        value={question}
                                        onChange={(e) => { setQuestion(e.target.value); if (questionError) setQuestionError(null); }}
                                        onKeyDown={onQuestionKeyDown}
                                        placeholder={isProperty ? 'Type your property question…' : 'Ask about Vega — features, plans…'}
                                        aria-label={`Your question for ${name}`}
                                        className="flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none max-h-24 min-h-[2.5rem]"
                                    />
                                    <button
                                        onClick={submitQuestion}
                                        aria-label="Send question"
                                        className={`m-1.5 w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40 ${brand.send}`}
                                        disabled={question.trim().length < 10 || isThinking}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                                    </button>
                                </div>
                                <p className={`text-2xs mt-1.5 leading-relaxed ${questionError ? 'text-red-500' : 'text-slate-500'}`}>
                                    {questionError
                                        ?? (
                                            <>
                                                {isProperty
                                                    ? `${name} gives general guidance, not professional advice.`
                                                    : `${name} guides on the product — PracticePro is a software provider, not a law firm.`}{' '}
                                                <button
                                                    onClick={() => handoff('Aloa Landing Assistant', {
                                                        prefill: isProperty
                                                            ? 'I have a property question. Here is my situation: '
                                                            : 'I have a question about Vega. Here it is: ',
                                                        variant: 'assist',
                                                    })}
                                                    className="font-semibold underline underline-offset-2 decoration-slate-300 hover:decoration-slate-500 hover:text-slate-700 transition-colors"
                                                >
                                                    Ask our team
                                                </button>
                                            </>
                                        )}
                                </p>
                            </div>
                        </div>
                    </>,
                    document.body,
                )}
        </>
    );
};

export default AloaAssistantFab;
