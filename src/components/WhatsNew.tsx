
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

// Icon map — use these in CHANGELOG entries by name
export const FEATURE_ICONS: Record<string, React.FC> = {
    brain: IconBrain,
    search: IconSearch,
    shield: IconShield,
    document: IconDocument,
    calendar: IconCalendar,
    bolt: IconBolt,
    theme: IconTheme,
};

// ─── CHANGELOG DATA ──────────────────────────────────────────────────────────
// Add new entries at the TOP. Bump the version for every release.
// Use 'icon' to pick from FEATURE_ICONS above.
export const CHANGELOG: ChangelogEntry[] = [
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
        description: 'PracticePro now features a production-grade Procedural Intelligence engine. We have unified our architecture to bring court rules, statutes, and case law directly into your firm\'s database for lightning-fast, bandwidth-efficient research.',
        features: [
            { icon: 'shield', label: 'Unified Legal Repository', text: 'All legal modules (Lagos HC Rules, FHC Rules, NWLR) are now hosted natively in your firm\'s Convex environment. Zero cross-service latency and 99% reduction in data bandwidth.' },
            { icon: 'brain', label: 'Procedural Awareness', text: 'ALOA is now aware of specific Nigerian court rules. She can provide step-by-step guidance for originating processes, motions, and enforcement based on verified legal modules.' },
            { icon: 'search', label: 'Usage Analytics & Tracking', text: 'Firm administrators can now track module usage and AI token consumption via the new Legal Intelligence tab in the ppIndex dashboard.' },
        ],
    },
    {
        id: 'v1.10.0',
        version: '1.10.0',
        date: '2026-03-24',
        title: 'ALOA: The Perfect Administrative Assistant',
        description: 'ALOA is stepping out of the library and into the office. She now understands your entire firm\'s schedule and can perfectly manage team availability, tasks, and scheduling.',
        features: [
            { icon: 'calendar', label: 'Top-Level Scheduling Intelligence', text: 'ALOA now has a 14-day chronological radar. Ask "Who is free next week?" and she will instantly cross-reference your team\'s entire calendar and give you accurate availability.' },
            { icon: 'bolt', label: 'Instant Task Delegation', text: 'Ask ALOA to schedule a meeting with a client or delegate a task to a team member based on their schedule, and she will immediately prep the required workflow forms for you.' },
            { icon: 'brain', label: 'Contextual Matter Awareness', text: 'When you talk to ALOA while viewing a Matter Dashboard, she automatically pulls in all relevant pending tasks, events, and documents to give you hyper-specific insights without you having to ask.' },
        ],
    },
    {
        id: 'v1.9.0',
        version: '1.9.0',
        date: '2026-03-16',
        title: 'Unified Note Taker & ALOA UI',
        description: 'ALOA and the Note Taker are now perfectly synced. Experience a seamless, zero-layout-shift transition between legal research and memo drafting, tailored for premium mobile use.',
        features: [
            { icon: 'bolt', label: 'Zero-Jank Switching', text: 'Switching to Quick Note mode no longer causes layout jumps. The entire interface stays locked and steady.' },
            { icon: 'bolt', label: 'Mobile-First Controls', text: 'Redesigned header and footer spacing ensures buttons are perfectly sized and placed for both thumb navigation on mobile and precision on desktop.' },
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
        description: 'ALOA is now significantly smarter. She can read full documents via ALDIA and understands exactly what date it is today to help with your schedule.',
        features: [
            { icon: 'document', label: 'ALDIA Integration', text: 'ALOA can now call the ALDIA agent tool to provide deep semantic summaries and risk analysis of your documents.' },
            { icon: 'calendar', label: 'Time Awareness', text: 'Fixed chronological context: ALOA now knows the current date and time to correctly identify upcoming matters.' },
            { icon: 'brain', label: 'Zero-Friction Brain', text: 'Memory indexing now runs silently in the background using your own Gemini key from Settings.' },
        ],
    },
    {
        id: 'v1.5.0',
        version: '1.5.0',
        date: '2026-03-04',
        title: 'ALOA Brain — Semantic Memory',
        description: 'ALOA now has long-term memory. She searches your firm\'s documents and notes semantically, giving answers grounded in your real case files.',
        features: [
            { icon: 'brain', label: 'AI Brain', text: 'Vector-powered semantic memory. ALOA retrieves only the most relevant context.' },
            { icon: 'search', label: 'Smart Search', text: 'Firm data is indexed automatically. Ask ALOA anything about your documents.' },
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
const WhatsNew: React.FC = () => {
    const [entry, setEntry] = useState<ChangelogEntry | null>(null);
    useEffect(() => {
        const t = setTimeout(() => setEntry(getUnseenUpdate()), 1200);
        return () => clearTimeout(t);
    }, []);
    const handleClose = () => {
        if (entry) markSeen(entry.id);
        setEntry(null);
    };
    if (!entry) return null;
    return <WhatsNewModal entry={entry} onClose={handleClose} />;
};

export default WhatsNew;
