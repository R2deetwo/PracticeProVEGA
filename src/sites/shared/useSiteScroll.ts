import { useEffect, useRef, useState } from 'react';

/**
 * useSiteScroll — the landing scroll machinery, moved verbatim from
 * LandingPage.tsx (P0 split) and parametrised by the site's own section
 * list. The page scrolls inside its own div (h-[100dvh] overflow-y-auto),
 * not the window — every measurement respects that container.
 *
 * R73 (the silk pass): the raw scroll listener ran its DOM measurements
 * on EVERY scroll event (trackpads and inertial flicks fire far faster
 * than the display refreshes — dozens of layout reads per painted frame)
 * and the listener was not passive, so the compositor had to wait on the
 * main thread. The handler is now rAF-throttled — at most one pass per
 * painted frame, reads only, so the browser batches them into a single
 * layout — registered passive, and the active-section state only changes
 * when the section actually changes (no re-render churn per event).
 */
export function useSiteScroll(sections: readonly string[]) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = useState(sections[0]);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        let raf = 0;
        const update = () => {
            raf = 0;
            const scrollPos = container.scrollTop + 100;
            for (const section of sections) {
                const el = document.getElementById(section);
                if (el && scrollPos >= el.offsetTop && scrollPos < el.offsetTop + el.offsetHeight) {
                    setActiveSection((prev) => (prev === section ? prev : section));
                    break;
                }
            }
        };
        const handleScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        update(); // settle the initial section without waiting for a scroll
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (raf) cancelAnimationFrame(raf);
        };
        // sections is a per-site constant; the original effect re-bound on
        // productChosen only because the list itself changed with the surface.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el && scrollRef.current) {
            // W14: rect-based math — el.offsetTop lies for elements nested
            // inside positioned ancestors. Measuring against the scroll
            // container's own rect is correct for every element, nested or not.
            const container = scrollRef.current;
            const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 64;
            container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    };

    return { scrollRef, activeSection, scrollTo };
}
