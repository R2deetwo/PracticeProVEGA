import { sanitize } from './sanitization';

export const parseAloaMarkdown = (text: string): string => {
    if (!text) return '';

    // Basic HTML escaping for safety, applied before markdown conversion
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

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
                
                // Detect legal tasks (procedural or drafting)
                const isTask = content.match(/^(Prepare|File|Draft|Search|Review|Send|Create|Analyze)\b/i);
                if (isTask) {
                    return `<li class="text-sm leading-relaxed group/task">
                        <span 
                            class="cursor-pointer text-primary-600 dark:text-primary-400 font-bold hover:underline decoration-2 underline-offset-4 decoration-primary-300 flex items-center gap-2 aloa-interactive-task"
                            data-task-title="${content.replace(/"/g, '&quot;')}"
                        >
                            ${content}
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/40 text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/task:opacity-100 transition-opacity translate-y-px">Review Task</span>
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

        // Handle paragraphs with bolding, italics, and line breaks
        const content = trimmedBlock
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
            .replace(/(?<!\s)\*(?!\s|\*)/g, '<em>')
            .replace(/(?<!\s|\*)\*(?!\s)/g, '</em>')
            .replace(/\n/g, '<br />');

        return `<p class="text-sm leading-relaxed mb-4">${content}</p>`;
    }).join('');
    
    return sanitize(finalHtml);
};