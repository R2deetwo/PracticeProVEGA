
import React from 'react';
import { ChevronRightIcon } from '../constants';
import { splitBracketedTitle } from '../utils/bracketedTitle';

export interface BreadcrumbItem {
    label: string;
    onClick?: () => void;
    active?: boolean;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
    return (
        <nav className={`flex items-center text-sm text-slate-500 dark:text-zinc-400 ${className || ''}`} aria-label="Breadcrumb">
            <ol className="flex items-center flex-wrap gap-1">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    // Stage 2A: long bracketed titles ("Client Interview Guide:
                    // Divorce (Abusive Husband)") used to hard-truncate mid-
                    // bracket. Split off the trailing qualifier and let it wrap
                    // fully so the entire phrase/bracket stays enclosed.
                    const bracketed = splitBracketedTitle(item.label);

                    return (
                        <li key={index} className="flex items-center min-w-0">
                            {index > 0 && (
                                <ChevronRightIcon className="w-4 h-4 mx-1 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
                            )}
                            {item.onClick && !isLast ? (
                                <button
                                    onClick={item.onClick}
                                    className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors font-medium truncate max-w-[100px] sm:max-w-[200px]"
                                >
                                    {item.label}
                                </button>
                            ) : bracketed.parenthetical ? (
                                <span
                                    className={`min-w-0 inline-flex items-baseline gap-1 max-w-full ${isLast ? 'font-bold text-slate-800 dark:text-zinc-100' : ''}`}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    <span className="truncate max-w-[140px] sm:max-w-[300px]">{bracketed.main}</span>
                                    <span className="whitespace-normal break-words text-slate-500 dark:text-zinc-400 font-medium">
                                        {bracketed.parenthetical}
                                    </span>
                                </span>
                            ) : (
                                <span
                                    className={`truncate max-w-[140px] sm:max-w-[300px] ${isLast ? 'font-bold text-slate-800 dark:text-zinc-100' : ''}`}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
