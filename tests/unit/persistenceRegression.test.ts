/**
 * UPDATE-REFRESH PERSISTENCE (2026-09-14) — regression suite for the
 * "refresh to update" data-loss class.
 *
 * USER CONTEXT (two long-running complaints, same root cause):
 *   1. "Why does it keep telling me every single time that I am all set in
 *      a toast notification every time I do a refresh to update?"
 *   2. "I very often have to keep adding a new API key 'cause the AI resets
 *      and asks for consent like it is the first time."
 *
 * ROOT CAUSE: useVersionCheck.refresh() deleted every localStorage key
 * except an allow-list. The allow-list whack-a-mole missed:
 *   • practicepro_checklist_dismissed_<firmId>  → checklist re-armed →
 *     the "You're all set!" celebration re-fired on EVERY update (GATE 2's
 *     ref starts false each mount, so all-done always looked like a fresh
 *     transition).
 *   • practicepro_custom_gemini_key             → device key copy gone →
 *     Settings showed "no key" even though the server copy existed.
 *   • practicepro:aloa:session:*                → ALOA conversations
 *     restarted from scratch ("like it is the first time").
 *
 * THE FIX (locked in here):
 *   A. refresh() no longer wipes localStorage AT ALL — the Cache API clear
 *      + cache-busting URL param already deliver the new bundle.
 *   B. The checklist dismissal ALSO lives on the firm record
 *      (firms.checklistDismissedAt) so it survives reinstalls and new
 *      devices, with the Settings → Help restore path clearing BOTH stores.
 *   C. Settings → Agents reflects the SERVER key state (user.geminiApiKey)
 *      and the indexer prompt saves device + server copies like the
 *      settings panel does.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const repoRoot = here.includes("/tests/unit/")
  ? resolve(dirname(here), "../..")
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const versionCheck = read("src/hooks/useVersionCheck.ts");
const schema = read("convex/schema.ts");
const myFunctions = read("convex/myFunctions.ts");
const checklist = read("src/components/GettingStartedChecklist.tsx");
const settingsView = read("src/components/settings/SettingsView.tsx");
const agentSettings = read("src/components/settings/AgentSettings.tsx");
const aloaX = read("src/components/indexer/AloaXView.tsx");

describe("A. refresh() must never delete user data again", () => {
  it("no longer enumerates localStorage keys for removal", () => {
    expect(versionCheck).not.toContain("keysToRemove");
    expect(versionCheck).not.toContain("PRESERVE_PATTERNS");
  });

  it("no localStorage.removeItem / .key( anywhere in the hook", () => {
    expect(versionCheck).not.toMatch(/localStorage\.removeItem/);
    expect(versionCheck).not.toMatch(/localStorage\.key\(/);
  });

  it("still clears the HTTP caches and reloads with a cache-buster (the actual update mechanics)", () => {
    expect(versionCheck).toMatch(/caches\.keys\(\)/);
    expect(versionCheck).toMatch(/_refresh/);
    expect(versionCheck).toMatch(/window\.location\.replace/);
  });
});

describe("B. Checklist dismissal is durable (server-side)", () => {
  it("schema: firms.checklistDismissedAt exists", () => {
    expect(schema).toMatch(/checklistDismissedAt:\s*v\.optional\(v\.number\(\)\)/);
  });

  it("the checklist query returns the server dismissal flag", () => {
    expect(myFunctions).toMatch(/dismissed:\s*!!\(firm as any\)\.checklistDismissedAt/);
  });

  it("setGettingStartedChecklistDismissed is session-verified (resolveCaller), not email-trusting", () => {
    const fn = myFunctions.slice(
      myFunctions.indexOf("export const setGettingStartedChecklistDismissed"),
    );
    expect(fn).toContain("resolveCaller");
    expect(fn).not.toMatch(/args\.email\s*===/); // no caller-supplied identity path
  });

  it("the widget adopts the server flag when it arrives", () => {
    expect(checklist).toMatch(/checklist\?\.dismissed === true/);
  });

  it("BOTH dismiss paths persist to the server (celebration + manual X)", () => {
    // persistDismissal(true) must appear at least twice: once inside the
    // celebration confirmation, once in handleDismiss.
    const calls = checklist.match(/persistDismissal\(true\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("Settings → Help 'Restore Setup Checklist' clears the server flag too", () => {
    expect(settingsView).toContain("setGettingStartedChecklistDismissed");
    expect(settingsView).toMatch(/dismissed: false/);
  });
});

describe("C. The AI key is honest about where it lives", () => {
  it("Settings → Agents reflects the server key (not just the device copy)", () => {
    expect(agentSettings).toContain("api.myFunctions.getUserApiKey");
    expect(agentSettings).toMatch(/hasServerKey/);
  });

  it("the indexer prompt saves device AND server copies", () => {
    expect(aloaX).toContain("api.myFunctions.saveUserApiKey");
    expect(aloaX).toContain("saveApiKeyEverywhere");
  });

  it("no surface still claims the key 'never' reaches our servers (it syncs to the account)", () => {
    expect(agentSettings).not.toMatch(/never sent to our servers/i);
    expect(aloaX).not.toMatch(/stored only on this device/i);
    const aloaChat = read("src/components/aloa/AloaChat.tsx");
    expect(aloaChat).not.toMatch(/never sent to our servers/i);
  });
});
