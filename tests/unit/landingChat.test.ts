/**
 * landingChat — the website assistant's live-AI engine (2026-11-18 owner
 * direction: "we cannot have something that is not smart or answers only
 * preset answers").
 *
 * Pins the pure surface of convex/landingChat.ts:
 *   - CORS allow-list: production/staging/mirror/local-dev allowed,
 *     unknown origins rejected, no-Origin (curl) allowed
 *   - key chain (owner bug report 2026-11-19 "still canned — I even gave
 *     an API key"): the founder's STORED firm key powers the anonymous
 *     landing chat when no platform env key exists
 *   - history sanitisation: clamped, merged, never model-first
 *   - reference serialisation: bounded, control-char stripped, null-safe
 *   - answer parsing: JSON, fenced JSON, garbage → null, field clamping
 *   - system prompt contract: persona per product, reference embedded,
 *     security + boundary lines always present
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  landingCorsHeaders,
  resolveLandingApiKeys,
  sanitizeHistory,
  serializeReference,
  parseLandingAnswer,
  buildLandingSystemPrompt,
} from '../../convex/landingChat';

// ─── ROUTE REGISTRATION RATCHET (the 2026-11-20 root cause) ─────────────
// The landing chat was registered POST-ONLY in convex/http.ts, so Convex's
// httpRouter answered every CORS PREFLIGHT (OPTIONS) with 404 — the
// handler's OPTIONS branch was dead code and EVERY browser visitor fell
// back to the canned catalogue while curl (no preflight) kept "verifying"
// the endpoint as live. These pins make a POST-only re-registration fail
// the suite immediately.
describe('http route registration — preflight must be routable', () => {
  const httpSrc = readFileSync(join(process.cwd(), 'convex/http.ts'), 'utf8');

  it('REGRESSION: /ai/landing-chat is registered for BOTH POST and OPTIONS', () => {
    expect(httpSrc).toMatch(/path:\s*"\/ai\/landing-chat",\s*method:\s*"POST"/);
    expect(httpSrc).toMatch(/path:\s*"\/ai\/landing-chat",\s*method:\s*"OPTIONS"/);
  });

  it('REGRESSION: /ai/stream is registered for BOTH POST and OPTIONS (browser viaServerProxy mode)', () => {
    expect(httpSrc).toMatch(/path:\s*"\/ai\/stream",\s*method:\s*"POST"/);
    expect(httpSrc).toMatch(/path:\s*"\/ai\/stream",\s*method:\s*"OPTIONS"/);
  });

  it('REGRESSION: /api/push-reply is registered for BOTH POST and OPTIONS', () => {
    expect(httpSrc).toMatch(/path:\s*"\/api\/push-reply",\s*method:\s*"POST"/);
    expect(httpSrc).toMatch(/path:\s*"\/api\/push-reply",\s*method:\s*"OPTIONS"/);
  });
});

// ─── CSP RATCHET (the 2026-11-20 "STILL canned" root cause, round 3) ──────
// The landing chat fetches the Convex HTTP-action surface at
// https://<deployment>.convex.site — but the <meta http-equiv CSP> in the
// HTML shells allowed only *.convex.cloud. A REAL browser blocks the fetch
// at the CSP layer (before any network request), so every visitor silently
// fell back to the canned catalogue — while curl (never enforces CSP) and
// fetch-mocked browser tests kept "verifying" the endpoint as live. These
// pins make dropping the directive fail the suite immediately.
describe('CSP allows the Convex HTTP-action domain browsers must reach', () => {
  const shells = ['index.html', 'admin.html'] as const;

  for (const shell of shells) {
    it(`REGRESSION: ${shell} connect-src allows https://*.convex.site (landing chat + /ai/stream)`, () => {
      const html = readFileSync(join(process.cwd(), shell), 'utf8');
      const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/);
      expect(csp).not.toBeNull();
      const connectSrc = csp![1].split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('connect-src'));
      expect(connectSrc).toBeDefined();
      expect(connectSrc!).toContain('https://*.convex.site');
    });
  }
});

describe('landingCorsHeaders', () => {
  it('allows the production, staging and mirror origins with echo', () => {
    for (const origin of [
      'https://practice-pro-vega.vercel.app',
      'https://staging-practice-pro-vega.vercel.app',
      'https://practice-pro-vega.prototypechigo.workers.dev',
    ]) {
      const headers = landingCorsHeaders(origin);
      expect(headers).not.toBeNull();
      expect(headers!['Access-Control-Allow-Origin']).toBe(origin);
    }
  });

  it('allows any localhost/127.0.0.1 port for local development', () => {
    expect(landingCorsHeaders('http://localhost:5173')).not.toBeNull();
    expect(landingCorsHeaders('http://127.0.0.1:8080')).not.toBeNull();
  });

  it('rejects unknown origins (null → caller 403s)', () => {
    expect(landingCorsHeaders('https://evil.example.com')).toBeNull();
    expect(landingCorsHeaders('https://someone-else.vercel.app')).toBeNull();
  });

  it('allows THIS project’s Vercel preview deployments (founder build testing)', () => {
    expect(
      landingCorsHeaders('https://practice-pro-vega-git-main-r2deetwo.vercel.app')
    ).not.toBeNull();
    expect(
      landingCorsHeaders('https://practice-pro-vega-fk3j2n.vercel.app')
    ).not.toBeNull();
    // The allow-echo must name the caller exactly.
    const headers = landingCorsHeaders('https://practice-pro-vega-git-main-r2deetwo.vercel.app');
    expect(headers!['Access-Control-Allow-Origin']).toBe(
      'https://practice-pro-vega-git-main-r2deetwo.vercel.app'
    );
  });

  it('allows the agent sandbox preview hosts where builds are tested', () => {
    expect(landingCorsHeaders('https://preview-web64c0fe4.space-z.ai')).not.toBeNull();
    expect(landingCorsHeaders('https://preview-anything-at-all.space-z.ai')).not.toBeNull();
    // But not arbitrary space-z.ai hosts.
    expect(landingCorsHeaders('https://evil.space-z.ai')).toBeNull();
  });

  it('allows no-Origin callers (curl / server-side) with empty headers', () => {
    expect(landingCorsHeaders(null)).toEqual({});
    expect(landingCorsHeaders('')).toEqual({});
  });
});

// ─── Key chain (owner bug report 2026-11-19) ───────────────────────────────
// "I even gave an api key as well so why is it still not working" — the key
// set in Settings → AI Agent is stored on the firm (firms.aiSettings), which
// the anonymous landing endpoint could never see when it read env vars only;
// every call 503'd and the client silently regressed to the canned catalogue.

describe('resolveLandingApiKeys', () => {
  it('REGRESSION: the founder’s stored firm key powers the landing chat when no env key exists', () => {
    expect(resolveLandingApiKeys(undefined, 'founder-stored-key')).toEqual(['founder-stored-key']);
    expect(resolveLandingApiKeys('', 'founder-stored-key')).toEqual(['founder-stored-key']);
    expect(resolveLandingApiKeys(null, 'founder-stored-key')).toEqual(['founder-stored-key']);
  });

  it('the platform env key is tried first (operator-controlled rotation)', () => {
    expect(resolveLandingApiKeys('platform-env-key', 'founder-stored-key')).toEqual([
      'platform-env-key',
      'founder-stored-key',
    ]);
  });

  it('de-duplicates identical keys so a retry never double-spends the same key', () => {
    expect(resolveLandingApiKeys('same-key', 'same-key')).toEqual(['same-key']);
    expect(resolveLandingApiKeys(' same-key ', 'same-key')).toEqual(['same-key']);
  });

  it('REGRESSION (2026-11-20): a dead GEMINI_API_KEY no longer shadows a healthy GEMINI_DEMO_KEY', () => {
    // Staging bug: the env resolution picked GEMINI_API_KEY first and STOPPED,
    // so a rotated-away key 503'd the landing chat while the healthy demo key
    // sat unused beside it. Every candidate must ride along, in order.
    expect(resolveLandingApiKeys('dead-key', 'healthy-demo-key', 'founder-stored-key')).toEqual([
      'dead-key',
      'healthy-demo-key',
      'founder-stored-key',
    ]);
    expect(resolveLandingApiKeys('dead-key', 'healthy-demo-key')).toEqual([
      'dead-key',
      'healthy-demo-key',
    ]);
  });

  it('trims whitespace and returns [] when neither key is usable', () => {
    expect(resolveLandingApiKeys('   ', '   ')).toEqual([]);
    expect(resolveLandingApiKeys(undefined, null)).toEqual([]);
    expect(resolveLandingApiKeys('  spaced-key  ', undefined)).toEqual(['spaced-key']);
  });
});

describe('sanitizeHistory', () => {
  it('keeps valid turns and maps roles through', () => {
    const out = sanitizeHistory([
      { role: 'user', text: 'my landlord gave me a quit notice' },
      { role: 'assistant', text: 'Do not ignore it...' },
    ]);
    expect(out).toEqual([
      { role: 'user', text: 'my landlord gave me a quit notice' },
      { role: 'assistant', text: 'Do not ignore it...' },
    ]);
  });

  it('merges consecutive same-role turns (keeps the latest)', () => {
    const out = sanitizeHistory([
      { role: 'user', text: 'first' },
      { role: 'user', text: 'second' },
      { role: 'assistant', text: 'answer' },
    ]);
    expect(out).toEqual([
      { role: 'user', text: 'second' },
      { role: 'assistant', text: 'answer' },
    ]);
  });

  it('never starts with a model turn (Gemini contract)', () => {
    const out = sanitizeHistory([
      { role: 'assistant', text: 'hello' },
      { role: 'user', text: 'hi' },
    ]);
    expect(out[0].role).toBe('user');
  });

  it('clamps length and count, drops garbage', () => {
    const long = 'x'.repeat(500);
    const many = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: `q${i}` }));
    const out = sanitizeHistory([...many, { role: 'hacker', text: 'nope' }, { role: 'user', text: long }, 42, null]);
    expect(out.length).toBeLessThanOrEqual(8 + 1);
    expect(out.every((h) => h.text.length <= 300)).toBe(true);
    expect(out.some((h) => h.text === 'nope')).toBe(false);
  });
});

describe('serializeReference', () => {
  it('serialises a full topic and strips control characters', () => {
    const out = serializeReference({
      chip: 'Landlord or tenant problem',
      reply: 'These disputes move in steps.',
      steps: ['Put it in writing.', 'Keep everything.'],
      note: 'Never resort to self-help.',
    });
    expect(out).toContain('Topic: Landlord or tenant problem');
    expect(out).toContain('Guidance: These disputes move in steps.');
    expect(out).toContain('- Put it in writing.');
    expect(out).toContain('Caution: Never resort to self-help.');
    expect(out).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it('bounds the output size (injection surface clamp)', () => {
    const out = serializeReference({ chip: 'x', reply: 'y'.repeat(5000) });
    expect(out!.length).toBeLessThanOrEqual(1600);
  });

  it('returns null for nothing usable', () => {
    expect(serializeReference(null)).toBeNull();
    expect(serializeReference(undefined)).toBeNull();
    expect(serializeReference({})).toBeNull();
    expect(serializeReference({ chip: 42, reply: [] as never })).toBeNull();
  });
});

describe('parseLandingAnswer', () => {
  it('passes through conversational markdown text (the in-app ALOA voice)', () => {
    const out = parseLandingAnswer('**No, one week is not enough notice.**\n\nIn Lagos the notice period depends on how you pay rent.');
    expect(out).toEqual({ text: '**No, one week is not enough notice.**\n\nIn Lagos the notice period depends on how you pay rent.' });
  });

  it('flattens the LEGACY JSON shape into markdown so a half-deployed pair never breaks the panel', () => {
    const out = parseLandingAnswer(
      JSON.stringify({ intro: 'Do not ignore it.', steps: ['Read it.', 'Keep copies.'], note: 'Act early.' }),
    );
    expect(out!.text).toContain('Do not ignore it.');
    expect(out!.text).toContain('1. Read it.');
    expect(out!.text).toContain('2. Keep copies.');
    expect(out!.text).toContain('**Note:** Act early.');
  });

  it('parses JSON wrapped in code fences', () => {
    const out = parseLandingAnswer('```json\n{"intro":"Hello"}\n```');
    expect(out!.text).toBe('Hello');
  });

  it('parses JSON embedded in surrounding prose', () => {
    const out = parseLandingAnswer('Here you go: {"intro":"Answer"} hope that helps');
    expect(out!.text).toContain('Answer');
  });

  it('keeps plain prose that merely contains braces (not JSON) as text', () => {
    const out = parseLandingAnswer('A court letter {sometimes} has dates. **Read it.**');
    expect(out!.text).toContain('**Read it.**');
  });

  it('returns null for garbage (caller falls back to raw text)', () => {
    expect(parseLandingAnswer('')).toBeNull();
  });

  it('strips control characters and clamps length (render safety)', () => {
    const out = parseLandingAnswer('ok\u0000\u0007'.repeat(900) + 'x');
    expect(out!.text).not.toContain('\u0000');
    expect(out!.text.length).toBeLessThanOrEqual(1400);
  });
});

describe('buildLandingSystemPrompt', () => {
  it('carries the ALOA legal persona for vega', () => {
    const prompt = buildLandingSystemPrompt('vega', null);
    expect(prompt).toContain("ALOA, Vega's legal guide");
    expect(prompt).toContain('NOT lawyers');
    expect(prompt).toContain('Nigerian');
  });

  it('carries the ARIA property persona for atrium', () => {
    const prompt = buildLandingSystemPrompt('atrium', null);
    expect(prompt).toContain("ARIA, Atrium's property guide");
    expect(prompt).toContain('service charges');
  });

  it('always carries the non-negotiable boundary + security lines', () => {
    for (const product of ['vega', 'atrium'] as const) {
      const prompt = buildLandingSystemPrompt(product, null);
      expect(prompt).toContain('GENERAL INFORMATION, never advice');
      expect(prompt).toContain('Never invent statutes');
      expect(prompt).toContain('untrusted input');
    }
  });

  it('asks for conversational Markdown, NOT the old rigid JSON card (owner 2026-11-20: “the ALOA that works in the app”)', () => {
    const prompt = buildLandingSystemPrompt('vega', null);
    expect(prompt).toContain('conversational Markdown');
    expect(prompt).not.toContain('reply with JSON only');
  });

  it('tells the model to use the reference as background, never to copy it (anti-canned)', () => {
    const prompt = buildLandingSystemPrompt('vega', 'Topic: Quit notice');
    expect(prompt).toContain('do not copy its wording or structure');
    expect(prompt).toContain('Do NOT restate the reference material verbatim');
  });

  it('embeds the reference material when provided', () => {
    const prompt = buildLandingSystemPrompt('vega', 'Topic: Quit notice\nGuidance: match the notice period');
    expect(prompt).toContain('Topic: Quit notice');
    expect(prompt).toContain('match the notice period');
  });

  it('states the no-reference fallback explicitly', () => {
    const prompt = buildLandingSystemPrompt('vega', null);
    expect(prompt).toContain('None provided for this question');
  });
});
