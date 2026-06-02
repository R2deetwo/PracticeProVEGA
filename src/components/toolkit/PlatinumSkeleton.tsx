
import React from 'react';
import { motion } from 'framer-motion';

export const PlatinumSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden">
            {/* Header Skeleton */}
            <div className="h-[320px] bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900"></div>
                <div className="max-w-7xl mx-auto px-8 pt-20 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="space-y-4">
                            <div className="h-4 w-32 bg-slate-800 rounded-full animate-pulse"></div>
                            <div className="h-12 w-96 bg-slate-800 rounded-2xl animate-pulse"></div>
                            <div className="flex gap-4">
                                <div className="h-6 w-24 bg-slate-800 rounded-full animate-pulse"></div>
                                <div className="h-6 w-24 bg-slate-800 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-12 w-12 bg-slate-800 rounded-2xl animate-pulse"></div>
                            <div className="h-12 w-32 bg-slate-800 rounded-2xl animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Skeleton */}
            <div className="max-w-7xl mx-auto px-8 -mt-16 relative z-20 w-full">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 shadow-xl animate-pulse"></div>
                    ))}
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="max-w-7xl mx-auto px-8 mt-12 w-full flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="h-96 bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 animate-pulse"></div>
                        <div className="h-64 bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 animate-pulse"></div>
                    </div>
                    <div className="space-y-8">
                        <div className="h-64 bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 animate-pulse"></div>
                        <div className="h-80 bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-zinc-800 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
