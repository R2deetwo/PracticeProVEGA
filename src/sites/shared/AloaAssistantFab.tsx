import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AloaIcon } from '../../constants';
import { Z_CLASS } from '../../overlays/constants';
import { getAssistantName } from '../../utils/assistantIdentity';

/**
 * AloaAssistantFab — the non-lawyer-first website assistant (bank-style).
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
 *   2. OWNERSHIP COPY. ALOA introduces itself as VEGA'S legal guide (not
 *      "PracticePro's"); ARIA as ATRIUM'S property guide.
 *   3. TOPICS COLLAPSE. Once the visitor picks a topic or asks a
 *      question, the chip cloud collapses to a toggle so the ANSWER gets
 *      the space (owner: "you would expect it to sort of drop down…
 *      it's being blocked up").
 *   4. USEFUL REPLIES. Each topic answer is a structured mini-guide
 *      (intro + numbered steps + caution note). Statutory specifics are
 *      stated ONLY where the deterministic framework is encoded
 *      (tenancyNoticePeriods.ts / legal corpus: lagos_tenancy_law_2011)
 *      — everything else stays process-level guidance.
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
 *      ANSWERED in the panel; out-of-scope questions get an honest
 *      boundary reply ("this is the amount of information we can give
 *      you — reach out to a lawyer for more in-depth information") plus
 *      the professional-conduct-safe lawyer note. The message drawer
 *      opens ONLY when the visitor clicks a link themselves — never an
 *      auto-jump, and never a purchase funnel (buying Vega is a
 *      separate thing from reaching a lawyer).
 *
 * LIVE AI ENGINE (owner direction, 2026-11-18: "we cannot have something
 *   that is not smart or answers only preset answers"):
 *   Every question — free text AND topic chips — is answered by the real
 *   AI through the PUBLIC rate-limited /ai/landing-chat action on Convex
 *   (CORS allow-list + per-IP hourly/daily limits + global daily cap;
 *   see convex/landingChat.ts). The matched topic's owner-approved copy
 *   rides along as grounding REFERENCE so answers stay consistent with
 *   the curated guidance (and the encoded statutory specifics). The
 *   deterministic catalogue below is now the FALLBACK: if the AI surface
 *   is unreachable (key rotation, network, timeout) the panel answers
 *   exactly as it did before — it never regresses to silence. Two
 *   consecutive AI failures disable live answers for the session so a
 *   visitor is never left waiting on a dead surface.
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

/** Per-surface brand tokens for the FAB / pill / panel accents. */
const BRAND: Record<LandingProduct, { fab: string; pill: string; chipAccent: string; avatar: string }> = {
    vega: {
        fab: 'bg-[#1E3A8A] hover:bg-[#1E40AF] hover:shadow-[rgb(30_58_138/0.35)]',
        pill: 'text-[#1E3A8A]',
        chipAccent: 'text-[#1E3A8A] border-slate-300 hover:border-[#1E3A8A] hover:bg-blue-50',
        avatar: 'bg-[#1E3A8A]',
    },
    atrium: {
        fab: 'bg-atrium-emerald hover:brightness-110',
        pill: 'text-emerald-700',
        chipAccent: 'text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
        avatar: 'bg-atrium-emerald',
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
    intro: string;
    steps?: string[];
    note?: string;
}

interface LandingAiHistoryItem {
    role: 'user' | 'assistant';
    text: string;
}

/** Client-side budget — the server gives itself 15s, but a visitor
 *  should never wait that long for a panel answer; the catalogue
 *  fallback answers instantly when this fires. */
const LANDING_AI_TIMEOUT_MS = 9000;

/** Ask the live engine. Returns null on ANY failure (network, timeout,
 *  rate limit, key unavailable, malformed payload) — callers fall back
 *  to the deterministic catalogue, so the panel never breaks. */
async function askLandingAI(payload: {
    question: string;
    product: LandingProduct;
    history: LandingAiHistoryItem[];
    reference?: { chip: string; reply: string; steps?: string[]; note?: string };
}): Promise<LandingAiAnswer | null> {
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
        if (!res.ok) return null;
        const data = await res.json();
        const a = data?.answer;
        if (a && typeof a.intro === 'string' && a.intro.trim()) {
            return {
                intro: a.intro.trim(),
                steps: Array.isArray(a.steps)
                    ? a.steps.filter((s: unknown): s is string => typeof s === 'string' && !!s.trim()).slice(0, 6)
                    : undefined,
                note: typeof a.note === 'string' && a.note.trim() ? a.note.trim() : undefined,
            };
        }
        return null;
    } catch {
        return null;
    }
}

interface Bubble {
    role: 'aloa' | 'you';
    text: string;
    steps?: string[];
    note?: string;
    /** Professional-conduct-safe boundary line ("general information,
     *  not legal advice — speak with a qualified lawyer"). */
    lawyerNote?: string;
    /** Topic chips to offer as follow-ups (matched by chip label). */
    suggestions?: string[];
    /** When set, renders the opt-in "send this to our team" link with
     *  this text pre-typed — the visitor clicks it themselves; nothing
     *  auto-opens. */
    teamPrefill?: string;
}

/**
 * Topic catalogue — plain-language, non-lawyer-first. Each answer is a
 * structured mini-guide: intro + numbered steps + a caution note. NO
 * invented legal specifics: the only statutory figures quoted (Lagos
 * notice-to-quit periods, court-order-only recovery) come from the
 * deterministic framework encoded in src/utils/tenancyNoticePeriods.ts
 * and the legal corpus (lagos_tenancy_law_2011) — everything else is
 * process-level guidance. Atrium skews property; vega skews general
 * legal. Per-reply sales CTAs are deliberately absent (owner: the
 * lawyer funnel comes later, in its own round).
 */
function buildTopics(product: LandingProduct, name: string): AssistantTopic[] {
    const legal: AssistantTopic[] = [
        {
            id: 'court_letter',
            chip: 'I received a court letter',
            reply: 'Do not ignore it — and do not panic. Most court letters open a process rather than end one, but the dates printed on them are enforced strictly.',
            steps: [
                'Read it carefully and note three things: the court\u2019s name, the suit number, and any date you are asked to respond by.',
                'Keep the original somewhere safe and make copies. Never write on it, and never hand the original over to anyone who just asks.',
                'Work out what it is: an originating process (someone has started a case against you), a hearing notice (a date is fixed), or a document you are being asked to respond to.',
                'Act early. If a response date is printed on it, treat it as real even if you plan to challenge the case — ignoring it can lead to judgment being entered against you in your absence.',
            ],
            note: 'Before you reply in writing, have someone qualified review it — what you write back becomes part of the case.',
            keywords: ['court letter', 'court', 'summons', 'writ', 'subpoena', 'hearing', 'lawsuit', 'sue', 'sued', 'case against me', 'served', 'bailiff', 'sheriff', 'judgment', 'judgement', 'petition'],
        },
        {
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
        },
        {
            id: 'document',
            chip: 'I need a document or agreement',
            reply: 'A well-drafted document is cheaper than the dispute it prevents.',
            steps: [
                'Put it in writing. Verbal agreements are hard to prove even when they are valid.',
                'Cover the essentials: full names and addresses of everyone bound by it, what each side is giving or doing, the money involved, how long it lasts, and how it can end.',
                'Get it stamped where the law requires — unstamped documents can face penalties and evidential problems when you need them in court.',
                'Never sign under pressure. Take it away, read all of it, and have it reviewed before you commit.',
            ],
            note: 'If the other side drafted the document, assume it favours them — that is exactly what review is for.',
            keywords: ['agreement', 'contract', 'document', 'draft', 'stamp', 'deed', 'mou', 'nda', 'memorandum', 'will', 'paperwork'],
        },
        {
            id: 'business',
            chip: 'Registering a business (CAC)',
            reply: 'Good move — registering properly protects the name, shields the owners, and unlocks what a Nigerian business actually needs: bank accounts, contracts, tenders.',
            steps: [
                'Choose the vehicle first. A business name (sole proprietor or partnership) is simpler, but you remain personally liable for its debts. A limited company (LTD) keeps liability with the company and is what partners and investors expect.',
                'Do a name search on the CAC portal and have backup names ready — the first choice is often taken.',
                'File the registration with complete owner details, and collect your certificate when issued.',
                'After registration come continuing duties: companies file annual returns and keep proper records. Missing them attracts penalties and can get the name struck off the register.',
            ],
            keywords: ['cac', 'registering', 'register a business', 'register my business', 'registration', 'business name', 'incorporate', 'incorporation', 'ltd', 'limited liability', 'rc number', 'corporate affairs'],
        },
    ];

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
            legal[1], // landlord/tenant
            propertyTopics[0], // service charge
            propertyTopics[1], // maintenance
            propertyTopics[2], // tenancy agreement review
            estateManager,
            lawyerFirm,
        ];
    }
    return [...legal, lawyerFirm];
}

const AloaAssistantFab: React.FC<{
    product: LandingProduct;
    onContactSales: (source: string, opts?: OpenContactOptions) => void;
    onSignup?: () => void;
}> = ({ product, onContactSales, onSignup }) => {
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
    const [topicsOpen, setTopicsOpen] = useState(true);

    const panelRef = useRef<HTMLDivElement>(null);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const thinkTimer = useRef<number | null>(null);
    const handoffTimer = useRef<number | null>(null);
    const nudgeTimers = useRef<number[]>([]);
    // Live-AI session state: two consecutive failures stop trying for the
    // session (instant catalogue answers beat waiting on a dead surface).
    const liveAiFailuresRef = useRef(0);
    const liveAiDisabledRef = useRef(false);

    const introBubble = useMemo<Bubble>(
        () => ({
            role: 'aloa',
            // Owner review: ALOA is VEGA'S tool, ARIA is ATRIUM'S — never
            // "PracticePro's guide".
            text: isProperty
                ? `Hi, I'm ${name} — Atrium's property guide. You don't need to be a property professional to ask here. Tell me what's on your mind, or pick a topic below.`
                : `Hi, I'm ${name} — Vega's legal guide. You don't need to be a lawyer to ask here. Tell me what's on your mind, or pick a topic below.`,
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

    // Keep the transcript pinned to the latest bubble. For LONG structured
    // guides (steps) the pin moves to the TOP of the answer instead — landing
    // mid-steps hides the intro the way the owner's "blocked up" screenshot
    // did; the guide should read top-down.
    useEffect(() => {
        const el = transcriptRef.current;
        if (!el) return;
        const last = bubbles[bubbles.length - 1];
        if (last?.role === 'aloa' && last.steps?.length) {
            const node = el.querySelector<HTMLElement>(`[data-bubble="${bubbles.length - 1}"]`);
            if (node) {
                el.scrollTop = Math.max(
                    0,
                    node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12,
                );
                return;
            }
        }
        el.scrollTop = el.scrollHeight;
    }, [bubbles, isThinking, isPanelOpen]);

    // Pending timers must never fire into an unmounted tree, and the
    // cookie-bar suppression class must never outlive the panel.
    useEffect(() => () => {
        if (thinkTimer.current) window.clearTimeout(thinkTimer.current);
        if (handoffTimer.current) window.clearTimeout(handoffTimer.current);
        document.body.classList.remove('practicepro-aloa-open');
    }, []);

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

    /** Professional-conduct-safe boundary line, attached to every guide
     *  answer (owner review round 2: "this is the amount of information we
     *  can give you — reach out to a lawyer for more in-depth
     *  information"). Neutral wording only: no referral-for-gain, no
     * purchase conditioning. */
    const lawyerNoteCopy = isProperty
        ? 'General property guidance only — for advice on your specific situation, speak with a qualified professional.'
        : 'General legal information, not legal advice — for anything specific to your situation, the right next step is a qualified lawyer.';

    /** Live-AI answer path (owner direction 2026-11-18). Pushes the answer
     *  bubble and returns true on success; returns false WITHOUT pushing so
     *  the caller falls back to the deterministic catalogue. */
    const askAi = useCallback(
        async (
            question: string,
            reference?: { chip: string; reply: string; steps?: string[]; note?: string },
            suggestions?: string[],
        ): Promise<boolean> => {
            if (liveAiDisabledRef.current) return false;
            setIsThinking(true);
            // Prior turns only — the current question is sent separately.
            const history: LandingAiHistoryItem[] = bubbles
                .slice(-6)
                .map((b) => ({
                    role: b.role === 'you' ? ('user' as const) : ('assistant' as const),
                    text: (b.steps?.length ? `${b.text} ${b.steps.join(' ')}` : b.text).slice(0, 300),
                }));
            const answer = await askLandingAI({ question, product, history, reference });
            setIsThinking(false);
            if (answer) {
                liveAiFailuresRef.current = 0;
                setBubbles((prev) => [...prev, {
                    role: 'aloa' as const,
                    text: answer.intro,
                    steps: answer.steps,
                    note: answer.note,
                    lawyerNote: lawyerNoteCopy,
                    suggestions,
                    teamPrefill: question,
                }]);
                return true;
            }
            liveAiFailuresRef.current += 1;
            if (liveAiFailuresRef.current >= 2) liveAiDisabledRef.current = true;
            return false;
        },
        [bubbles, product, lawyerNoteCopy],
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
            // link themselves. Professional-conduct safety: the boundary is
            // stated plainly ("this is the amount of information we can give
            // you"), with a neutral pointer to qualified lawyers — no
            // referral-for-gain, no conditioning help on buying anything.
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

            // Out of scope ("Tell me about maritime law"): honest boundary
            // reply — the guide's scope, then the qualified-lawyer next step.
            pushAloaReply({
                text: isProperty
                    ? 'Straight answer: that looks outside what I can walk through reliably here. I cover everyday property situations — service charges, maintenance, tenancy agreements, landlord and tenant basics — in plain language. For your specific situation the details are where it matters, and that is exactly what a qualified professional is for.'
                    : 'Straight answer: that looks outside what I can cover reliably here. I give general, plain-language guidance on everyday legal matters — court letters, landlord and tenant issues, agreements, business registration. Specialist areas and anything specific to your situation need a qualified lawyer, and I would rather say that plainly than sound confident and mislead you.',
                steps: [
                    isProperty
                        ? 'For your specific situation, the right next step is a qualified professional — a directory of vetted practitioners is coming to Vega to make that step easy.'
                        : 'For your specific situation, the right next step is a qualified lawyer — a lawyer directory is coming to Vega to make finding one easy.',
                    isProperty
                        ? 'For tenancy and property disputes, your local Nigerian Bar Association (NBA) branch can point you to a property-law practitioner today.'
                        : 'Your local Nigerian Bar Association (NBA) branch can point you to practitioners in that field today.',
                    'If it is an everyday matter, try the common questions below — those I can walk through properly.',
                ],
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
        : { title: 'Need help with a legal matter?', sub: `Ask ${name} — free, and you don't need to be a lawyer.` };
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
                    aria-label={`Ask ${name} — ${isProperty ? 'property help' : 'legal help'}, free`}
                    className={`hidden md:flex flex-col items-start pl-3 pr-4 py-1.5 rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] group`}
                >
                    <span className={`text-sm font-bold leading-tight ${brand.pill}`}>Ask {name}</span>
                    <span className="text-2xs text-slate-500 leading-tight">{isProperty ? 'Property help · Free' : 'Legal help · Free'}</span>
                </button>
                )}
                <button
                    onClick={openPanel}
                    aria-label={`Ask ${name} — ${isProperty ? 'property help' : 'legal help'}, free`}
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
                            <div className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r ${isProperty ? 'from-emerald-50 to-white' : 'from-primary-50 to-white'}`}>
                                <div className={`relative w-10 h-10 rounded-lg ${brand.avatar} text-white flex items-center justify-center shadow-md shrink-0`}>
                                    <AloaIcon className="w-6 h-6" />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 leading-tight">
                                        {name} <span className="text-slate-400 font-medium">·</span>{' '}
                                        <span className="font-semibold text-slate-600">{isProperty ? 'Atrium\u2019s property guide' : 'Vega\u2019s legal guide'}</span>
                                    </p>
                                    <p className="text-2xs text-slate-500 mt-0.5">{isProperty ? 'General property guidance, not professional advice' : 'General legal guidance, not legal advice'}</p>
                                </div>
                                <button
                                    onClick={closePanel}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                                    aria-label="Close assistant"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Trust chips */}
                            <div className="flex items-center gap-2 px-4 pt-3 text-2xs font-semibold text-slate-500">
                                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Free</span>
                                <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-100">No sign-up</span>
                                <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-100">You don't need to be {isProperty ? 'a property pro' : 'a lawyer'}</span>
                            </div>

                            {/* Transcript */}
                            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
                                            <div className={` rounded-lg rounded-tr-sm px-3.5 py-2.5 max-w-[85%] ${isProperty ? 'bg-emerald-600' : 'bg-primary-600'} text-white`}>
                                                <p className="text-sm leading-relaxed">{b.text}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={i} data-bubble={i} className="flex items-start gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg ${brand.avatar} text-white flex items-center justify-center shrink-0`}>
                                                <AloaIcon className="w-4 h-4" />
                                            </div>
                                            <div className="bg-slate-100 rounded-lg rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                                                <p className="text-sm text-slate-700 leading-relaxed">{b.text}</p>
                                                {/* Numbered steps — the substance of the guide. */}
                                                {b.steps && b.steps.length > 0 && (
                                                    <ol className="mt-2 space-y-1">
                                                        {b.steps.map((s, si) => (
                                                            <li key={si} className="flex gap-2 items-start">
                                                                <span className={`mt-px w-4 h-4 rounded-full text-2xs font-bold text-white flex items-center justify-center shrink-0 ${isProperty ? 'bg-atrium-emerald' : 'bg-primary-600'}`}>
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
                                                {/* Lawyer boundary line (owner review round 2): the
                                                    professional-conduct-safe "this is the amount of
                                                    information we can give you" note — quiet, neutral,
                                                    never a sales or referral pitch. */}
                                                {b.lawyerNote && (
                                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 border-l-2 border-slate-300 bg-slate-50 rounded-r-lg px-2.5 py-1">
                                                        {b.lawyerNote}
                                                    </p>
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
                                                        Prefer a human? Send this to our team — a real person replies within 24 hours.
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
                                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
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
                                        placeholder={isProperty ? 'Type your property question…' : 'Type your legal question…'}
                                        aria-label={`Your question for ${name}`}
                                        className="flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none max-h-24 min-h-[2.5rem]"
                                    />
                                    <button
                                        onClick={submitQuestion}
                                        aria-label="Send question"
                                        className={`m-1.5 w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40 ${isProperty ? 'bg-atrium-emerald hover:brightness-110' : 'bg-primary-600 hover:bg-primary-700'}`}
                                        disabled={question.trim().length < 10 || isThinking}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                                    </button>
                                </div>
                                <p className={`text-2xs mt-1.5 leading-relaxed ${questionError ? 'text-red-500' : 'text-slate-500'}`}>
                                    {questionError
                                        ?? (
                                            <>
                                                {name} gives general guidance, not legal advice.{' '}
                                                <button
                                                    onClick={() => handoff('Aloa Landing Assistant', {
                                                        prefill: isProperty
                                                            ? 'I have a property question. Here is my situation: '
                                                            : 'I have a legal question. Here is my situation: ',
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
