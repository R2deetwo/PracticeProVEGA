import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 20 — write-free queries (the Security & Access crash class).
 *
 * Convex queries are STRICTLY read-only at runtime: any DB write throws, the
 * subscribed page renders once and then falls into the error boundary.
 * Round 20 found FIVE production-dead endpoints of exactly this shape —
 * `verifyToken`, `getGatehouseLogs`, `getGatekeeperProperties`,
 * `searchExpectedVisitors` (visitorManagement.ts) and `getGatehouseStations`
 * (gatehouseAccounts.ts) — all throttled via checkRateLimit, which WRITES
 * (inserts/patches the rateLimits table). The Security & Access page and the
 * whole /gatehouse terminal were dead in production.
 *
 * These endpoints are mutations now, with the throttle intact. This pin keeps
 * the class out of the codebase: no `query`/`internalQuery` may perform a
 * write directly (ctx.db.*) or via a known writing helper, schedule work, or
 * run a mutation from inside its handler.
 */
const convexDir = join(__dirname, '..', '..', 'convex');

/** Writing helpers (they take ctx and write) — extend when a new one lands. */
const WRITING_HELPERS = [
  'checkRateLimit',
  'logSecurityEventInline',
  'logSecurityEventInternal',
  'touchStationSession',
  'requireGatehouseAccess',
];

/** Parse top-level `export const NAME = KIND({...});` blocks. */
function exportBlocks(source: string): { name: string; kind: string; body: string; file: string }[] {
  const out: { name: string; kind: string; body: string; file: string }[] = [];
  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(/^export const (\w+) = (query|mutation|internalQuery|internalMutation|action|internalAction|httpAction)\(/);
    if (!match) { i += 1; continue; }
    const [, name, kind] = match;
    let depth = 0;
    let started = false;
    const body: string[] = [];
    let j = i;
    for (; j < lines.length; j += 1) {
      for (const ch of lines[j]) {
        if (ch === '(' || ch === '{') { depth += 1; started = true; }
        if (ch === ')' || ch === '}') depth -= 1;
      }
      body.push(lines[j]);
      if (started && depth === 0) break;
    }
    out.push({ name, kind, body: body.join('\n'), file: '' });
    i = j + 1;
  }
  return out;
}

const files = readdirSync(convexDir).filter((f) => f.endsWith('.ts') && !f.startsWith('_generated'));
const queries: { name: string; kind: string; body: string; file: string }[] = [];
for (const file of files) {
  const source = readFileSync(join(convexDir, file), 'utf8');
  for (const block of exportBlocks(source)) queries.push({ ...block, file });
}

describe('Round 20 — Convex queries never write (the Security & Access crash class)', () => {
  it('scans the whole convex/ directory (the sweep stays wired)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(queries.length).toBeGreaterThan(100);
  });

  it.each(queries.filter((q) => q.kind === 'query' || q.kind === 'internalQuery'))(
    '%s (%s in %s) performs no DB write',
    (q) => {
      const directWrite = /\.db\.(insert|patch|delete|replace)\(/.test(q.body);
      const indirectWrite =
        /ctx\.runMutation\(|ctx\.runAction\(|ctx\.scheduler\./.test(q.body) ||
        WRITING_HELPERS.some((helper) => new RegExp(`\\b${helper}\\(`).test(q.body));
      if (directWrite || indirectWrite) {
        const how = [
          directWrite ? 'a direct ctx.db write' : null,
          indirectWrite ? 'a writing helper / runMutation / scheduler call' : null,
        ].filter(Boolean).join(' + ');
        throw new Error(
          `${q.name} in convex/${q.file} is a ${q.kind} and performs ${how}. ` +
            'Convex queries are read-only at runtime — the call throws in production and the ' +
            'subscribed page falls into the error boundary. Convert it to a mutation (Round 20 ' +
            'pattern: see visitorManagement.verifyToken) and load it on press/mount instead of subscribing.',
        );
      }
    },
  );

  it('the five Round 20 endpoints stay mutations with their throttles intact', () => {
    const vm = readFileSync(join(convexDir, 'visitorManagement.ts'), 'utf8');
    for (const name of ['verifyToken', 'getGatehouseLogs', 'getGatekeeperProperties', 'searchExpectedVisitors']) {
      const block = exportBlocks(vm).find((b) => b.name === name);
      expect(block, `${name} exists`).toBeTruthy();
      expect(block!.kind, `${name} must stay a mutation (queries cannot throttle-by-write)`).toBe('mutation');
      expect(block!.body).toContain('checkRateLimit(');
    }
    const ga = readFileSync(join(convexDir, 'gatehouseAccounts.ts'), 'utf8');
    const stations = exportBlocks(ga).find((b) => b.name === 'getGatehouseStations');
    expect(stations, 'getGatehouseStations exists').toBeTruthy();
    expect(stations!.kind).toBe('mutation');
    expect(stations!.body).toContain('checkRateLimit(');
  });

  it('the client subscribes to none of the converted endpoints (load-on-press/mount only)', () => {
    const clientDir = join(__dirname, '..', '..', 'src');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = readFileSync(full, 'utf8');
          if (/useQuery\(\s*api\.(visitorManagement|gatehouseAccounts)\.(verifyToken|getGatehouseLogs|getGatekeeperProperties|searchExpectedVisitors|getGatehouseStations)/.test(source)) {
            offenders.push(full);
          }
        }
      }
    };
    walk(clientDir);
    expect(offenders).toEqual([]);
  });
});
