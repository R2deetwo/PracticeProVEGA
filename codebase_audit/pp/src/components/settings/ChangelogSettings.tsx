
/**
 * ChangelogSettings — Full changelog display inside the Settings panel.
 * Bottom of the "What's New" section in Settings.
 * Reads from the same CHANGELOG source as the WhatsNew modal.
 */
import React, { useState } from 'react';
import { CHANGELOG, FEATURE_ICONS, ChangelogEntry } from '../WhatsNew';

const STORAGE_KEY = 'practicepro_last_seen_version';

const EntryCard: React.FC<{ entry: ChangelogEntry; isLatest: boolean }> = ({ entry, isLatest }) => {
    const [expanded, setExpanded] = useState(isLatest);

    return (
        <div className={`rounded-xl border transition-all duration-200 ${isLatest
                ? 'border-indigo-300 dark:border-indigo-600/50 bg-indigo-50/50 dark:bg-indigo-900/10'
                : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50'
            }`}>
            <button
                onClick={() => setExpanded(p => !p)}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${isLatest
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                        }`}>
                        v{entry.version}
                    </div>
                    <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{entry.title}</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                            {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    {isLatest && (
                        <span className="ml-1 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Latest
                        </span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-2 ${expanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-zinc-700/50 pt-3">
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mb-3 leading-relaxed">{entry.description}</p>
                    <ul className="space-y-2">
                        {entry.features.map((f) => {
                            const Icon = FEATURE_ICONS[f.icon];
                            return (
                                <li key={f.label} className="flex items-start gap-3">
                                    {Icon && <span className="mt-0.5"><Icon /></span>}
                                    <div>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">{f.label}</span>
                                        <span className="text-xs text-slate-500 dark:text-zinc-400">{f.text}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

const ChangelogSettings: React.FC = () => {
    const handleMarkAllSeen = () => {
        if (CHANGELOG[0]) {
            localStorage.setItem(STORAGE_KEY, CHANGELOG[0].id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What's New</h2>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
                            A full log of every update made to PracticePro.
                        </p>
                    </div>
                    <button
                        onClick={handleMarkAllSeen}
                        className="flex-shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors mt-1"
                    >
                        Mark all seen
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {CHANGELOG.map((entry, idx) => (
                    <EntryCard key={entry.id} entry={entry} isLatest={idx === 0} />
                ))}
            </div>
        </div>
    );
};

export default ChangelogSettings;
