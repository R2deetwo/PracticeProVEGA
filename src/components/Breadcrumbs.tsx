
import React from 'react';
import { ChevronRightIcon } from '../constants';

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
