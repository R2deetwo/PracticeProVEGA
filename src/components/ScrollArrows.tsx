
import React, { useRef, useState, useEffect } from 'react';
import { ChevronRightIcon } from '../constants';

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

interface ScrollArrowsProps {
    children: React.ReactNode;
    className?: string; // Allow passing alignment classes
}

const ScrollArrows: React.FC<ScrollArrowsProps> = ({ children, className = 'items-center' }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkForScroll = () => {
        const el = scrollRef.current;
        if (el) {
            setCanScrollLeft(el.scrollLeft > 0);
            setCanScrollRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 1); // +1 for pixel rounding issues
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            checkForScroll();
            el.addEventListener('scroll', checkForScroll);
            const resizeObserver = new ResizeObserver(checkForScroll);
            resizeObserver.observe(el);

            return () => {
                el.removeEventListener('scroll', checkForScroll);
                resizeObserver.unobserve(el);
            };
        }
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className={`relative group w-full flex ${className}`}>
            {canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 z-20 p-1 bg-white/90 dark:bg-zinc-800/90 text-slate-600 dark:text-slate-300 rounded-full shadow-md border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 mt-2"
                    aria-label="Scroll left"
                >
                    <ChevronLeftIcon />
                </button>
            )}

            <div ref={scrollRef} className="overflow-x-auto no-scrollbar w-full px-1 scroll-smooth">
                {children}
            </div>

            {canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 z-20 p-1 bg-white/90 dark:bg-zinc-800/90 text-slate-600 dark:text-slate-300 rounded-full shadow-md border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 mt-2"
                    aria-label="Scroll right"
                >
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

export default ScrollArrows;
