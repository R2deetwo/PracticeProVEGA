/**
 * webFetchClient — client-side web fetching using CORS proxies.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Convex backend has a `fetchUrlContent` action, but it requires
 * `npx convex deploy` to be run — which hasn't happened yet. As a result,
 * `api.webFetch.fetchUrlContent` is undefined at runtime, and ALL web
 * fetching silently fails in a try/catch.
 *
 * This module does the SAME thing (fetch a URL, extract text content)
 * but entirely client-side using CORS proxies. No Convex deployment
 * needed.
 *
 * CORS PROXIES
 * ------------
 * Browsers block cross-origin fetches by default. We use public CORS
 * proxies that add the `Access-Control-Allow-Origin: *` header:
 *   1. https://corsproxy.io/?url=<encoded-url>
 *   2. https://api.allorigins.win/raw?url=<encoded-url>
 *
 * We try multiple proxies in order — if one is down or rate-limited,
 * we fall back to the next.
 */

export interface WebFetchResult {
    success: boolean;
    url: string;
    title?: string;
    description?: string;
    content?: string;
    contentType?: string;
    error?: string;
    message?: string;
    proxyUsed?: string;
}

const CORS_PROXIES = [
    {
        name: 'corsproxy.io',
        buildUrl: (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    },
    {
        name: 'allorigins',
        buildUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    },
    {
        name: 'allorigins-get',
        buildUrl: (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        // This proxy returns JSON with a .contents field
        extractContent: (raw: string) => {
            try {
                const data = JSON.parse(raw);
                return data.contents || '';
            } catch {
                return raw;
            }
        },
    },
    {
        name: 'cors-anywhere',
        buildUrl: (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
    },
    {
        name: 'thingproxy',
        buildUrl: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    },
];

/**
 * Fetch a URL and extract its main text content.
 * Tries multiple CORS proxies in order until one works.
 */
export async function fetchUrlContentClient(url: string): Promise<WebFetchResult> {
    // Validate URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
        if (!parsedUrl.protocol.startsWith('http')) {
            return { success: false, url, error: 'INVALID_URL', message: 'Please provide a valid HTTP or HTTPS URL.' };
        }
    } catch {
        return { success: false, url, error: 'INVALID_URL', message: 'Could not parse the URL.' };
    }

    // Try each proxy in order
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy.buildUrl(url);
            const response = await fetch(proxyUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                continue; // try next proxy
            }

            const rawText = await response.text();
            if (!rawText || rawText.length < 100) {
                continue; // empty response, try next
            }

            // Some proxies return JSON with a .contents field (allorigins /get)
            const html = proxy.extractContent ? proxy.extractContent(rawText) : rawText;
            if (!html || html.length < 100) {
                continue;
            }

            // Parse the HTML
            const parsed = parseHtml(html, parsedUrl.hostname);
            return {
                success: true,
                url,
                title: parsed.title,
                description: parsed.description,
                content: parsed.content,
                contentType: 'text/html',
                proxyUsed: proxy.name,
            };
        } catch (err: any) {
            // Try next proxy
            continue;
        }
    }

    return {
        success: false,
        url,
        error: 'ALL_PROXIES_FAILED',
        message: 'Could not fetch the URL through any CORS proxy. The site may be down, behind a paywall, or blocking automated access.',
    };
}

/**
 * Parse HTML to extract title, description, and main text content.
 */
function parseHtml(html: string, fallbackTitle: string): { title: string; description: string; content: string } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : fallbackTitle;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract main text content
    let text = html;

    // Remove script and style tags + content
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Remove nav, header, footer, aside (boilerplate)
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');

    // Convert block-level tags to newlines
    text = text.replace(/<(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
    text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');

    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&hellip;/g, '…')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Clean up whitespace
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // Cap at 50k characters
    if (text.length > 50000) {
        text = text.substring(0, 50000) + '\n\n[Content truncated — page was too long]';
    }

    return { title, description, content: text };
}

// ─── Web Search ───────────────────────────────────────────────────────────

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface WebSearchResponse {
    success: boolean;
    query: string;
    results: WebSearchResult[];
    error?: string;
    message?: string;
}

/**
 * Search the web using DuckDuckGo HTML endpoint via CORS proxy.
 * Returns a list of results with title, URL, and snippet.
 */
export async function searchWebClient(query: string): Promise<WebSearchResponse> {
    if (!query || query.trim().length === 0) {
        return { success: false, query, results: [], error: 'EMPTY_QUERY', message: 'Search query cannot be empty.' };
    }

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    // Try each proxy
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy.buildUrl(searchUrl);
            const response = await fetch(proxyUrl, {
                headers: {
                    'Accept': 'text/html',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) continue;

            const html = await response.text();
            const results = parseDuckDuckGoResults(html);

            if (results.length > 0) {
                return { success: true, query, results };
            }
        } catch {
            continue;
        }
    }

    return {
        success: false,
        query,
        results: [],
        error: 'SEARCH_FAILED',
        message: 'Web search failed. The search engine may be rate-limiting or blocking the request.',
    };
}

/**
 * Parse DuckDuckGo HTML results page.
 */
function parseDuckDuckGoResults(html: string): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    // DDG wraps result links in <a class="result__a" href="...">
    const linkRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const links: Array<{ url: string; title: string }> = [];
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const rawUrl = linkMatch[1];
        const rawTitle = linkMatch[2]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

        // Clean DDG redirect URLs
        let cleanUrl = rawUrl;
        try {
            if (rawUrl.includes('uddg=')) {
                const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
                if (uddgMatch) cleanUrl = decodeURIComponent(uddgMatch[1]);
            }
            if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
            new URL(cleanUrl);
        } catch {
            continue;
        }

        if (rawTitle && cleanUrl) {
            links.push({ url: cleanUrl, title: rawTitle });
        }
    }

    const snippets: string[] = [];
    let snippetMatch: RegExpExecArray | null;
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        const snippet = snippetMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        if (snippet) snippets.push(snippet);
    }

    for (let i = 0; i < links.length && i < 10; i++) {
        results.push({
            title: links[i].title,
            url: links[i].url,
            snippet: snippets[i] || '',
        });
    }

    return results;
}
