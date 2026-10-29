import React, { useState } from 'react';
import { Button, Select } from '../../../components/ui';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaAIDrafting — /vega's AI band (R38 daylight edition; reworked R40).
 *
 * R40 (owner direction): the hand-built "evening exchange" chat mockup
 * is RETIRED — "we don't need that fake version of ALOA; let's have the
 * actual live captures." The band now carries two REAL captures of the
 * running product: ALOA open in the workspace (suggestions, disclaimer,
 * the live Financials behind it) and THE DRAW-OUT — the moment a tool
 * call opens a working form: the New Contact drawer slid out over the
 * chat, the same drawer ALOA's create_contact / create_matter /
 * create_event tools open (mapToolToModal in AloaChat.tsx). Nothing is
 * staged; both frames are screenshots of the shipping app.
 *
 * Lower in the band sit the PULLOUTS: three expandable mini-demos of the
 * instruments the copy claims — the deadline computer, the drafting
 * studio, the 7·3·1 reminder cadence — each a working form (pick a
 * court, a document, a hearing date) whose readout mirrors the shipped
 * arithmetic (proceduralRules.ts, courtCalculator.ts, the reminder
 * engine).
 *
 * Interactive controls use the ui/Button and ui/Select primitives
 * (ADR-0004), never raw elements.
 */

/* ── The capability index — shipped copy, verbatim ── */

const ALOA_CAPABILITIES = [
    {
        title: 'Legal Drafting & Analysis',
        body: "Draft writs, affidavits, and motions with Nigerian court-specific formatting. Analyze opposing counsel's arguments, identify weaknesses, and research locus classicus across jurisdictions.",
        features: ['DraftPro editor with A4 pagination', 'Nigerian citation formats (NWLR, NSC)', 'Cross-jurisdictional analysis with caveats'],
    },
    {
        title: 'PII Shield',
        body: 'Client names, phone numbers, NIN, BVN, and bank accounts are automatically stripped before AI processing. Your client data never trains external models. NDPA 2023 compliant.',
        features: ['Email & phone stripping', 'NIN/BVN/credit card detection', 'Nigerian bank account masking'],
    },
    {
        title: 'Firm-Grade Security',
        body: "Your firm's data is fully isolated from every other organization on the platform. AI queries only access your matters, your documents, and your clients. No cross-organization data leakage — ever.",
        features: ['Complete data isolation between organizations', 'Role-based team access controls', 'Full audit trail on all AI activity'],
    },
];

/* ── The pullouts — working mini-demos of the claimed instruments ── */

/** Formats a date as "21 Dec 2026" — the page's mono date voice. */
const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** DEADLINE COMPUTER — the Court Rules Agent's arithmetic, mirrored from
 *  proceduralRules.ts: Defence windows by court; <7-day windows count
 *  business days (courtCalculator.ts) — the 42/30/14-day windows are
 *  calendar-day counts, stated as such. Anchor: the chronology exhibit's
 *  own service date (09 Nov 2026). */
const SERVICE_DATE = new Date(2026, 10, 9); // 09 Nov 2026 — the chronology's service event
const DEADLINE_COURTS = [
    { value: 'lagos', label: 'High Court of Lagos State — HCCPR 2019', days: 42, rule: 'Order 27, HCCPR 2019 — defence and counterclaim', calendarDays: true },
    { value: 'fhc', label: 'Federal High Court — FHC (Civil Procedure) Rules', days: 30, rule: 'FHC (Civil Procedure) Rules — entry of appearance and defence', calendarDays: true },
    { value: 'nicn', label: 'National Industrial Court — NICN Rules', days: 14, rule: 'NICN (Civil Procedure) Rules 2017 — statement of defence', calendarDays: true },
] as const;

/** DRAFTING STUDIO — DraftPro's caption block, per document type. The
 *  blanks are the guardrails: printing stays blocked until they fill. */
const DRAFT_DOCS = [
    {
        value: 'writ',
        label: 'Writ of Summons',
        caption: 'IN THE HIGH COURT OF LAGOS STATE\nIN THE IKEJA JUDICIAL DIVISION\nHOLDEN AT LAGOS\n\nSUIT NO. IKD/____/2026\n\nBETWEEN\nCHIOMA OKAFOR — Claimant\nAND\nMERIDIAN LOGISTICS LTD — Defendant',
        guard: 'Endorsement and claim statement attach before filing — Pre-Action Protocol Form 01 accompanies the writ in Lagos.',
    },
    {
        value: 'motion',
        label: 'Motion on Notice',
        caption: 'IN THE HIGH COURT OF LAGOS STATE\nIN THE IKEJA JUDICIAL DIVISION\n\nSUIT NO. IKD/1287/2026\n\nTAKE NOTICE that this Honourable Court will be moved on the ____ day of ______, 2026\n\nPRAYING for leave to amend the statement of claim…',
        guard: 'The supporting affidavit and written address are dated and served — every blank filled before the Registry receives it.',
    },
    {
        value: 'affidavit',
        label: 'Affidavit in Support',
        caption: 'IN THE HIGH COURT OF LAGOS STATE\nIN THE IKEJA JUDICIAL DIVISION\n\nSUIT NO. IKD/1287/2026\n\nI, CHIOMA OKAFOR, of ______________, Lagos State, make oath and state as follows:\n1. That I am the Claimant in this suit…',
        guard: 'The deponent\u2019s facts are sworn at the Registry — pagination and jurat set to Nigerian court practice.',
    },
] as const;

/** REMINDER CADENCE — the 7·3·1 engine: three fixed offsets off the
 *  adjourned date, by email and in-app, to assigned counsel. */
const HEARINGS = [
    { value: 'fri13', label: 'Friday, 13 Nov 2026 — amendment hearing, Ikeja', date: new Date(2026, 10, 13) },
    { value: 'mon23', label: 'Monday, 23 Nov 2026 — pre-trial conference', date: new Date(2026, 10, 23) },
    { value: 'thu10', label: 'Thursday, 10 Dec 2026 — trial continues', date: new Date(2026, 11, 10) },
] as const;

/** The pullout accordion row. */
const PulloutRow: React.FC<{
    num: string;
    title: string;
    line: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ num, title, line, open, onToggle, children }) => (
    <div className="border-b border-vega-night/10">
        <Button
            variant="bare"
            fullWidth
            aria-expanded={open}
            onClick={onToggle}
            className={`w-full flex items-baseline gap-4 sm:gap-6 py-5 px-2 sm:px-4 text-left transition-colors duration-150 hover:bg-vega-gilt/[0.04] active:bg-vega-gilt/[0.08] focus-visible:ring-vega-gilt ${
                open ? 'bg-vega-gilt/[0.04]' : ''
            }`}
        >
            <span className="font-mono text-xs tracking-widest text-vega-gilt-bright flex-shrink-0">{num}</span>
            <span className="font-vega text-lg sm:text-xl font-semibold text-vega-night flex-1 min-w-0">
                {title}
                <span className="block sm:hidden font-sans text-sm font-normal leading-[1.6] text-slate-600 mt-1">{line}</span>
            </span>
            <span className="hidden sm:block flex-[1.3] text-sm leading-[1.6] text-slate-600 min-w-0">{line}</span>
            <span className="relative inline-block w-3 h-3 flex-shrink-0 translate-y-[-2px]" aria-hidden="true">
                <span className="absolute top-1/2 left-0 w-3 h-px bg-vega-gilt-bright -translate-y-1/2" />
                {!open && <span className="absolute left-1/2 top-0 h-3 w-px bg-vega-gilt-bright -translate-x-1/2" />}
            </span>
        </Button>
        {open && (
            <div className="px-2 sm:px-4 pb-8 pt-2 panel-in origin-top">{children}</div>
        )}
    </div>
);

/** A mini form readout — the computed exhibit inside a pullout. */
const DemoReadout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="rounded-[14px] border border-vega-night/12 bg-vega-parchment p-5 sm:p-6 shadow-[0_14px_30px_-20px_rgb(42_33_24/0.30)]">
        {children}
    </div>
);

const selectCls =
    'w-full rounded-lg border border-vega-night/20 bg-white px-3.5 py-2.5 text-sm text-vega-night font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-vega-gilt focus-visible:border-vega-gilt cursor-pointer';

export const VegaAIDrafting: React.FC = () => {
    // The pullouts — one open at a time, like the bound index above.
    const [openDemo, setOpenDemo] = useState<number | null>(0);
    // Demo A — the deadline computer.
    const [court, setCourt] = useState<string>(DEADLINE_COURTS[0].value);
    const courtDef = DEADLINE_COURTS.find((c) => c.value === court) ?? DEADLINE_COURTS[0];
    const defenceDue = new Date(SERVICE_DATE.getTime() + courtDef.days * 86400000);
    // Demo B — the drafting studio.
    const [doc, setDoc] = useState<string>(DRAFT_DOCS[0].value);
    const docDef = DRAFT_DOCS.find((d) => d.value === doc) ?? DRAFT_DOCS[0];
    // Demo C — the 7·3·1 reminder cadence.
    const [hearing, setHearing] = useState<string>(HEARINGS[0].value);
    const hearingDef = HEARINGS.find((h) => h.value === hearing) ?? HEARINGS[0];
    const minus = (d: Date, n: number) => new Date(d.getTime() - n * 86400000);

    return (
        <section
            id="ai-capabilities"
            aria-labelledby="vega-ai-heading"
            className="py-20 md:py-28 border-t border-vega-night/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
                {/* Section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    II — Drafting Intelligence
                </p>
                <h2
                    id="vega-ai-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
                >
                    Powered by ALOA. Built for{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">Nigerian law.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                    Your AI legal copilot drafts documents, researches precedents,
                    and analyzes cases — with privacy-first architecture that keeps
                    client data safe.
                </p>

                {/* The exhibits (R40): two REAL captures of the running
                    product — no mockups. Left: ALOA open in the workspace.
                    Right: the draw-out — a tool call opening a working
                    form, the New Contact drawer over the chat. */}
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start max-w-6xl mb-6 md:mb-8">
                    <VegaAppShot
                        src="/assets/landing/app/vega-aloa.jpg"
                        alt="ALOA open in the live Vega workspace over the Financials view — suggestions, disclaimer, the running product"
                        caption="LIVE CAPTURE — ALOA IN THE RUNNING WORKSPACE, OVER FINANCIALS"
                    />
                    <VegaAppShot
                        src="/assets/landing/app/vega-aloa-drawout.jpg"
                        alt="The draw-out — ALOA's tool call slides the New Contact form out over the chat, in the live workspace"
                        caption="LIVE CAPTURE — THE DRAW-OUT: A TOOL CALL OPENS A WORKING FORM"
                    />
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-600 max-w-6xl mb-16 md:mb-20 border-b border-vega-night/10 pb-5">
                    ASK FOR A CONTACT, A MATTER, A TASK, A HEARING — ALOA DRAFTS THE RECORD AND SLIDES THE FORM OUT, PRE-FILLED. NOTHING STAGED; BOTH FRAMES ARE THE SHIPPING APP.
                </p>

                {/* The capability index — ruled, not carded */}
                <div className="max-w-6xl mb-16 md:mb-20">
                    <p className="font-mono text-2xs tracking-widest text-slate-600 border-b border-vega-night/10 pb-3 mb-2">
                        ALOA — ADVANCED LEGAL OFFICE ASSISTANT
                    </p>
                    <ol className="divide-y divide-vega-night/10">
                        {ALOA_CAPABILITIES.map((cap, i) => (
                            <li key={cap.title} className="py-7 first:pt-6 last:pb-0">
                                <div className="flex items-baseline gap-4 mb-3">
                                    <span className="font-mono text-xs tracking-widest text-vega-gilt-bright">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="font-vega text-xl font-semibold text-vega-night">
                                        {cap.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed mb-4 pl-8">
                                    {cap.body}
                                </p>
                                <ul className="space-y-2 pl-8">
                                    {cap.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                                            <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright mt-[7px] flex-shrink-0" aria-hidden="true" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* THE PULLOUTS — lower in the band, off the main graphic
                    (owner direction): openable working demos of the
                    instruments the copy claims. Each is a real form; each
                    readout mirrors the shipped arithmetic. */}
                <div className="max-w-6xl">
                    <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                        The Instruments, in Miniature — Open a Demo
                    </p>
                    <h3 className="font-vega text-2xl md:text-3xl font-semibold leading-[1.15] tracking-[-0.01em] mb-4 text-vega-night">
                        Try the arithmetic yourself.
                    </h3>
                    <p className="text-sm md:text-base leading-[1.7] text-slate-700 max-w-2xl mb-10">
                        Three of the instruments above, in miniature. Pick a court, a
                        document, a hearing date — and watch the same computation the
                        workspace runs, arrive.
                    </p>

                    <div className="border-t border-vega-night/10">
                        {/* Demo A — the deadline computer */}
                        <PulloutRow
                            num="A"
                            title="The deadline computer"
                            line="Defence windows computed from the Civil Procedure Rules of the matter's court."
                            open={openDemo === 0}
                            onToggle={() => setOpenDemo(openDemo === 0 ? null : 0)}
                        >
                            <div className="grid lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-5 space-y-4">
                                    <Select
                                        styleVariant="bare"
                                        selectClassName={selectCls}
                                        label={<span className="font-mono text-2xs uppercase tracking-widest text-slate-600">The matter sits in</span>}
                                        labelClassName="mb-1.5"
                                        value={court}
                                        onChange={(e) => setCourt(e.target.value)}
                                        options={DEADLINE_COURTS.map((c) => ({ value: c.value, label: c.label }))}
                                    />
                                    <p className="text-sm text-slate-600 leading-[1.6]">
                                        Service on the Defendant was effected{' '}
                                        <b className="text-vega-night">{fmt(SERVICE_DATE)}</b> — the anchor
                                        event from the chronology further down this page.
                                    </p>
                                </div>
                                <div className="lg:col-span-7">
                                    <DemoReadout>
                                        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-vega-gilt-bright mb-3">
                                            Statement of Defence — due
                                        </p>
                                        <p className="font-vega text-3xl font-semibold text-vega-night mb-2">
                                            {fmt(defenceDue)}
                                        </p>
                                        <p className="text-sm text-slate-700 leading-[1.65]">
                                            {courtDef.days} days after service, counted under the{' '}
                                            {courtDef.rule}. The diary enters it the moment service is
                                            recorded — and the reminder cadence hangs off it.
                                        </p>
                                        <p className="font-mono text-2xs tracking-widest text-slate-600 mt-4">
                                            DEMO — THE COURT RULES AGENT'S OWN ARITHMETIC · 36 STATES + FCT ENCODED
                                        </p>
                                    </DemoReadout>
                                </div>
                            </div>
                        </PulloutRow>

                        {/* Demo B — the drafting studio */}
                        <PulloutRow
                            num="B"
                            title="The drafting studio"
                            line="Court-format captions with placeholder guardrails that block printing until every blank is filled."
                            open={openDemo === 1}
                            onToggle={() => setOpenDemo(openDemo === 1 ? null : 1)}
                        >
                            <div className="grid lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-5">
                                    <Select
                                        styleVariant="bare"
                                        selectClassName={selectCls}
                                        label={<span className="font-mono text-2xs uppercase tracking-widest text-slate-600">Draft a</span>}
                                        labelClassName="mb-1.5"
                                        value={doc}
                                        onChange={(e) => setDoc(e.target.value)}
                                        options={DRAFT_DOCS.map((d) => ({ value: d.value, label: d.label }))}
                                    />
                                    <p className="text-sm text-slate-600 leading-[1.6] mt-4">
                                        {docDef.guard}
                                    </p>
                                </div>
                                <div className="lg:col-span-7">
                                    <DemoReadout>
                                        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-vega-gilt-bright mb-3">
                                            DraftPro — the caption block
                                        </p>
                                        <pre className="font-mono text-2xs sm:text-xs leading-[1.9] text-vega-night whitespace-pre-wrap border-l-2 border-vega-gilt/50 pl-4">
{docDef.caption}
                                        </pre>
                                        <p className="font-mono text-2xs tracking-widest text-slate-600 mt-4">
                                            DEMO — A4 PAGINATION · NIGERIAN LEGAL FONTS · PRINT BLOCKED WHILE A BLANK REMAINS
                                        </p>
                                    </DemoReadout>
                                </div>
                            </div>
                        </PulloutRow>

                        {/* Demo C — the 7·3·1 reminder cadence */}
                        <PulloutRow
                            num="C"
                            title="The 7 · 3 · 1 cadence"
                            line="Counsel reminded seven, three and one day(s) before every hearing — email and in-app."
                            open={openDemo === 2}
                            onToggle={() => setOpenDemo(openDemo === 2 ? null : 2)}
                        >
                            <div className="grid lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-5">
                                    <Select
                                        styleVariant="bare"
                                        selectClassName={selectCls}
                                        label={<span className="font-mono text-2xs uppercase tracking-widest text-slate-600">The next hearing</span>}
                                        labelClassName="mb-1.5"
                                        value={hearing}
                                        onChange={(e) => setHearing(e.target.value)}
                                        options={HEARINGS.map((h) => ({ value: h.value, label: h.label }))}
                                    />
                                    <p className="text-sm text-slate-600 leading-[1.6] mt-4">
                                        Fired from the matter&rsquo;s adjourned date to the assigned
                                        lawyer(s) — automatically, no one sets a reminder by hand.
                                    </p>
                                </div>
                                <div className="lg:col-span-7">
                                    <DemoReadout>
                                        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-vega-gilt-bright mb-3">
                                            Reminders scheduled
                                        </p>
                                        <div className="divide-y divide-vega-night/10 border-t border-vega-night/10">
                                            {[
                                                { n: 7, d: minus(hearingDef.date, 7) },
                                                { n: 3, d: minus(hearingDef.date, 3) },
                                                { n: 1, d: minus(hearingDef.date, 1) },
                                            ].map((r) => (
                                                <div key={r.n} className="flex items-baseline justify-between py-3">
                                                    <span className="font-vega text-lg font-semibold text-vega-night">
                                                        {r.n} {r.n === 1 ? 'day' : 'days'} before
                                                    </span>
                                                    <span className="font-mono text-sm text-slate-700">{fmt(r.d)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="font-mono text-2xs tracking-widest text-slate-600 mt-4">
                                            DEMO — EMAIL + IN-APP · TO ASSIGNED COUNSEL · OFF THE ADJOURNED DATE
                                        </p>
                                    </DemoReadout>
                                </div>
                            </div>
                        </PulloutRow>
                    </div>
                </div>
            </div>
        </section>
    );
};
