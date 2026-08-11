/**
 * PageWrapper — Framer Motion page transition wrapper.
 *
 * Implements the "35% background offset" transition: as a new view enters
 * from the right, the previous view slides left by 35% and dims by 20%.
 *
 * Usage:
 *   <PageWrapper k={view}>
 *     <YourView />
 *   </PageWrapper>
 */

import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface PageWrapperProps {
    children: React.ReactNode;
    k?: string | number;
}

const pageVariants: Variants = {
    initial: {
        opacity: 0,
        x: '100%',
    },
    animate: {
        opacity: 1,
        x: 0,
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 200,
            opacity: { duration: 0.2 },
        },
    },
    exit: {
        opacity: 0.8,
        x: '-35%',
        transition: {
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
        },
    },
};

export const PageWrapper: React.FC<PageWrapperProps> = ({ children, k }) => {
    return (
        <motion.div
            key={k}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full w-full"
        >
            {children}
        </motion.div>
    );
};

/**
 * StaggerContainer — wraps a list of items to provide stagger animation.
 */
export const StaggerContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            variants={{
                initial: {},
                animate: {
                    transition: {
                        staggerChildren: 0.05,
                    },
                },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    return (
        <motion.div
            variants={{
                initial: { opacity: 0, y: 12 },
                animate: {
                    opacity: 1,
                    y: 0,
                    transition: {
                        duration: 0.3,
                        ease: [0.4, 0, 0.2, 1],
                    },
                },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * ScaleIn — simple scale-in animation for modals, cards, badges.
 */
export const ScaleIn: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.3,
                delay,
                ease: [0.4, 0, 0.2, 1],
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * SlideUp — slide-up entrance for bottom sheets, drawers, toasts.
 */
export const SlideUp: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                delay,
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export default PageWrapper;
