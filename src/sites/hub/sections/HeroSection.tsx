import React from 'react';
import { useScrollReveal } from '../hooks';

/**
 * HubHero v2 (P1 C1) — the systems studio opens with the company's plain
 * promise. Exact copy (owner direction):
 *   H1:  "We build the systems your business runs on."
 *   Sub: "PracticePro Systems designs, builds and runs business software
 *         from Lagos. Two products of our own, Vega for law firms and
 *         Atrium for property managers, plus custom systems for clients."
 * CTAs: "Talk to us" (primary — the one moss CTA), "See our work" (text
 * link). Right side: a STATIC inline SVG system diagram — four labelled
 * nodes joined by rules ("WhatsApp order" → "One queue" → "Ledger" →
 * "Receipt"). The only animation: the strokes draw once on load over
 * 900ms (disabled under prefers-reduced-motion via tokens.css).
 *
 * The H1 and both CTAs fit inside a 900px-tall viewport without scrolling
 * (no orb, no marquee, no dark stage — the WebGL hero era is retired).
 */
export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
}> = ({ onContactSales, scrollTo }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="home" className="relative" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container pt-28 lg:pt-36 pb-16 lg:pb-24">
                <div ref={ref} className="hub-grid hub-reveal items-center">
                    {/* Left — the promise */}
                    <div className="col-span-12 lg:col-span-7">
                        <h1 className="hub-display text-[2.4rem] sm:text-5xl lg:text-[3.6rem] xl:text-[4rem] leading-[1.06] mb-6 max-w-[14ch]">
                            We build the systems your business runs on.
                        </h1>
                        <p className="text-base md:text-lg leading-[1.7] mb-8 max-w-xl" style={{ color: 'rgb(var(--hub-mute))' }}>
                            PracticePro Systems designs, builds and runs business software from Lagos.
                            Two products of our own, Vega for law firms and Atrium for property
                            managers, plus custom systems for clients.
                        </p>
                        <div className="flex flex-wrap items-center gap-5">
                            <button onClick={onContactSales} className="hub-cta">
                                Talk to us
                            </button>
                            <button onClick={() => scrollTo('work')} className="hub-link text-[15px]">
                                See our work
                            </button>
                        </div>
                    </div>

                    {/* Right — the system diagram (static; strokes draw once) */}
                    <div className="col-span-12 lg:col-span-5 mt-12 lg:mt-0">
                        <SystemDiagram />
                    </div>
                </div>
            </div>
        </section>
    );
};

/**
 * The system diagram — the studio's whole pitch in one picture: an order
 * arriving by WhatsApp, landing in one queue, hitting the ledger, leaving
 * as a receipt. Four labelled nodes joined by rules. Static SVG; the
 * connecting strokes draw once over 900ms (hub-diagram-stroke in
 * tokens.css; reduced-motion users see the finished diagram).
 */
const SystemDiagram: React.FC = () => {
    const nodes = [
        { label: 'WhatsApp order', x: 60, y: 46, icon: 'chat' },
        { label: 'One queue', x: 218, y: 46, icon: 'queue' },
        { label: 'Ledger', x: 218, y: 150, icon: 'ledger' },
        { label: 'Receipt', x: 60, y: 150, icon: 'receipt' },
    ];
    return (
        <figure aria-label="A system diagram: a WhatsApp order lands in one queue, is recorded in the ledger, and leaves as a receipt">
            <svg viewBox="0 0 300 220" className="w-full max-w-md mx-auto" role="img" aria-hidden="true" focusable="false">
                {/* Rules between nodes — these draw once on load */}
                <path className="hub-diagram-stroke" style={{ '--hub-dash': 100 } as React.CSSProperties} d="M100 46 H178" fill="none" stroke="rgb(var(--hub-ink))" strokeWidth="1.5" />
                <path className="hub-diagram-stroke" style={{ '--hub-dash': 90, animationDelay: '150ms' } as React.CSSProperties} d="M218 66 V130" fill="none" stroke="rgb(var(--hub-ink))" strokeWidth="1.5" />
                <path className="hub-diagram-stroke" style={{ '--hub-dash': 100, animationDelay: '300ms' } as React.CSSProperties} d="M178 150 H100" fill="none" stroke="rgb(var(--hub-ink))" strokeWidth="1.5" />
                {/* The queue also feeds the receipt directly (the system, not a person) */}
                <path className="hub-diagram-stroke" style={{ '--hub-dash': 160, animationDelay: '450ms' } as React.CSSProperties} d="M186 62 C150 90 150 110 150 130 C150 145 120 148 100 150" fill="none" stroke="rgb(var(--hub-signal))" strokeWidth="1.5" strokeDasharray="4 4" />
                {nodes.map((n) => (
                    <g key={n.label}>
                        <rect
                            x={n.x - 44} y={n.y - 20} width="88" height="40" rx="2"
                            fill="#FFFFFF" stroke="rgb(var(--hub-rule))" strokeWidth="1"
                        />
                        <text
                            x={n.x} y={n.y + 4}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontFamily="var(--font-mono)"
                            fill="rgb(var(--hub-ink))"
                        >
                            {n.label}
                        </text>
                    </g>
                ))}
                {/* The moss dots — the signal touches the diagram exactly twice */}
                <circle cx="100" cy="46" r="2.5" fill="rgb(var(--hub-signal))" />
                <circle cx="100" cy="150" r="2.5" fill="rgb(var(--hub-signal))" />
            </svg>
            <figcaption className="hub-label text-center mt-3">
                Every job, the same way — the system holds the process
            </figcaption>
        </figure>
    );
};
