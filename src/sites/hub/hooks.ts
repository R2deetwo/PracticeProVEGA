import { useEffect, useRef, useState } from 'react';
import React from 'react';

/* W18-era scroll machinery, restored with the hub (P0 kept these in
 * the monolith; P1 reduced them to a plain fade). Reduced-motion is
 * handled by the CSS (index.css) — these hooks only latch classes. */

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(options?: { threshold?: number; rootMargin?: string }) {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // If IntersectionObserver isn't supported, just show the element.
        if (!('IntersectionObserver' in window)) {
            el.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: options?.threshold ?? 0.15,
            rootMargin: options?.rootMargin ?? '0px 0px -60px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

/**
 * useScrollParallax — subtle vertical parallax on scroll.
 * Returns a ref to attach to the image element. The image translates
 * slowly as the user scrolls, creating depth. Max offset ±20px.
 */
export function useScrollParallax<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Skip parallax if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let rafId: number | null = null;
        const update = () => {
            const rect = el.getBoundingClientRect();
            const viewportH = window.innerHeight;
            // How far is the element's center from the viewport center?
            const elementCenter = rect.top + rect.height / 2;
            const viewportCenter = viewportH / 2;
            const distance = elementCenter - viewportCenter;
            // Normalize to -1..1 (element fully in viewport)
            const normalized = Math.max(-1, Math.min(1, distance / viewportCenter));
            // Apply parallax: max ±16px translate
            const offset = normalized * -16;
            el.style.transform = `translateY(${offset}px) scale(1.08)`;
            rafId = null;
        };
        const onScroll = () => {
            if (rafId === null) rafId = requestAnimationFrame(update);
        };
        update(); // Initial position
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);
    return ref;
}

/**
 * useSectionProgress (W7) — how far the viewport has scrolled through a
 * section, 0..1. Runs a rAF loop only while the section is on screen and
 * reads getBoundingClientRect(), so it works no matter which element
 * owns the scrollbar (the landing page scrolls inside its own div).
 * Returns a ref; the caller reads progress via the callback.
 */
export function useSectionProgress<T extends HTMLElement = HTMLDivElement>(onProgress: (p: number) => void) {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let rafId: number | null = null;
        let inView = false;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) {
                rafId = requestAnimationFrame(tick);
            }
        }, { threshold: 0 });
        const tick = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            // 0 when the section's top hits the viewport bottom; 1 when its
            // bottom reaches the viewport top. Clamped for safety.
            const traveled = vh - rect.top;
            const total = rect.height + vh;
            const p = Math.min(1, Math.max(0, traveled / total));
            onProgress(p);
            rafId = inView ? requestAnimationFrame(tick) : null;
        };
        io.observe(el);
        return () => {
            io.disconnect();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [onProgress]);
    return ref;
}

/** Primary CTA button – high-contrast gradient fill */
