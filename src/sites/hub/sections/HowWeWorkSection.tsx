/**
 * HowWeWorkSection — the W18 process timeline, restored. The spine
 * fills as you scroll and the steps walk themselves while in view.
 */
import React, { useState, useEffect } from 'react';
import { useScrollReveal } from '../hooks';
import { useSectionProgress } from '../hooks';
import { CheckBadgeIcon, ClipboardListIcon, ComputerDesktopIcon, PencilSquareIcon } from '../../../constants';

const HOW_WE_WORK: Array<{
    num: string;
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        num: '1',
        title: 'Understand your operations',
        body: 'We sit with your team and map how the business actually runs — the paperwork, the phone calls, the spreadsheets — and where the friction lives. You talk; we listen and take notes.',
        Icon: ClipboardListIcon,
    },
    {
        num: '2',
        title: 'Design the system',
        body: 'Workflows, data model, integrations and screens — designed with you and agreed before a line of code is written, so there are no surprises at handover.',
        Icon: PencilSquareIcon,
    },
    {
        num: '3',
        title: 'Build & integrate',
        body: 'We build in weekly increments and demo as we go, so your feedback lands in the product from week one — not at the end, when changes are expensive.',
        Icon: ComputerDesktopIcon,
    },
    {
        num: '4',
        title: 'Launch, train & run with you',
        body: 'We deploy, train your staff and migrate your records. Then we stay on — monitoring, supporting and iterating as the business grows.',
        Icon: CheckBadgeIcon,
    },
];

export const HowWeWorkSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    const stepsRef = useScrollReveal<HTMLDivElement>();
    // W7: a vertical timeline whose spine fills with brand gradient as the
    // visitor scrolls — the process literally draws itself.
    // W9: the process also WALKS ITSELF — steps light up in sequence while
    // the section is in view (auto-advance every 3s), each node filling with
    // the brand gradient and its card lifting, with a pulse riding the
    // leading edge of the spine fill. Scroll progress and the walk combine:
    // the spine shows whichever is further along.
    const [progress, setProgress] = useState(0);
    const [active, setActive] = useState(0);
    const onProgress = React.useCallback((p: number) => setProgress(p), []);
    const timelineRef = useSectionProgress<HTMLDivElement>(onProgress);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let inView = false;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
        }, { threshold: 0.25 });
        if (timelineRef.current) io.observe(timelineRef.current);
        const iv = window.setInterval(() => {
            if (inView) setActive((a) => (a + 1) % HOW_WE_WORK.length);
        }, 3000);
        return () => {
            io.disconnect();
            window.clearInterval(iv);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fill = Math.max(progress, (active + 1) / HOW_WE_WORK.length);
    return (
        <section id="howWeWork" className="py-16 sm:py-24 bg-white relative overflow-hidden">
            {/* W8: the FluidSeam above owns the dark→light transition now. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-moss)' }}>
                        How we work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        From first conversation to a system you scale with
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        The same process that produced Vega, Atrium and Kozy Care.
                    </p>
                </div>

                <div ref={timelineRef} className="relative max-w-3xl mx-auto">
                    <div className="absolute left-[27px] sm:left-1/2 sm:-translate-x-1/2 top-2 bottom-2 w-[3px] rounded-full bg-slate-200 overflow-visible" aria-hidden="true">
                        <div
                            className="w-full rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-primary-600 will-change-[height]"
                            style={{ height: `${Math.round(fill * 100)}%` }}
                        />
                        {/* W9: a pulse riding the leading edge of the fill. */}
                        {!reducedMotion && (
                            <span className="w9-spine-pulse" style={{ top: `${Math.round(fill * 100)}%` }} />
                        )}
                    </div>

                    <div ref={stepsRef} className="w9-reveal-stagger space-y-10 sm:space-y-14">
                        {HOW_WE_WORK.map((step, i) => (
                            <div key={step.num} className={`relative flex items-start gap-6 sm:gap-0 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                {/* Node on the spine — W9: lights up as the walk passes. */}
                                <div className="relative z-10 flex-shrink-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:flex-shrink">
                                    <span className={`w9-step-node flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-md shadow-slate-900/5 font-display text-xl font-extrabold ${i <= active ? 'is-active' : ''}`}>
                                        <span className="w9-step-num text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-primary-600">{step.num}</span>
                                    </span>
                                </div>
                                {/* Card — W9: the current step lifts. */}
                                <div className={`flex-1 sm:w-[calc(50%-3.5rem)] sm:max-w-sm ${i % 2 === 1 ? 'sm:mr-auto sm:text-right' : 'sm:ml-auto'}`}>
                                    <div className={`w9-step-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all ${i === active ? 'is-active' : ''}`}>
                                        <div className={`flex items-center gap-3 mb-3 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                            <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                                                <step.Icon className="w-5 h-5" />
                                            </span>
                                            <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">{step.title}</h3>
                                        </div>
                                        <p className="text-slate-600 text-sm leading-[1.7]">{step.body}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
