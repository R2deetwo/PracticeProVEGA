/**
 * generate-version-manifest.cjs
 *
 * Writes /public/version.json with build metadata. This file is served as a
 * static asset by Vercel and fetched by the client to detect when a new
 * deploy has shipped AND whether it's safe to refresh to.
 *
 * BUILD HEALTH PROTECTION:
 * The manifest includes a `status` field that the client checks before
 * prompting the user to refresh:
 *   - 'building'  → build in progress, don't prompt yet
 *   - 'healthy'   → build succeeded and passed smoke test, safe to prompt
 *   - 'broken'    → build failed or smoke test failed, DO NOT prompt
 *
 * The CI workflow sets status to 'healthy' ONLY after:
 *   1. vite build succeeds
 *   2. A basic smoke test verifies the build output is valid
 *   3. The Vercel deploy completes
 *
 * If a build is later discovered to be broken, we can manually update
 * version.json on the server (or push a fix) and the client will stop
 * prompting users to refresh to the broken version.
 *
 * STABLE-SINCE DELAY:
 * `stableSince` is the timestamp when the build was marked healthy. The
 * client waits 5 minutes after this before prompting — this gives time
 * for runtime issues to be detected and reported before any user is
 * asked to refresh.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'version.json');

function run(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const sha = run('git rev-parse HEAD', 'unknown');
const branch = run('git rev-parse --abbrev-ref HEAD', 'unknown');
const timestamp = new Date().toISOString();
const isoTimestamp = run('git log -1 --format=%cI', timestamp);

// Status starts as 'building'. The CI workflow updates this to 'healthy'
// after the smoke test passes. If the smoke test fails, it stays 'building'
// (which the client treats as "don't prompt yet") and a subsequent fix
// push will overwrite it.
const manifest = {
  sha,
  branch,
  builtAt: timestamp,
  commitTime: isoTimestamp,
  status: 'building',        // 'building' | 'healthy' | 'broken'
  stableSince: null,         // ISO timestamp when status became 'healthy'
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[version] wrote public/version.json  sha=${sha.slice(0, 8)}  branch=${branch}  status=${manifest.status}`);
