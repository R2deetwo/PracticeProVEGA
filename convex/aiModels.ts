/**
 * aiModels.ts — central model registry for Convex backend AI calls.
 *
 * Convex functions cannot import from src/, so this is the backend mirror
 * of AI_CONFIG in src/utils/aiUtils.ts. KEEP THE TWO IN SYNC — when the
 * frontend registry changes tier, change the same tier here.
 *
 * Tiers:
 *   QUALITY_MODEL    — interactive, quality-critical surfaces (dictation
 *                      cleanup, contact extraction). Gemini 2.5 Flash
 *                      reasons before answering, which measurably improves
 *                      handling of Nigerian legal terminology and names.
 *   BACKGROUND_MODEL — scheduled, high-volume, cost-sensitive surfaces
 *                      (proactive morning briefings, nightly conversation
 *                      summarization). Deliberately kept on 2.0 Flash:
 *                      still fully supported by Google, materially cheaper
 *                      at cron volume, and nobody is waiting on the reply.
 *                      Revisit when 2.5-flash-lite pricing settles.
 *
 * gemini-1.5-flash is RETIRED by Google (404s since early 2026) — it must
 * never reappear in any URL in this directory.
 */

export const QUALITY_MODEL = "gemini-2.5-flash";
export const BACKGROUND_MODEL = "gemini-2.0-flash";
