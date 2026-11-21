/**
 * ingestionEngine — the TS port of the Python legal ingester's pure core
 * (tools/legal_ingester), shared by:
 *   - convex/legal/worker.ts  (the autonomous in-Convex worker cron)
 *   - convex/legal/engine.ts  (founder-app control surface)
 *   - tests/unit/legalIngestionEngine.test.ts (the parity pins)
 *
 * Everything here is PURE: zero dependencies, no Node builtins, safe to
 * import from Convex actions, vitest, and the browser bundle alike (the
 * same convention as src/services/voice/draftUtils.ts).
 */

export * from "./robots";
export * from "./extract";
export * from "./classify";
export * from "./chunk";
export * from "./meta";
export * from "./seeds";
export * from "./urlFilter";
