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
    // Transform [Source Name] into a pill (but skip if it looks like a URL link
    // that was already converted above — those have href attributes)
    html = html.replace(/\[([^\]]+)\]/g, (match, p1) => {
        // Skip if this is inside an <a> tag (the link regex already ran)
        if (/<a[^>]*>[^<]*$/.test(html.substring(0, html.indexOf(match)))) {
            // Heuristic: if the previous content ends with an open <a> tag, skip
            return match;
        }
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 mx-0.5 shadow-sm" title="Citation reference">${p1}</span>`;
    });

    // Process blocks of text separated by double newlines
    const blocks = html.split(/\n\s*\n/);

    const finalHtml = blocks.map(block => {
        const trimmedBlock = block.trim();

        if (trimmedBlock.length === 0) {
            return '';
        }

        // Handle horizontal rules (--- or ___ or ***)
        if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(trimmedBlock)) {
            return `<hr class="border-slate-200 dark:border-zinc-700 my-4" />`;
        }

        // Handle lists (unordered or ordered)
        const isUnorderedList = trimmedBlock.match(/^([*-])\s/m);
        const isOrderedList = trimmedBlock.match(/^\d+\.\s/m);

        if (isUnorderedList || isOrderedList) {
            const listType = isUnorderedList ? 'ul' : 'ol';
            const listClass = listType === 'ul'
                ? "list-disc list-inside space-y-1.5 my-3 pl-2"
                : "list-decimal list-inside space-y-1.5 my-3 pl-2";

            const items = trimmedBlock.split('\n').map(item => {
                let content = item
                    .replace(/^[*-]\s+/, '')
                    .replace(/^\d+\.\s+/, '')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .trim();

                // Detect legal tasks (procedural or drafting) and color-code by priority
                // Using soft, semantic, desaturated functional colors that don't clash
                // with the brand Moss Green (#4A694C)
                const isTask = content.match(/^(Prepare|File|Draft|Search|Review|Send|Create|Analyze)\b/i);
                if (isTask) {
                    const actionWord = isTask[1].toLowerCase();
                    let bgClass = '';
                    let textClass = '';
                    let badgeBg = '';
                    let badgeText = '';

                    if (['file', 'prepare', 'send'].includes(actionWord)) {
                        // 🔴 High Priority — Soft Red background, Dark Red text
                        bgClass = 'bg-[#FCE8E6] dark:bg-[#FCE8E6]/10';
                        textClass = 'text-[#C5221F] dark:text-[#C5221F]';
                        badgeBg = 'bg-[#C5221F]/10';
                        badgeText = 'High Priority';
                    } else if (['review', 'create'].includes(actionWord)) {
                        // 🟢 Review/Status — Soft Mint background, Dark Emerald text
                        // (distinct from brand Moss Green)
                        bgClass = 'bg-[#E6F4EA] dark:bg-[#E6F4EA]/10';
                        textClass = 'text-[#137333] dark:text-[#137333]';
                        badgeBg = 'bg-[#137333]/10';
                        badgeText = 'Review';
                    } else if (['search', 'analyze', 'draft'].includes(actionWord)) {
                        // 🔵 Info/Research — Soft Blue background, Dark Blue text
                        bgClass = 'bg-[#E8F0FE] dark:bg-[#E8F0FE]/10';
                        textClass = 'text-[#1A73E8] dark:text-[#1A73E8]';
                        badgeBg = 'bg-[#1A73E8]/10';
                        badgeText = 'Research';
                    } else {
                        bgClass = 'bg-slate-50 dark:bg-zinc-800/50';
                        textClass = 'text-slate-700 dark:text-zinc-300';
                        badgeBg = 'bg-slate-200 dark:bg-zinc-700';
                        badgeText = 'Action';
                    }

                    return `<li class="text-sm leading-relaxed group/task">
                        <span
                            class="cursor-pointer ${textClass} font-bold hover:underline decoration-2 underline-offset-4 flex items-center gap-2 aloa-interactive-task px-2.5 py-1.5 rounded-lg ${bgClass} transition-colors"
                            data-task-title="${content.replace(/"/g, '&quot;')}"
                        >
                            ${content}
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md ${badgeBg} text-3xs font-black uppercase tracking-tighter opacity-0 group-hover/task:opacity-100 transition-opacity">${badgeText}</span>
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
        if (trimmedBlock.startsWith('#### ')) {
            return `<h4 class="text-xs font-bold mt-4 mb-1.5 text-slate-700 dark:text-zinc-300 uppercase tracking-wider">${trimmedBlock.replace('#### ', '')}</h4>`;
        }
        if (trimmedBlock.startsWith('### ')) {
            return `<h3 class="text-sm font-bold mt-5 mb-2 text-slate-800 dark:text-white uppercase tracking-wider">${trimmedBlock.replace('### ', '')}</h3>`;
        }
        if (trimmedBlock.startsWith('## ')) {
            return `<h2 class="text-base font-bold mt-6 mb-3 text-primary-700 dark:text-primary-400 border-b border-slate-100 dark:border-zinc-800 pb-1.5">${trimmedBlock.replace('## ', '')}</h2>`;
        }
        if (trimmedBlock.startsWith('# ')) {
            return `<h1 class="text-lg font-bold mt-6 mb-3 text-slate-900 dark:text-white">${trimmedBlock.replace('# ', '')}</h1>`;
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
            return `<p class="text-sm leading-relaxed mb-3">${content}</p>`;
        }

        return content;
    }).join('');

    return sanitize(finalHtml);
};