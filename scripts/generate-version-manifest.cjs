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

// CRO AUDIT FIX — Use GITHUB_SHA when available (GitHub Actions), because
// `git rev-parse HEAD` during CI returns the bot's version-bump commit, not
// the user's code commit. GITHUB_SHA is always the commit that triggered the
// workflow run — exactly what we want for version comparison.
// Fall back to `git rev-parse HEAD` for local builds.
//
// VERCEL FALLBACK — Vercel's build environment is NOT a git repo (the CLI
// uploads the working tree, not the .git directory), so `git rev-parse HEAD`
// fails with "fatal: not a git repository". Vercel sets VERCEL_GIT_COMMIT_SHA
// automatically when deploying from a Git integration. For CLI deploys without
// Git integration, we also accept an explicit COMMIT_SHA env var (passed via
// `vercel --prod --env COMMIT_SHA=...` or set in the project env vars).
const sha =
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_SHA ||
  run('git rev-parse HEAD', 'unknown');
const branch =
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  run('git rev-parse --abbrev-ref HEAD', 'unknown');
const timestamp = new Date().toISOString();
const isoTimestamp = run('git log -1 --format=%cI', timestamp);

// Status starts as 'building'. The CI workflow updates this to 'healthy'
// after the smoke test passes. If the smoke test fails, it stays 'building'
// (which the client treats as "don't prompt yet") and a subsequent fix
// push will overwrite it.
//
// APK fields: read from android/app/version.properties if it exists.
// These are populated at build time. The GH Actions workflow updates
// apkUrl after publishing the release. apkBuildStatus starts as 'building'
// and is set to 'healthy' only after the APK build succeeds + release is
// published. Failed APK builds leave apkBuildStatus as 'building' (or
// 'broken' if explicitly set), so the APK update check never prompts
// users to download a failed build.
//
// IMPORTANT: If an existing version.json is found (e.g. committed by the
// GH Actions workflow with APK release info), PRESERVE the APK fields
// (apkUrl, apkBuildStatus, apkBuiltAt) instead of overwriting them.
// This ensures the APK update info survives Vercel's build process.

const versionPropsPath = path.join(ROOT, 'android', 'app', 'version.properties');
let apkVersion = null;
let apkVersionCode = null;
if (fs.existsSync(versionPropsPath)) {
  const props = fs.readFileSync(versionPropsPath, 'utf8');
  const major = parseInt((props.match(/^MAJOR=(\d+)/m) || [])[1] || '1');
  const minor = parseInt((props.match(/^MINOR=(\d+)/m) || [])[1] || '0');
  const patch = parseInt((props.match(/^PATCH=(\d+)/m) || [])[1] || '0');
  apkVersion = `${major}.${minor}.${patch}`;
  apkVersionCode = major * 10000 + minor * 100 + patch;
}

// Preserve APK fields from existing version.json if present
let existingApkUrl = null;
let existingApkBuildStatus = 'building';
let existingApkBuiltAt = null;
if (fs.existsSync(OUT)) {
  try {
    const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    existingApkUrl = existing.apkUrl || null;
    existingApkBuildStatus = existing.apkBuildStatus || 'building';
    existingApkBuiltAt = existing.apkBuiltAt || null;
    console.log(`[version] Preserving APK fields from existing version.json: apkUrl=${existingApkUrl ? 'set' : 'null'}, apkBuildStatus=${existingApkBuildStatus}`);
  } catch {
    // File exists but is invalid JSON — ignore and generate fresh
  }
}

const manifest = {
  sha,
  branch,
  builtAt: timestamp,
  commitTime: isoTimestamp,
  status: 'building',        // 'building' | 'healthy' | 'broken'
  stableSince: null,         // ISO timestamp when status became 'healthy'
  // APK update fields — preserved from existing version.json if present
  apkVersion,                // e.g. "1.0.282" — from version.properties
  apkVersionCode,            // e.g. 10282
  apkUrl: existingApkUrl,    // preserved from GH Actions workflow
  apkBuildStatus: existingApkBuildStatus, // preserved — 'building' | 'healthy' | 'broken'
  apkBuiltAt: existingApkBuiltAt || timestamp, // preserved or current
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[version] wrote public/version.json  sha=${sha.slice(0, 8)}  branch=${branch}  status=${manifest.status}`);
