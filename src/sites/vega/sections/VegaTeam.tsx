import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaTeam — /vega's chambers band (R43).
 *
 * Owner direction (R43): "there are no live shots of the app that show
 * multiple team members logged in at the same time. I think vega
 * potential buyers/users need to know that it has a team/collaborative
 * side to it."
 *
 * The answer is not a feature list — it is the workspace itself, twice:
 * the task board with the team strip (every counsel's load, filter by
 * teammate) and a matter's discussion thread (authored, timed, kept
 * with the file). Both captures are live from the running product (the
 * same demo firm the rest of the page shows), in the page's ruled
 * daylight register. The band sits between the Suite (the instruments)
 * and the Segments (the practices) — after WHAT Vega is, before WHO it
 * is for, the natural place to say: the whole chambers is in it
 * together.
 *
 * Honest claims only: multi-user is the shipped app mode; per-counsel
 * filters, assignments and matter discussion are the shipped surfaces
 * shown. Presentational only — the ui/Button-free register of the
 * ruled page (ADR-0004 n/a, no interactive rows here).
 */

const FACTS: Array<{ title: string; detail: string }> = [
    {
        title: 'Everyone in at once',
        detail: 'The workspace is multi-user by design — counsel, clerks and admins in the same system, each with their matters and their view of the diary.',
    },
    {
        title: 'Work assigned per counsel',
        detail: 'Tasks carry their assignees; the strip above the board counts every teammate\u2019s active load, and one tap filters the board to a single lawyer.',
    },
    {
        title: 'The file discusses itself',
        detail: 'Notes on a matter are a thread — authored, timed, and kept with the file — so strategy is written where the work happens, not in a group chat.',
    },
];

export const VegaTeam: React.FC = () => (
    <section
        id="team"
        aria-labelledby="vega-team-heading"
        className="py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            {/* Section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                The Chambers — Everyone In One System
            </p>
            <h2
                id="vega-team-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
            >
                The whole team,{' '}
                <span className="font-vega-italic text-vega-gilt-bright">one workspace.</span>
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                A practice is plural. Vega is built for the whole chambers to be
                logged in at the same time — matters assigned to counsel, tasks
                carried by name, the discussion kept on the file. These captures
                are the same live system the rest of this page shows, wearing
                its team face.
            </p>

            {/* The two exhibits — the collaborative surfaces, honestly
                captioned. */}
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                <VegaAppShot
                    src="/assets/landing/app/tasks-team.jpg"
                    alt="Vega task board filtered to one counsel — the team strip above shows every member's active load"
                    caption="LIVE CAPTURE — THE TASK BOARD, FILTERED TO ONE COUNSEL. THE STRIP CARRIES EVERY TEAMMATE'S LOAD"
                />
                <VegaAppShot
                    src="/assets/landing/app/matter-notes.jpg"
                    alt="A matter's Notes tab — the discussion thread, authored and timed, kept with the file"
                    caption="LIVE CAPTURE — A MATTER'S DISCUSSION THREAD: AUTHORED, TIMED, KEPT WITH THE FILE"
                />
            </div>

            {/* The reading — three ruled facts under the exhibits. */}
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mt-12 md:mt-16 border-t border-vega-night/10">
                {FACTS.map((f, i) => (
                    <div key={f.title} className="pt-6 border-t-0 md:border-l md:border-vega-night/10 md:pl-8 md:-mt-px">
                        <p className="font-mono text-2xs tracking-widest text-vega-gilt-bright mb-3">
                            {String(i + 1).padStart(2, '0')}
                        </p>
                        <h3 className="font-vega text-lg font-semibold text-vega-night leading-snug mb-2">
                            {f.title}
                        </h3>
                        <p className="text-sm leading-[1.7] text-slate-700">
                            {f.detail}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
