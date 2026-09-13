/**
 * sendChatMessage client↔server CONTRACT test — the "messages don't send" cure.
 *
 * ROOT CAUSE THIS GUARDS AGAINST (2026-09-14 production incident):
 *   A client change added `attachments`/`attachmentNames` to the team-DM send
 *   payload — including EMPTY ARRAYS on every plain-text send — but the Convex
 *   `sendChatMessage` validator never declared those fields. Convex rejected
 *   the mutation with ArgumentValidationError "extra field 'attachmentNames'"
 *   and EVERY team DM send failed (content: "well", attachmentNames: []).
 *   It passed CI because no test compared client payload keys against the
 *   backend validator.
 *
 * WHAT THIS TEST DOES:
 *   1. Statically extracts the allowed argument names from the
 *      `sendChatMessage` mutation validator in convex/myFunctions.ts.
 *   2. Statically extracts every payload key from every client call site
 *      (MessagesView.tsx, useMessaging.ts, TeamMessageModal.tsx).
 *   3. Asserts client keys ⊆ validator fields — the exact class of failure
 *      above fails this test at commit time, not in production.
 *   4. Asserts the chatMessages table schema has fields the handler may write
 *      (attachments without a schema home would break the insert the same way).
 *   5. Fails loudly if the scanner finds ZERO call sites (e.g. after a rename),
 *      so this test can never silently rot into a vacuous pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();

const convexSource = readFileSync(resolve(repoRoot, 'convex/myFunctions.ts'), 'utf8');
const schemaSource = readFileSync(resolve(repoRoot, 'convex/schema.ts'), 'utf8');

const CLIENT_CALL_SITES: { path: string; callees: string[] }[] = [
    {
        path: 'src/components/MessagesView.tsx',
        // Team DM reply + voice-note paths (the production incident).
        callees: ['sendChatMessageMutation'],
    },
    {
        path: 'src/hooks/useMessaging.ts',
        callees: ['sendChatMessageMutation'],
    },
    {
        path: 'src/components/modals/TeamMessageModal.tsx',
        callees: ['sendChatMessage'],
    },
];

/** Allowed arg names extracted from the sendChatMessage mutation validator. */
function extractValidatorFields(): string[] {
    const start = convexSource.indexOf('export const sendChatMessage = mutation({');
    expect(start, 'sendChatMessage mutation must exist in convex/myFunctions.ts').toBeGreaterThan(-1);
    const handlerIdx = convexSource.indexOf('handler:', start);
    const block = convexSource.slice(start, handlerIdx);
    const fields: string[] = [];
    for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;
        const m = /^([a-zA-Z_][a-zA-Z0-9_]*):\s*v\./.exec(trimmed);
        if (m) fields.push(m[1]);
    }
    return fields;
}

/** Strip string literals and comments so key extraction can't match their contents. */
function stripStringsAndComments(src: string): string {
    let out = '';
    let i = 0;
    let inString: string | null = null;
    while (i < src.length) {
        const ch = src[i];
        if (inString) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === inString) inString = null;
            i += 1;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inString = ch; i += 1; continue; }
        if (ch === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
            i += 2;
            continue;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** Find the balanced {...} block that starts at the first '{' at/after callIdx. */
function extractCallBlock(src: string, callIdx: number): string | null {
    let i = src.indexOf('{', callIdx);
    if (i === -1) return null;
    let depth = 0;
    let inString: string | null = null;
    const start = i;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (inString) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === inString) inString = null;
            continue;
        }
        // Comments are skipped BEFORE quote detection — an apostrophe inside a
        // comment (e.g. "don't") would otherwise toggle string mode and make
        // the brace balance overshoot far past the real end of the call.
        if (ch === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
            i += 1;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    return null;
}

/** Top-level-looking `key:` identifiers inside a payload block (call payloads here are flat). */
function extractPayloadKeys(block: string): string[] {
    const clean = stripStringsAndComments(block);
    const keys = new Set<string>();
    for (const m of clean.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) {
        keys.add(m[1]);
    }
    return [...keys];
}

/** Every sendChatMessage-family call with its payload keys, per client file. */
function scanClientCalls(): { file: string; callee: string; snippet: string; keys: string[] }[] {
    const found: { file: string; callee: string; snippet: string; keys: string[] }[] = [];
    for (const { path, callees } of CLIENT_CALL_SITES) {
        const src = readFileSync(resolve(repoRoot, path), 'utf8');
        for (const callee of callees) {
            const needle = `${callee}(`;
            let from = 0;
            for (;;) {
                const idx = src.indexOf(needle, from);
                if (idx === -1) break;
                // Must be a standalone identifier (not a suffix of a longer name).
                const prev = idx > 0 ? src[idx - 1] : '';
                if (/[a-zA-Z0-9_$]/.test(prev)) { from = idx + needle.length; continue; }
                const block = extractCallBlock(src, idx + needle.length);
                if (block) {
                    found.push({
                        file: path,
                        callee,
                        snippet: src.slice(idx, idx + 60).replace(/\n/g, ' '),
                        keys: extractPayloadKeys(block),
                    });
                }
                from = idx + needle.length;
            }
        }
    }
    return found;
}

/** Field names declared on the chatMessages table in convex/schema.ts. */
function extractChatMessagesSchemaFields(): string[] {
    const start = schemaSource.indexOf('chatMessages: defineTable({');
    expect(start, 'chatMessages table must exist in convex/schema.ts').toBeGreaterThan(-1);
    const block = extractCallBlock(schemaSource, start);
    if (!block) return [];
    const fields: string[] = [];
    for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;
        const m = /^([a-zA-Z_][a-zA-Z0-9_]*):\s*(?:v\.|nullable)/.exec(trimmed);
        if (m) fields.push(m[1]);
    }
    return fields;
}

describe('sendChatMessage client↔server contract — the messages-don\'t-send regression guard', () => {
    const validatorFields = extractValidatorFields();
    const calls = scanClientCalls();

    it('scanner actually finds client call sites (never let this test rot into a vacuous pass)', () => {
        expect(calls.length).toBeGreaterThanOrEqual(3);
        for (const site of CLIENT_CALL_SITES) {
            expect(calls.some(c => c.file === site.path), `no sendChatMessage call found in ${site.path} — update this test after renames`).toBe(true);
        }
    });

    it('validator declares the attachment fields the client sends (2026-09-14 incident)', () => {
        expect(validatorFields).toContain('attachments');
        expect(validatorFields).toContain('attachmentNames');
        expect(validatorFields).toContain('content');
        expect(validatorFields).toContain('conversationId');
        expect(validatorFields).toContain('idempotencyKey');
    });

    it.each(calls.map(c => [`${c.file} → ${c.snippet}`, c] as const))(
        'client payload keys are all accepted by the validator: %s',
        (_label, call) => {
            const extra = call.keys.filter(k => !validatorFields.includes(k));
            expect(extra, [
                `Client sends field(s) [${extra.join(', ')}] that sendChatMessage's validator does NOT accept.`,
                'Convex rejects the WHOLE mutation with ArgumentValidationError — every send fails,',
                'including plain-text messages. This is the exact messages-don\'t-send regression.',
                'Fix: add the field to convex/myFunctions.ts sendChatMessage args (or stop sending it).',
            ].join(' ')).toEqual([]);
        },
    );

    it('chatMessages table schema has a home for the fields the handler may write', () => {
        const schemaFields = extractChatMessagesSchemaFields();
        for (const field of ['attachments', 'attachmentNames', 'idempotencyKey']) {
            expect(schemaFields, `chatMessages table must declare '${field}' or the insert fails exactly like the validator did`).toContain(field);
        }
    });

    it('no client call site passes a bare .map() result for attachment fields (the empty-array trap)', () => {
        // The incident payload had `attachments: []` + `attachmentNames: []` on a
        // text-only send because `.map()` on an empty array is `[]`, not undefined.
        // Empty arrays are still EXTRA FIELDS for a validator that doesn't know them,
        // and junk data for one that does. Require an explicit non-empty guard.
        for (const { path } of CLIENT_CALL_SITES) {
            const src = readFileSync(resolve(repoRoot, path), 'utf8');
            const bare = /attachments:\s*attachments\.map\(/.exec(src);
            expect(bare, [
                `${path} contains \`attachments: attachments.map(...)\` without a length guard.`,
                'A bare .map() yields [] on text-only sends — an extra field the validator',
                'may not accept (the exact 2026-09-14 incident). Guard it:',
                "`attachments: attachments.length > 0 ? attachments.map(a => a.storageId) : undefined`",
            ].join(' ')).toBeNull();
        }
    });
});
