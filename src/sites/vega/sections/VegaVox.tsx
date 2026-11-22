import React, { useState } from 'react';

/**
 * VegaVox — the ALOA Vox showcase band (owner spec 2026-11-22: dual-mode
 * Vox).
 *
 * Positions Vox as the all-in-one legal voice workspace — fast dictation
 * when you're drafting, structured conversation intelligence when you're
 * consulting, interviewing or debriefing — framed strictly as core,
 * shipped functionality (the owner spec forbids launch-day or
 * pre-release vocabulary on this band).
 *
 * Layout: the four capability cards (Instant Legal Dictation ·
 * Speaker-Labeled Session Capture · Automatic File Notes, Action Lists &
 * Issue Maps · Ask Aloa Vox Across Your Matter) beside an interactive
 * preview card — a recorded client consultation switching between its
 * Speaker Transcript, structured File Note and Action Checklist, so a
 * visitor grasps the whole value in three seconds.
 *
 * Register: the R56 Vega palette (light cards, indigo interactive accent,
 * slate type) and the reveal machinery — identical to VegaSuite.
 */

type PreviewTab = 'transcript' | 'file_note' | 'actions';

const PREVIEW_TABS: { key: PreviewTab; label: string }[] = [
    { key: 'transcript', label: 'Speaker transcript' },
    { key: 'file_note', label: 'File note' },
    { key: 'actions', label: 'Action checklist' },
];

const CAPABILITIES: { id: string; title: string; body: string }[] = [
    {
        id: 'dictation',
        title: 'Instant legal dictation',
        body: 'Cursor-ready speech-to-text tuned for Nigerian legal terminology — case citations, \u20A6 amounts and Latin phrases land verbatim. Speak a note anywhere; it arrives where you\u2019re drafting.',
    },
    {
        id: 'sessions',
        title: 'Speaker-labelled session capture',
        body: 'Record client intakes, witness interviews, chambers debriefs and post-hearing notes with every speaker separated, labelled and timestamped. Capture live or upload the recording — either way it survives a dead signal.',
    },
    {
        id: 'synthesis',
        title: 'File notes, action lists & issue maps',
        body: 'One tap turns the conversation into a structured file note \u2014 stated facts, client instructions, issues identified \u2014 plus a deadline checklist and an issue map that keeps admissions apart from open questions.',
    },
    {
        id: 'ask',
        title: 'Ask Aloa Vox across the matter',
        body: 'Ask questions across every recording on a client file \u2014 dates, admissions, instructions \u2014 and get answers that cite the session and the exact [MM:SS] moment they were said.',
    },
];

/** The mock consultation's transcript exhibit (the demo register the app
 *  itself uses — the Okafor boundary dispute). */
const TRANSCRIPT_TURNS: { at: string; who: string; role?: string; text: string }[] = [
    {
        at: '00:12',
        who: 'Counsel',
        role: 'me',
        text: 'Good afternoon, Mr Okafor. This consultation is being recorded so we keep an accurate file note. Please tell me what happened at the Lekki plot.',
    },
    {
        at: '00:31',
        who: 'Mr Okafor',
        role: 'client',
        text: 'Thank you, Counsel. My neighbour started extending his fence past the beacon in March. I have the survey plan my father commissioned in 2009 and photographs from January.',
    },
    {
        at: '01:02',
        who: 'Mr Okafor',
        role: 'client',
        text: 'He has offered \u20A6350,000 to settle it quietly. I told him I want the boundary restored, not money.',
    },
    {
        at: '01:24',
        who: 'Counsel',
        role: 'me',
        text: 'Understood. We\u2019ll need the original survey plan, the photographs, and your father\u2019s letters of administration before we can draft the demand letter.',
    },
];

const FILE_NOTE_SECTIONS: { heading: string; bullets: string[] }[] = [
    {
        heading: 'Stated facts',
        bullets: [
            'Client states the neighbour extended his fence past the beacon in March (at 00:31).',
            'Client holds a 2009 survey plan and January photographs of the plot.',
            'Neighbour offered \u20A6350,000 to settle privately (at 01:02).',
        ],
    },
    {
        heading: 'Client instructions',
        bullets: [
            'Client instructs that the boundary be restored \u2014 settlement money is not wanted.',
            'Client to deliver the survey plan, photographs and letters of administration.',
        ],
    },
    {
        heading: 'Legal issues identified',
        bullets: [
            'Boundary encroachment and possible trespass to land.',
            'Capacity to act on the estate\u2019s title \u2014 letters of administration [Missing Detail].',
        ],
    },
];

const ACTION_ITEMS: { task: string; owner: string; due: string }[] = [
    { task: 'Collect the 2009 survey plan and January photographs from the client', owner: 'Client', due: 'this week' },
    { task: 'Confirm letters of administration are current before drafting', owner: 'Counsel', due: 'before the demand letter' },
    { task: 'Draft the boundary-restoration demand letter', owner: 'Counsel', due: 'once documents arrive' },
];

export const VegaVox: React.FC = () => {
    const [tab, setTab] = useState<PreviewTab>('transcript');

    return (
        <section
            id="vox"
            aria-labelledby="vega-vox-heading"
            className="py-20 md:py-28 bg-white border-t border-slate-200/70"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section head — R80: the eyebrow pill is gone (owner:
                    "Can we get rid of that pill? I don't want us to have
                    that pill."), the heading leads. */}
                <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                    <h2
                        id="vega-vox-heading"
                        className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                    >
                        Your voice, on the record.{' '}
                        <span className="text-[#1E3A8A]">Your file, already written.</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                        ALOA Vox is a workspace for both ways lawyers speak: instant dictation when
                        you&rsquo;re drafting, and structured session capture when you&rsquo;re
                        consulting, interviewing or debriefing — every word attributed,
                        timestamped and filed to the matter.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-start">
                    {/* The four capability cards */}
                    <div className="grid sm:grid-cols-2 gap-5" data-vg-reveal>
                        {CAPABILITIES.map((c) => (
                            <div
                                key={c.id}
                                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                            >
                                <h3 className="font-display text-lg font-semibold leading-[1.3] tracking-tight text-slate-900 mb-2.5">
                                    {c.title}
                                </h3>
                                <p className="text-sm leading-[1.7] text-slate-600">{c.body}</p>
                            </div>
                        ))}
                    </div>

                    {/* The interactive preview — a recorded consultation
                        becoming the file. Three switchable exhibits.
                        min-w-0: the grid item must be allowed to shrink
                        below its content's nowrap min-content (the mock
                        header's truncated title) or the implicit mobile
                        grid track overflows the viewport. */}
                    <div data-vg-reveal className="min-w-0">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                {/* Mock app header */}
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">
                                            Client Intake — Okafor boundary dispute
                                        </p>
                                        <p className="text-2xs text-slate-500 mt-0.5">
                                            Client Intake · 18:24 recorded · Okafor v. Bale
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-2xs font-bold text-indigo-700 shrink-0">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                                        File ready
                                    </span>
                                </div>

                                {/* The exhibit switcher */}
                                <div className="flex gap-1.5 px-4 pt-3" role="tablist" aria-label="Vox session preview">
                                    {PREVIEW_TABS.map((t) => (
                                        <button
                                            key={t.key}
                                            role="tab"
                                            aria-selected={tab === t.key}
                                            onClick={() => setTab(t.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-[0.98] ${
                                                tab === t.key
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {/* The exhibits */}
                                <div className="p-4 min-h-[290px]">
                                    {tab === 'transcript' ? (
                                        <div className="flex flex-col gap-2.5" aria-live="polite">
                                            {TRANSCRIPT_TURNS.map((t, i) => (
                                                <div key={i} className="flex gap-2.5">
                                                    <span className="font-mono text-2xs text-indigo-700 pt-1 shrink-0 w-9">
                                                        {t.at}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-900">
                                                            {t.who}
                                                            {t.role === 'client' ? (
                                                                <span className="ml-1.5 font-normal text-slate-400">client</span>
                                                            ) : null}
                                                        </p>
                                                        <p className="text-sm leading-[1.6] text-slate-600">{t.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {tab === 'file_note' ? (
                                        <div className="flex flex-col gap-4" aria-live="polite">
                                            {FILE_NOTE_SECTIONS.map((s) => (
                                                <div key={s.heading}>
                                                    <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                                        {s.heading}
                                                    </p>
                                                    <ul className="flex flex-col gap-1.5">
                                                        {s.bullets.map((b, j) => (
                                                            <li key={j} className="flex gap-2 text-sm leading-[1.6] text-slate-600">
                                                                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
                                                                <span>{b}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {tab === 'actions' ? (
                                        <div className="flex flex-col gap-2.5" aria-live="polite">
                                            {ACTION_ITEMS.map((a, i) => (
                                                <div
                                                    key={i}
                                                    className="rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-2.5"
                                                >
                                                    <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-indigo-300 shrink-0" aria-hidden="true" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-slate-700 leading-[1.5]">{a.task}</p>
                                                        <p className="text-2xs text-slate-500 mt-1">
                                                            Owner: <span className="font-semibold text-slate-600">{a.owner}</span>
                                                            <span className="mx-1.5" aria-hidden="true">·</span>
                                                            Due: <span className="font-semibold text-indigo-700">{a.due}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <p className="text-2xs text-slate-400 mt-3 leading-relaxed">
                            A Vox session, as the firm sees it: the speaker-labelled transcript,
                            the generated file note and the extracted checklist — exportable to
                            Word in one tap. Vox is available on the Growth plan and above.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
