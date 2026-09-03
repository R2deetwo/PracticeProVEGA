import { defineConfig } from "vitest/config";
import path from "path";

// Round 10 — in-repo test suite (previously the resolver tests lived only
// in an agent sandbox and were lost to resets twice; the SaaS hardening
// plan moves them INTO the repo and wires them into CI before any deploy).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Fail loudly on unhandled rejections — silent failures are exactly
    // what this round is about eliminating.
    dangerouslyIgnoreUnhandledErrors: false,
    reporters: ["default"],
  },
  resolve: {
    // Nothing special needed: convex/ files import ./_generated/* which
    // are committed, and convex/server resolves via node_modules.
    alias: {},
  },
});
