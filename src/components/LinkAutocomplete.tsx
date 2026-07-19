/**
 * LinkAutocomplete — dropdown that appears when the user types [[ in a
 * text area or input. Shows matching matters, contacts, properties,
 * documents, and notes. When the user selects one, inserts [[Label]]
 * at the cursor position.
 *
 * Usage:
 *   Attach to a textarea by passing the ref, and call onInsert(label)
 *   when a selection is made. The parent component handles replacing
 *   the [[...]] text in the textarea.
 */
import React, { useState, useEffect, useRef } from 'react';
import { searchEntities, EntitySearchResult } from '../utils/linkParser';

interface LinkAutocompleteProps {
  /** The textarea element to watch */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** Current text value of the textarea */
  value: string;
  /** All searchable entities */
  entities: {
    matters?: any[];
    contacts?: any[];
    properties?: any[];
    documents?: any[];
    notes?: any[];
  };
  /** Called when the user selects an entity. The parent should replace
   *  the [[partial text with [[Full Label]] in the textarea. */
  onInsert: (label: string) => void;
}

const TypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className = 'w-3.5 h-3.5' }) => {
  const icons: Record<string, string> = {
    matter: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
    contact: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    property: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
    document: 'M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5',
    note: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
  };
  const path = icons[type] || icons.note;
  return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>;
};

const typeColors: Record<string, string> = {
  matter: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  contact: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
  property: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
  document: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  note: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20',
};

const LinkAutocomplete: React.FC<LinkAutocompleteProps> = ({ textareaRef, value, entities, onInsert }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [linkStart, setLinkStart] = useState(-1);

  // Watch for [[ pattern in the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Find the last [[ that doesn't have a closing ]]
    const lastOpen = textBeforeCursor.lastIndexOf('[[');
    if (lastOpen === -1) {
      setIsVisible(false);
      return;
    }

    // Check there's no ]] between the [[ and the cursor
    const textBetween = textBeforeCursor.substring(lastOpen + 2);
    if (textBetween.includes(']]')) {
      setIsVisible(false);
      return;
    }

    // Check there's no newline (links should be inline)
    if (textBetween.includes('\n')) {
      setIsVisible(false);
      return;
    }

    // Show the autocomplete with the query
    setLinkStart(lastOpen);
    setQuery(textBetween);
    setIsVisible(true);

    // Calculate position based on the textarea caret
    const rect = textarea.getBoundingClientRect();
    const lineHeight = 20;
    const lines = textBeforeCursor.split('\n').length - 1;
    setPosition({
      top: rect.top + textarea.offsetTop + (lines + 1) * lineHeight + 4,
      left: rect.left + textarea.offsetLeft + 20,
    });

    // Search for matching entities
    const searchResults = searchEntities(textBetween, entities, 8);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [value, textareaRef, entities]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isVisible, results, selectedIndex]);

  const handleSelect = (result: EntitySearchResult) => {
    onInsert(result.label);
    setIsVisible(false);
  };

  if (!isVisible || results.length === 0) return null;

  return (
    <div
      className="fixed z-[3000] bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden min-w-[280px] max-w-[360px] animate-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-700">
        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Link to</p>
      </div>
      <div className="max-h-[240px] overflow-y-auto py-1">
        {results.map((result, index) => (
          <button
            key={`${result.type}-${result.id}`}
            onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${index === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'}`}
          >
            <div className={`flex-shrink-0 p-1.5 rounded-lg ${typeColors[result.type] || typeColors.note}`}>
              <TypeIcon type={result.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${index === selectedIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                {result.label}
              </p>
              <p className="text-2xs text-slate-400 dark:text-zinc-500 capitalize">{result.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkAutocomplete;
