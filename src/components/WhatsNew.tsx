
import React, { useEffect, useState } from 'react';

// ─── GLASSMORPHIC ICON SET ──────────────────────────────────────────────────
// A consistent icon vocabulary tied to app sections.
// Each icon uses a glassmorphic pill wrapper so they match the card aesthetic.

const IconPill: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        flexShrink: 0,
        borderRadius: '10px',
        background: `rgba(${color}, 0.15)`,
        border: `1px solid rgba(${color}, 0.3)`,
        backdropFilter: 'blur(6px)',
    }}>
        {children}
    </span>
);

// Brain / AI Memory
const IconBrain: React.FC = () => (
    <IconPill color="139, 92, 246">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(167,139,250)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
    </IconPill>
);

// Semantic Search
const IconSearch: React.FC = () => (
    <IconPill color="99, 102, 241">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(129,140,248)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M8 11h6M11 8v6" />
        </svg>
    </IconPill>
);

// Shield / Privacy / Multi-tenancy
const IconShield: React.FC = () => (
    <IconPill color="34, 197, 94">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(74,222,128)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    </IconPill>
);

// Document / Files
const IconDocument: React.FC = () => (
    <IconPill color="251, 146, 60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(251,191,36)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    </IconPill>
);

// Calendar / Events
const IconCalendar: React.FC = () => (
    <IconPill color="56, 189, 248">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(125,211,252)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    </IconPill>
);

// Bolt / Performance
const IconBolt: React.FC = () => (
    <IconPill color="250, 204, 21">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(250,204,21)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    </IconPill>
);

// Theme / Appearance
const IconTheme: React.FC = () => (
    <IconPill color="236, 72, 153">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(244,114,182)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
    </IconPill>
);

// Portal / Doorway
const IconPortal: React.FC = () => (
    <IconPill color="59, 130, 246">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(96,165,250)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M9 9h6" />
            <path d="M9 15h4" />
        </svg>
    </IconPill>
);

// Pen / Drafting
const IconPen: React.FC = () => (
    <IconPill color="245, 158, 11">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(251,191,36)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    </IconPill>
);

// Icon map — use these in CHANGELOG entries by name
export const FEATURE_ICONS: Record<string, React.FC> = {
    brain: IconBrain,
    search: IconSearch,
    shield: IconShield,
    document: IconDocument,
    calendar: IconCalendar,
    bolt: IconBolt,
    theme: IconTheme,
    portal: IconPortal,
    pen: IconPen,
};

// ─── CHANGELOG DATA ──────────────────────────────────────────────────────────
// Add new entries at the TOP. Bump the version for every release.
// Use 'icon' to pick from FEATURE_ICONS above.
//
// ─── PERIODIC UPDATE SYSTEM ──────────────────────────────────────────────────
// What's New entries should be consolidated periodically:
// - Major features ship as a single entry covering all changes in that release
// - Minor fixes/patches do NOT get their own What's New entry — they're
//   folded into the next major entry
// - The user should never see more than one What's New popup per release
// - Entries should be concise: title + 1-line description + 3-8 feature bullets
// - Each feature bullet should be 1-2 sentences max
// - Don't overwhelm users — 3-5 bullets is the sweet spot
export const CHANGELOG: ChangelogEntry[] = [
    {
        id: 'v1.17.0',
        version: '1.17.0',
        date: '2026-07-12',
        title: 'ALOA Research Mode, DraftPro Upgrades & Document Export',
        description: 'Major AI enhancements including a dedicated Research mode with multi-step reasoning and citations. DraftPro gets watermarks, focus mode, configurable page numbering, and DOCX export. Live web querying lets ALOA read external URLs.',
        features: [
            { icon: 'brain', label: 'ALOA Research Mode', text: 'New 4th AI mode (Auto/Flash/Pro/Research) with multi-step reasoning, jurisdiction detection, inline citations, and anti-hallucination guardrails. Dynamic status messages replace the static "Thinking…" placeholder.' },
            { icon: 'search', label: 'Live Web Querying', text: 'Paste a URL into ALOA chat and the AI fetches and reads the page content — no more copy-pasting text from external websites. Handles paywalls and errors gracefully.' },
            { icon: 'pen', label: 'DraftPro: Watermarks & Page Numbers', text: 'Add DRAFT, CONFIDENTIAL, or WITHOUT PREJUDICE watermarks. Page numbers are now fully configurable — toggle on/off, choose position, format, and starting number.' },
            { icon: 'pen', label: 'DraftPro: Focus Mode & DOCX Export', text: 'Press F11 to hide the ribbon for distraction-free drafting. Export documents directly as .docx files that open in Microsoft Word or Google Docs.' },
            { icon: 'shield', label: '2FA Lockout Prevention', text: 'Admins can now disable 2FA for locked-out users from Account Recovery. Users see a clear warning with recovery instructions when 2FA is enabled.' },
            { icon: 'bolt', label: 'User Management Separation', text: 'Team members (Admin/Lawyer/Paralegal) and portal users (Clients/Residents) are now in separate lists — team in Firm Settings, portal users in Portal Access.' },
            { icon: 'theme', label: 'Settings Cleanup', text: 'Removed product type selector, invoice color picker, ChakraHQ pricing tiers, and duplicate changelog from AI settings. Notifications consolidated into one place.' },
        ],
    },
    {
        id: 'v1.16.0',
        version: '1.16.0',
        date: '2026-07-08',
        title: 'AI Upgrades, Trust Accounting & Visitor Management',
        description: 'Major AI improvements including file uploads in chat, PII Shield visibility, color-coded placeholders, and litigation document skeletons. New Trust Account module and Visitor Management System for gated estates.',
        features: [
            { icon: 'chat', label: 'File Uploads in AI Chat', text: 'Attach documents, images, and PDFs directly in ALOA/ARIA chat. Files render as thumbnails or file chips in the conversation.' },
            { icon: 'shield', label: 'PII Shield Badge', text: 'When PII is detected and stripped before AI processing, a visible badge shows exactly what was removed — with expandable details showing masked originals and replacements.' },
            { icon: 'pen', label: 'Color-Coded Placeholders', text: 'DraftPro placeholders are now color-coded by category: blue (parties), purple (dates), green (financial), teal (location), rose (court), indigo (firm), amber (free text).' },
            { icon: 'bolt', label: 'Auto-Fill from Matter', text: 'Fill Blanks modal now has an "Auto-fill from matter" button that pulls client name, suit number, court name, and firm details automatically.' },
            { icon: 'document', label: 'Litigation Skeletons', text: '8 Nigerian litigation document templates with mandatory boilerplate, section ordering, and never-omit checklists: Affidavit, Motion on Notice, Motion Ex Parte, Statement of Claim/Defence, Witness Statement, Written Address, Recovery of Premises.' },
            { icon: 'shield', label: 'Trust Accounting', text: 'Toggleable trust account ledger in Financials. Record deposits, withdrawals, and transfers with running balance tracking. Enable in Settings → Firm.' },
            { icon: 'portal', label: 'Visitor Management System', text: 'Gated estate residents generate 6-digit visitor access codes. Gatekeepers verify at the gate with a lightweight interface. Dual WhatsApp delivery, offline fallback, grace periods.' },
            { icon: 'bolt', label: 'AI Request Queue', text: 'Deterministic sequential processing — no more race conditions or out-of-order responses. 15-second timeout prevents UI freezes on mobile.' },
        ],
    },
    {
        id: 'v1.15.0',
        version: '1.15.0',
        date: '2026-06-23',
        title: 'Unified Messaging Engine, Portal Redesign & Ticketing System',
        description: 'A complete overhaul of the portal experience and messaging system. Portal users now have a premium card-based dashboard, individual ticket management within conversations, and the ability to cancel requests with notes. The admin side gets a unified All Conversations inbox with inline ticket controls, delegation to team members, sub-threading per ticket, and smart notification delivery.',
        features: [
            { icon: 'portal', label: 'Premium Portal Dashboard', text: 'Both Client and Resident portals now feature a card-based dashboard with hero card, financial summary, quick services grid, and recent activity — emulating a premium executive planner aesthetic.' },
            { icon: 'chat', label: 'Unified All Conversations', text: 'Team Chat and WhatsApp & Email tabs have been merged into a single All Conversations stream. Every dialog — portal messages, tickets, internal team chat, and sent scheduled messages — lives in one unified inbox with color-coded type badges and role filters.' },
            { icon: 'bolt', label: 'Inline Ticket Controls', text: 'Ticket status pills (Received → Progress → Addressed → Closed) and assign-to-team-member dropdowns are now embedded directly inside the message bubble that originated the ticket. No more split-view redundancy. Each ticket in a conversation has independent controls.' },
            { icon: 'shield', label: 'Sub-Threading Per Ticket', text: 'Admins can reply within a specific ticket\'s sub-thread, keeping multiple issues in one conversation neatly organized. Threaded replies render as indented sub-threads beneath the originating ticket message.' },
            { icon: 'pen', label: 'Portal Request Cancellation', text: 'Portal users can cancel their own open tickets and service requests with a required reason note. The admin is automatically notified via a portal message in the conversation thread.' },
            { icon: 'portal', label: 'Image & Video Uploads', text: 'Portal users can attach photos, short videos, and PDFs to their service requests. Image attachments render as thumbnails in the conversation thread. Especially useful for maintenance tickets showing the issue visually.' },
            { icon: 'theme', label: 'Platinum Calendar', text: 'The calendar module has been overhauled with a premium aesthetic: soft grid lines, pill-shaped event indicators, a pulsing current-time playhead with timestamp badge, and golden-ratio spacing throughout.' },
            { icon: 'shield', label: 'Haptic Feedback & Biometric Unlock', text: 'The Android APK now supports haptic feedback on button taps, tab changes, and form submissions. Biometric unlock (fingerprint/face) is available after enabling Remember Me on login.' },
            { icon: 'bolt', label: 'Smart Notification Delivery', text: 'When a portal user submits a ticket or message, admins receive an in-app notification AND an email — but only if push notifications aren\'t enabled. Smart delivery: push OR email, not both. New notification types for all portal inbound events.' },
        ],
    },
    {
        id: 'v1.14.0',
        version: '1.14.0',
        date: '2026-06-11',
        title: 'DraftPro Clipboard Fix & Portal Login Overhaul',
        description: 'DraftPro now copies cleanly to Microsoft Word and Google Docs with bold, italic, and underline formatting preserved — no more dark background rectangles. Portal login pages now authenticate directly and sport a refined brand-consistent header.',
        features: [
            { icon: 'pen', label: 'Clean Copy to Word', text: 'Select text in DraftPro, copy it, and paste directly into Word or Google Docs. Formatting carries over cleanly — bold, italic, underline, font family, and font size are all preserved. No need for "Paste Plain Text" anymore.' },
            { icon: 'shield', label: 'Placeholder Print Guard', text: 'DraftPro now blocks printing until every blank placeholder in your document is filled. You will never accidentally print or send a document with unfilled fields — the Smart Fill modal opens automatically.' },
            { icon: 'portal', label: 'Direct Portal Login', text: 'The Client Portal and Residents\' Portal login pages now sign you in directly using the email and password fields on the page — no extra modal popup. Enter your credentials and go straight to your portal.' },
        ],
    },
    {
        id: 'v1.13.0',
        version: '1.13.0',
        date: '2026-05-28',
        title: 'Brand Consistency & DraftPro Description Refresh',
        description: 'We unified the PracticePro brand across every surface — the landing page, portal headers, and app footer now use identical logo sizing, typography, and product badge colours. The DraftPro feature description now accurately reflects its placeholder safety guardrails.',
        features: [
            { icon: 'theme', label: 'Unified Brand Header', text: 'Portal login pages now display the PracticePro VEGA / ATRIUM brand in the same size and position as the main landing page header. Logo, text sizing, and product badge colours are pixel-consistent across all surfaces.' },
            { icon: 'pen', label: 'DraftPro Description Update', text: 'The landing page now describes DraftPro\'s placeholder guardrails instead of the old "what you see is what you print" phrasing. The new copy highlights the safety feature: printing is blocked until all blanks are filled.' },
            { icon: 'bolt', label: 'Selection Colour Fix', text: 'Fixed the dark selection highlight in DraftPro that was causing text selection to appear as a dark rectangle. The editor now uses a standard light-blue selection colour that matches the always-white page background.' },
        ],
    },
    {
        id: 'v1.12.0',
        version: '1.12.0',
        date: '2026-04-03',
        title: 'Enterprise Architecture & Universal Ingestion',
        description: 'PracticePro has completed its enterprise architecture audit, separating our platform administration into a secure secondary app. We have also unified our AI document pipeline.',
        features: [
            { icon: 'shield', label: 'Domain Separation', text: 'Firm and User data are now architecturally distinct from platform administration. We\'ve fully separated the Indexing Dashboard for maximum security and reduced main-app bundle size.' },
            { icon: 'document', label: 'Universal Document Ingestion', text: 'The new ingestion engine now parses raw PDFs, Word documents, and image frames directly. Our AI autonomously categorizes and extracts judgments, statutes, and rules.' },
            { icon: 'theme', label: 'Brand & UX Consistency', text: 'We\'ve instituted pixel-perfect brand alignment across all surfaces, bringing polished SVG icons, unified dark-mode logic, and a single source of truth for the PracticePro design system.' },
        ],
    },
    {
        id: 'v1.11.0',
        version: '1.11.0',
        date: '2026-03-31',
        title: 'Legal Intelligence Engine & Unified Backend',
        description: 'PracticePro now features a production-grade Procedural Intelligence engine. We have unified our architecture to bring court rules, statutes, and case law directly into your firm\'s database for fast, bandwidth-efficient research.',
        features: [
            { icon: 'shield', label: 'Unified Legal Repository', text: 'All legal modules (Lagos HC Rules, FHC Rules, NWLR) are now hosted natively in your firm\'s Convex environment. Reduced cross-service latency and significantly lower data bandwidth usage.' },
            { icon: 'brain', label: 'Procedural Awareness', text: 'ALOA is now aware of specific Nigerian court rules. It can provide step-by-step guidance for originating processes, motions, and enforcement based on verified legal modules.' },
            { icon: 'search', label: 'Usage Analytics & Tracking', text: 'Firm administrators can now track module usage and AI token consumption via the new Legal Intelligence tab in the ppIndex dashboard.' },
        ],
    },
    {
        id: 'v1.10.0',
        version: '1.10.0',
        date: '2026-03-24',
        title: 'ARIA: Your Administrative Assistant',
        description: 'ALOA is stepping out of the library and into the office. It now understands your entire firm\'s schedule and can assist with team availability, tasks, and scheduling.',
        features: [
            { icon: 'calendar', label: 'Top-Level Scheduling Intelligence', text: 'ARIA now has a 14-day chronological radar. Ask "Who is free next week?" and it will cross-reference your team\'s calendar and provide availability insights.' },
            { icon: 'bolt', label: 'Instant Task Delegation', text: 'Ask ARIA to schedule a meeting with a client or delegate a task to a team member based on their schedule, and it will immediately prep the required workflow forms for you.' },
            { icon: 'brain', label: 'Contextual Matter Awareness', text: 'When you talk to ARIA while viewing a Matter Dashboard, it automatically pulls in all relevant pending tasks, events, and documents to give you hyper-specific insights without you having to ask.' },
        ],
    },
    {
        id: 'v1.9.0',
        version: '1.9.0',
        date: '2026-03-16',
        title: 'Unified Note Taker & ARIA UI',
        description: 'ARIA and the Note Taker are now seamlessly synced. Experience a smooth transition between legal research and memo drafting, tailored for premium mobile use.',
        features: [
            { icon: 'bolt', label: 'Zero-Jank Switching', text: 'Switching to Quick Note mode no longer causes layout jumps. The entire interface stays locked and steady.' },
            { icon: 'bolt', label: 'Mobile-First Controls', text: 'Redesigned header and footer spacing ensures buttons are optimally sized and placed for both thumb navigation on mobile and precision on desktop.' },
            { icon: 'brain', label: 'Enhanced Voice Engine', text: 'Live transcription feedback and voice activity visualization are now integrated directly into the unified editor, with improved secure-context handling.' },
        ],
    },
    {
        id: 'v1.8.0',
        version: '1.8.0',
        date: '2026-03-15',
        title: 'Premium Brand-Matched Themes',
        description: 'Take full control of your workspace environment with our new custom-designed display themes. Perfect for late-night drafting and mobile battery saving.',
        features: [
            { icon: 'theme', label: 'Dark Mode Evolved', text: 'Introducing OLED Black and Midnight Royal – deeply-contrasted experiences that pair gorgeously with your firm colors, alongside a fun Neon Cyber mode.' },
            { icon: 'theme', label: 'Light Mode Evolved', text: 'Working in bright spaces? Try our new Solarized Soft and City Lights themes, easing eye-strain for long legal reading sessions.' },
            { icon: 'bolt', label: 'Polished Navigation', text: 'Smoothed out workspace selection interactions and ensured typography scaling responds flawlessly across the UI.' },
        ],
    },
    {
        id: 'v1.7.0',
        version: '1.7.0',
        date: '2026-03-15',
        title: 'Matter Review Reminders, Brief & Document Overhaul',
        description: 'Matter cards now carry inline review reminder controls, the Brief page has been redesigned for clarity, and the document repository more intuitively links files to court processes.',
        features: [
            { icon: 'calendar', label: 'Review Reminders on Matter Cards', text: 'Set, view, and dismiss review reminders directly from a matter card. The control is hidden until you hover, and disappears once you mark it done.' },
            { icon: 'document', label: 'Brief Page Redesigned', text: 'The Brief view is now cleaner and less cluttered. Filed processes and the document repository are laid out so you can clearly associate documents to specific court steps.' },
            { icon: 'bolt', label: 'Smart Matter Ingestion Fixed', text: 'The migration wizard no longer hangs on contact creation or matter ID referencing. Begin Migration now completes reliably end-to-end.' },
            { icon: 'brain', label: 'Research Notes Refined', text: 'Research Notes is the default tab. The toggle no longer displays a redundant label beneath the Research header — navigation is now consistent with Case Law behaviour.' },
        ],
    },
    {
        id: 'v1.6.0',
        version: '1.6.0',
        date: '2026-03-04',
        title: 'Deep Intelligence & Temporal Awareness',
        description: 'ALOA is now significantly smarter. It can read full documents via ALDIA and understands exactly what date it is today to help with your schedule.',
        features: [
            { icon: 'document', label: 'ALDIA Integration', text: 'ALOA can now call the ALDIA agent tool to provide deep semantic summaries and risk analysis of your documents.' },
            { icon: 'calendar', label: 'Time Awareness', text: 'Fixed chronological context: ARIA now knows the current date and time to correctly identify upcoming matters.' },
            { icon: 'brain', label: 'Zero-Friction Brain', text: 'Memory indexing now runs silently in the background using your own Gemini key from Settings.' },
        ],
    },
    {
        id: 'v1.5.0',
        version: '1.5.0',
        date: '2026-03-04',
        title: 'ARIA Brain — Semantic Memory',
        description: 'ARIA now has long-term memory. It searches your firm\'s documents and notes semantically, giving answers grounded in your real case files.',
        features: [
            { icon: 'brain', label: 'AI Brain', text: 'Vector-powered semantic memory. ARIA retrieves only the most relevant context.' },
            { icon: 'search', label: 'Smart Search', text: 'Firm data is indexed automatically. Ask ARIA anything about your documents.' },
            { icon: 'shield', label: 'Firm Isolated', text: 'All memories are strictly isolated per firm. Zero cross-tenant data exposure.' },
        ],
    },
];

export interface ChangelogFeature {
    icon: keyof typeof FEATURE_ICONS;
    label: string;
    text: string;
}
export interface ChangelogEntry {
    id: string;
    version: string;
    date: string;
    title: string;
    description: string;
    features: ChangelogFeature[];
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'practicepro_last_seen_version';
const getUnseenUpdate = (): ChangelogEntry | null => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const latest = CHANGELOG[0];
    if (!latest || lastSeen === latest.id) return null;
    return latest;
};
const markSeen = (id: string) => localStorage.setItem(STORAGE_KEY, id);

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
    backdrop: {
        position: 'fixed' as const, inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pp-whats-new-in 0.25s ease',
    },
    card: {
        background: 'linear-gradient(145deg, rgba(15,15,30,0.95) 0%, rgba(20,22,40,0.95) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '22px',
        padding: '1.5rem',
        maxWidth: '400px',
        width: 'calc(100% - 2rem)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column' as const,
        color: '#e2e8f0',
        boxShadow: '0 32px 64px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative' as const,
        overflow: 'hidden',
    },
    glow: {
        position: 'absolute' as const, top: '-80px', right: '-80px',
        width: '240px', height: '240px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)',
        pointerEvents: 'none' as const,
    },
    badge: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '3px 10px 3px 8px',
        background: 'rgba(99,102,241,0.15)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: '99px',
        fontSize: '10px', fontWeight: 700, color: '#a5b4fc',
        letterSpacing: '0.08em', marginBottom: '0.85rem', textTransform: 'uppercase' as const,
    },
    badgeDot: {
        width: '5px', height: '5px', borderRadius: '50%',
        background: '#818cf8', boxShadow: '0 0 4px #818cf8',
    },
    title: {
        fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9',
        marginBottom: '0.4rem', lineHeight: 1.25,
    },
    desc: {
        fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem', lineHeight: 1.65,
    },
    featureList: {
        listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0',
        display: 'flex', flexDirection: 'column' as const, gap: '0.5rem',
    },
    featureItem: {
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '0.65rem 0.75rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
    },
    featureLabel: {
        fontWeight: 600, fontSize: '0.78rem', color: '#c4b5fd',
        display: 'block', marginBottom: '2px',
    },
    featureText: {
        display: 'block', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5,
    },
    footer: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    },
    dateText: {
        fontSize: '0.72rem', color: '#475569', letterSpacing: '0.02em',
    },
    button: {
        padding: '0.5rem 1.3rem',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))',
        border: '1px solid rgba(139,92,246,0.4)',
        borderRadius: '99px',
        color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
        letterSpacing: '0.02em',
        boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity 0.15s, transform 0.15s',
    },
};

// Inject animation keyframe once
if (typeof document !== 'undefined' && !document.getElementById('pp-whats-new-styles')) {
    const style = document.createElement('style');
    style.id = 'pp-whats-new-styles';
    style.textContent = `
    @keyframes pp-whats-new-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
    document.head.appendChild(style);
}

// ─── MODAL COMPONENT ─────────────────────────────────────────────────────────
const WhatsNewModal: React.FC<{ entry: ChangelogEntry; onClose: () => void }> = ({ entry, onClose }) => (
    <div style={S.backdrop} onClick={onClose}>
        <div style={S.card} onClick={(e) => e.stopPropagation()}>
            <div style={S.glow} />
            <div style={S.badge}>
                <div style={S.badgeDot} />
                What's New &nbsp;·&nbsp; v{entry.version}
            </div>
            <div style={S.title}>{entry.title}</div>
            <div style={S.desc}>{entry.description}</div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginRight: '-4px' }} className="custom-scrollbar">
                <ul style={S.featureList}>
                    {entry.features.map((f) => {
                        const Icon = FEATURE_ICONS[f.icon];
                        return (
                            <li key={f.label} style={S.featureItem}>
                                {Icon && <Icon />}
                                <div>
                                    <span style={S.featureLabel}>{f.label}</span>
                                    <span style={S.featureText}>{f.text}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div style={S.footer}>
                <span style={S.dateText}>
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <button
                    style={S.button}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(0.98)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                    onClick={onClose}
                >
                    Got it
                </button>
            </div>
        </div>
    </div>
);

// ─── PUBLIC COMPONENT ─────────────────────────────────────────────────────────
// Instead of forcing a full-screen modal on login, we show a small dismissible
// floater pill at the bottom of the screen. The user can:
//   - Click it → expands into the full WhatsNewModal
//   - Click the X → dismisses it (marks as seen, won't show again)
// This prevents the "overwhelming on login" problem while still informing users.
const WhatsNew: React.FC = () => {
    const [unseenEntry, setUnseenEntry] = useState<ChangelogEntry | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showFloater, setShowFloater] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            const entry = getUnseenUpdate();
            if (entry) {
                setUnseenEntry(entry);
                setShowFloater(true);
            }
        }, 1500);
        return () => clearTimeout(t);
    }, []);

    const handleOpen = () => {
        setShowModal(true);
        setShowFloater(false);
    };

    const handleDismissFloater = () => {
        if (unseenEntry) markSeen(unseenEntry.id);
        setShowFloater(false);
    };

    const handleCloseModal = () => {
        if (unseenEntry) markSeen(unseenEntry.id);
        setShowModal(false);
    };

    return (
        <>
            {/* Dismissible floater pill — bottom-LEFT to avoid obscuring the
                ALOA/ARIA FAB which lives at bottom-right. */}
            {showFloater && unseenEntry && (
                <div
                    className="fixed bottom-20 md:bottom-6 left-4 z-[9998] animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full shadow-2xl pl-4 pr-2 py-2 border border-indigo-400/30">
                        <button
                            onClick={handleOpen}
                            className="flex items-center gap-2 text-xs font-bold"
                        >
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            What's New in v{unseenEntry.version}
                        </button>
                        <button
                            onClick={handleDismissFloater}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                            aria-label="Dismiss"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Full modal — only shown when user clicks the floater */}
            {showModal && unseenEntry && (
                <WhatsNewModal entry={unseenEntry} onClose={handleCloseModal} />
            )}
        </>
    );
};

export default WhatsNew;
