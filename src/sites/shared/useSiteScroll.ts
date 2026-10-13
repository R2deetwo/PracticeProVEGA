import { useEffect, useRef, useState } from 'react';

/**
 * useSiteScroll — the landing scroll machinery, moved verbatim from
 * LandingPage.tsx (P0 split) and parametrised by the site's own section
 * list. The page scrolls inside its own div (h-[100dvh] overflow-y-auto),
 * not the window — every measurement respects that container.
 */
export function useSiteScroll(sections: readonly string[]) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = useState(sections[0]);

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            const scrollPos = scrollRef.current.scrollTop + 100;
            for (const section of sections) {
                const el = document.getElementById(section);
                if (el && scrollPos >= el.offsetTop && scrollPos < el.offsetTop + el.offsetHeight) {
                    setActiveSection(section);
                    break;
                }
            }
        };
        const container = scrollRef.current;
        container?.addEventListener('scroll', handleScroll);
        return () => container?.removeEventListener('scroll', handleScroll);
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
