import { sanitize } from './sanitization';

export const parseAloaMarkdown = (text: string): string => {
    if (!text) return '';

    // 0. Clean line break symbols and extra whitespace
    let html = text.replace(/\\n/g, '\n').replace(/\r/g, '');

    // Basic HTML escaping for safety, applied before markdown conversion
    html = html.replace(/&/g, '&amp;');
    // We NO LONGER escape < and > here because the AI often returns raw HTML 
    // for DraftPro/Legal layouts, which we want to preserve and sanitize later.

    // 0.5. Markdown links [text](url) → clickable <a> tags
    // Must run BEFORE the citation pill parser so links aren't converted to pills
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, text, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 font-bold underline decoration-primary-300 dark:decoration-primary-700 underline-offset-2 hover:decoration-primary-500 transition-colors">${text}</a>`;
    });

    // 1. Interactive Citations [Source Name]
    // Transform [Source Name] into a pill
    html = html.replace(/\[([^\]]+)\]/g, (match, p1) => {
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 mx-0.5 shadow-sm" title="Citation reference">${p1}</span>`;
    });

    // Process blocks of text separated by double newlines
    const blocks = html.split(/\n\s*\n/);

    const finalHtml = blocks.map(block => {
        const trimmedBlock = block.trim();

        if (trimmedBlock.length === 0) {
            return '';
        }

        // Handle lists (unordered or ordered)
        const isUnorderedList = trimmedBlock.match(/^([*-])\s/m);
        const isOrderedList = trimmedBlock.match(/^\d+\.\s/m);

        if (isUnorderedList || isOrderedList) {
            const listType = isUnorderedList ? 'ul' : 'ol';
            const listClass = listType === 'ul'
                ? "list-disc list-inside space-y-1 my-2"
                : "list-decimal list-inside space-y-1 my-2";

            const items = trimmedBlock.split('\n').map(item => {
                let content = item
                    .replace(/^[*-]\s+/, '')
                    .replace(/^\d+\.\s+/, '')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .trim();
                
                // Detect legal tasks (procedural or drafting) and color-code by priority
                const isTask = content.match(/^(Prepare|File|Draft|Search|Review|Send|Create|Analyze)\b/i);
                if (isTask) {
                    // ─── Color-coding system for ALOA suggestions ──────
                    // 🔴 RED (High Priority / Action Items): Critical actions,
                    //    missed deadlines, urgent tasks
                    //    Keywords: File, Prepare, Send (time-sensitive actions)
                    // 🟢 GREEN (General Review / Status Items): Navigation,
                    //    status updates, standard reviews
                    //    Keywords: Review, Create (non-urgent actions)
                    // 🔵 BLUE (Informational / Research Items): Insights,
                    //    documents, data-driven suggestions
                    //    Keywords: Search, Analyze, Draft (research/creation)

                    const actionWord = isTask[1].toLowerCase();
                    let colorClass = '';
                    let badgeText = '';
                    let borderColor = '';

                    if (['file', 'prepare', 'send'].includes(actionWord)) {
                        // Red — high priority / action items
                        colorClass = 'text-red-600 dark:text-red-400 hover:decoration-red-400';
                        borderColor = 'border-l-2 border-red-400 pl-2';
                        badgeText = 'High Priority';
                    } else if (['review', 'create'].includes(actionWord)) {
                        // Green — general review / status items
                        colorClass = 'text-emerald-600 dark:text-emerald-400 hover:decoration-emerald-400';
                        borderColor = 'border-l-2 border-emerald-400 pl-2';
                        badgeText = 'Review';
                    } else if (['search', 'analyze', 'draft'].includes(actionWord)) {
                        // Blue — informational / research items
                        colorClass = 'text-blue-600 dark:text-blue-400 hover:decoration-blue-400';
                        borderColor = 'border-l-2 border-blue-400 pl-2';
                        badgeText = 'Research';
                    } else {
                        // Default — primary color
                        colorClass = 'text-primary-600 dark:text-primary-400 hover:decoration-primary-300';
                        borderColor = '';
                        badgeText = 'Action';
                    }

                    return `<li class="text-sm leading-relaxed group/task ${borderColor} rounded-r-sm">
                        <span
                            class="cursor-pointer ${colorClass} font-bold hover:underline decoration-2 underline-offset-4 flex items-center gap-2 aloa-interactive-task"
                            data-task-title="${content.replace(/"/g, '&quot;')}"
                        >
                            ${content}
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700 text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/task:opacity-100 transition-opacity translate-y-px">${badgeText}</span>
                        </span>
                    </li>`;
                }

                return `<li class="text-sm leading-relaxed">${content}</li>`;
            }).join('');
            return `<${listType} class="${listClass}">${items}</${listType}>`;
        }

        // Handle blockquotes
        if (trimmedBlock.startsWith('&gt;')) {
            const content = trimmedBlock
                .replace(/^&gt;\s?/gm, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                .replace(/\n/g, '<br />');
            return `<blockquote class="pl-4 border-l-4 border-primary-300 dark:border-primary-800 italic text-slate-600 dark:text-zinc-400 my-4 bg-slate-50 dark:bg-zinc-800/50 py-2 rounded-r-lg">${content}</blockquote>`
        }

        // Handle Headings
        if (trimmedBlock.startsWith('### ')) {
            return `<h3 class="text-sm font-bold mt-6 mb-2 text-slate-800 dark:text-white uppercase tracking-wider">${trimmedBlock.replace('### ', '')}</h3>`;
        }
        if (trimmedBlock.startsWith('## ')) {
            return `<h2 class="text-base font-bold mt-8 mb-3 text-primary-700 dark:text-primary-400 border-b border-slate-100 dark:border-zinc-800 pb-1">${trimmedBlock.replace('## ', '')}</h2>`;
        }

        // Detect if the block is already HTML (e.g. from DraftPro/Legal layouts)
        const isHtml = trimmedBlock.startsWith('<') && /<(p|div|h1|h2|h3|table|ul|ol|blockquote)/i.test(trimmedBlock);

        // Handle paragraphs with bolding, italics, and line breaks
        let content = trimmedBlock
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
            .replace(/(?<!\s)\*(?!\s|\*)/g, '<em>')
            .replace(/(?<!\s|\*)\*(?!\s)/g, '</em>');
        
        if (!isHtml) {
            content = content.replace(/\n/g, '<br />');
            return `<p class="text-sm leading-relaxed mb-4">${content}</p>`;
        }

        return content;
    }).join('');
    
    return sanitize(finalHtml);
};