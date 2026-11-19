/**
 * robots.ts — a compact robots.txt evaluator for the in-Convex ingestion
 * engine (the TS port of the Python worker's urllib.robotparser usage).
 *
 * WHY NOT A LIBRARY: this must run identically in three places — a Convex
 * action, vitest, and the browser bundle — with zero dependencies. The
 * semantics implemented are the de-facto standard (Google/Bing):
 *   - directives are grouped under User-agent lines; we match the group
 *     naming our UA most specifically, falling back to `*`
 *   - within the winning group, the LONGEST matching Allow/Disallow path
 *     wins; a tie goes to Disallow
 *   - Crawl-delay (when present for our UA) is surfaced so the caller can
 *     pace per-domain fetches
 *   - a missing or unreachable robots.txt means "allowed" (crawl freely)
 */

export interface RobotRules {
    /** null = no robots.txt / unparseable → everything allowed. */
    disallow: string[] | null;
    allow: string[];
    crawlDelayS: number | null;
}

const UA_WILDCARD = "*";

/** Parse robots.txt body into groups keyed by user-agent (lowercased). */
export function parseRobots(body: string): Map<string, { disallow: string[]; allow: string[]; crawlDelayS: number | null }> {
    const groups = new Map<string, { disallow: string[]; allow: string[]; crawlDelayS: number | null }>();
    let currentAgents: string[] = [];

    for (const rawLine of body.split(/\r?\n/)) {
        const line = rawLine.split("#")[0].trim(); // strip comments
        if (!line) continue;
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();

        if (field === "user-agent") {
            if (value) currentAgents.push(value.toLowerCase());
        } else if (currentAgents.length > 0) {
            for (const agent of currentAgents) {
                let g = groups.get(agent);
                if (!g) {
                    g = { disallow: [], allow: [], crawlDelayS: null };
                    groups.set(agent, g);
                }
                if (field === "disallow" && value) g.disallow.push(value);
                else if (field === "allow" && value) g.allow.push(value);
                else if (field === "crawl-delay") {
                    const d = parseFloat(value);
                    if (!Number.isNaN(d) && g.crawlDelayS === null) g.crawlDelayS = d;
                }
            }
        }
    }
    return groups;
}

/** Match a path against an Allow/Disallow pattern (supports * and $). */
function pathMatches(pattern: string, path: string): boolean {
    const anchored = pattern.endsWith("$");
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    try {
        return new RegExp(anchored ? `^${escaped}$` : `^${escaped}`).test(path);
    } catch {
        return false;
    }
}

/** Longest-match wins; Disallow wins ties (the standard resolution). */
function ruleApplies(patterns: string[], path: string): { matched: boolean; length: number } {
    let best = -1;
    for (const p of patterns) {
        if (pathMatches(p, path) && p.length > best) best = p.length;
    }
    return { matched: best >= 0, length: best };
}

/**
 * Resolve the effective rules for a user agent against a robots.txt body.
 * Falls back to the `*` group when no specific group matches; returns
 * disallow=null when no group applies at all (fully allowed).
 */
export function rulesForUserAgent(body: string, userAgent: string): RobotRules {
    const groups = parseRobots(body);
    const ua = userAgent.toLowerCase();
    // Most specific: our exact agent string, then any group whose name our
    // UA contains (partial product tokens), then the wildcard.
    let group: { disallow: string[]; allow: string[]; crawlDelayS: number | null } | null | undefined =
        groups.get(ua);
    if (!group) {
        for (const [name, g] of groups) {
            if (name !== UA_WILDCARD && (ua.includes(name) || name.includes(ua.split("/")[0]))) {
                group = g;
                break;
            }
        }
    }
    if (!group) group = groups.get(UA_WILDCARD) ?? null;
    if (!group) return { disallow: null, allow: [], crawlDelayS: null };
    return { disallow: group.disallow, allow: group.allow, crawlDelayS: group.crawlDelayS };
}

/** May this user agent fetch the given URL, under these rules? */
export function robotsAllows(rules: RobotRules, url: string): boolean {
    if (rules.disallow === null) return true; // no robots → allowed
    let path = "/";
    try {
        const u = new URL(url);
        path = u.pathname + u.search;
    } catch {
        return true;
    }
    const dis = ruleApplies(rules.disallow, path);
    if (!dis.matched) return true;
    const allow = ruleApplies(rules.allow, path);
    // Allow overrides Disallow only when strictly longer.
    return allow.matched && allow.length >= dis.length;
}

/** Convenience: robots.txt URL for a page URL. */
export function robotsUrlFor(url: string): string | null {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}/robots.txt`;
    } catch {
        return null;
    }
}
