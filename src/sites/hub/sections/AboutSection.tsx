/**
 * AboutSection — the W18 who-we-are, restored + the people restored.
 *
 * R33 (owner: "you have started removing human beings from the sites
 * … we need to do a personalization so we are selling to real people"):
 * the section carries the team's photograph again — faces beside the
 * facts. The photo sits in the section's own surface language (rounded
 * 2xl, hairline border, soft shadow) with a warm scrim caption, stacked
 * above the at-a-glance card so the right column reads: the people,
 * then the record.
 */
import React from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';
import { CheckIcon, MapPinIcon, ShieldCheckIcon, ZapIcon } from '../../../constants';

// ─── WHO WE ARE (corporate hub) — about the company ────────────────────────
// Where "Lagos, Nigeria" legitimately lives: not as a top-of-page eyebrow,
// but as the company's identity — a software company that runs its own
// products in production, which is the credibility pitch for client builds.

const ABOUT_FACTS: Array<{
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        text: '3 systems live in production — Vega, Atrium and Kozy Care',
        Icon: CheckIcon,
    },
    {
        text: 'Payments, messaging, portals and AI automation shipping today, not planned',
        Icon: ZapIcon,
    },
    {
        text: 'NDPA 2023-aligned data handling, encrypted in transit and at rest',
        Icon: ShieldCheckIcon,
    },
    {
        text: 'Working with businesses across Nigeria and beyond — wherever a process needs a system',
        Icon: MapPinIcon,
    },
];

export const AboutSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    // W10: the section settles in as a cascade — eyebrow, headline and each
    // paragraph arrive in sequence, then the facts card rises after the
    // copy (the old single-block reveal read as bland).
    const leftRef = useScrollReveal<HTMLDivElement>();
    const cardRef = useScrollReveal<HTMLDivElement>();
    // R33: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    return (
        <section id="about" className="py-16 sm:py-24" style={{ background: 'var(--color-paper)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-6xl mx-auto items-center">
                    <div ref={leftRef} className="w9-reveal-stagger">
                        <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-moss)' }}>
                            Who we are
                        </p>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
                            Built in Lagos.
                            <br />
                            Run in production.
                        </h2>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                PracticePro Systems is a software company based in Lagos, Nigeria. We build
                                the systems businesses use to manage their affairs — the daily operating
                                software that tracks the work, moves the money, talks to the customers and
                                keeps the records straight.
                            </p>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                We don&apos;t just build systems for other people — we run two products
                                of our own, every working day. Vega serves Nigerian law firms and
                                Atrium serves property portfolios. That means the foundations a
                                client system stands on — payments, messaging, portals, automation,
                                security — are already in production, not on a roadmap.
                            </p>
                            <p className="text-slate-600 leading-[1.75]">
                                That is the difference between a software vendor and a software partner:
                                we live with the consequences of our engineering, in products we operate
                                ourselves. And when a business needs something that doesn&apos;t exist
                                yet — in any industry, anywhere — we build that too.
                            </p>
                    </div>
                    {/* R33: the people — the team's photograph above the
                        record. Selling to real people starts with showing
                        them. Scrim caption composed ON the image (the
                        Atrium hero's legibility treatment, not decoration). */}
                    <div ref={cardRef} className="w9-reveal flex flex-col" style={{ '--w9-d': '420ms' } as React.CSSProperties}>
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6">
                            <img
                                src={`/assets/landing/people/hub-team.jpg?v=${buildSha}`}
                                alt="The PracticePro Systems team collaborating around a table in the Lagos office"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-64 sm:h-72 object-cover"
                            />
                            {/* Photographic scrim — legibility, never decoration */}
                            <div
                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pt-14"
                                aria-hidden="true"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-5">
                                <p className="text-white text-sm font-bold tracking-tight">
                                    The team in Lagos
                                </p>
                                <p className="text-white/85 text-xs leading-relaxed mt-1">
                                    Design, engineering and support — the people your business
                                    will actually work with.
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 flex flex-col flex-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">PracticePro Systems at a glance</p>
                            <ul className="space-y-6 flex-1">
                                {ABOUT_FACTS.map((f, i) => (
                                    <li key={i} className="flex items-start gap-4">
                                        <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                                            <f.Icon className="w-5 h-5" />
                                        </span>
                                        <span className="text-sm leading-[1.7] text-slate-700">{f.text}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="border-t border-slate-100 mt-8 pt-6">
                                <Button
                                    variant="bare"
                                    onClick={onContactSales}
                                    className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors min-h-[2rem] inline-flex items-center gap-1.5"
                                >
                                    Talk to us <span aria-hidden="true">→</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
