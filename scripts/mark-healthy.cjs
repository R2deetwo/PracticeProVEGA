/**
 * mark-healthy.cjs
 *
 * Post-build step: marks version.json as 'healthy' AFTER the Vite build
 * has succeeded. This is called by Vercel's buildCommand:
 *
 *     "buildCommand": "npm run build && node scripts/mark-healthy.cjs"
 *
 * WHY THIS EXISTS
 * ---------------
 * Previously, generate-version-manifest.cjs (the prebuild step) wrote
 * version.json with status="building". A separate Vercel CLI deploy step
 * in GitHub Actions was supposed to mark it "healthy" afterwards. But
 * that step was fragile (continue-on-error: true) and frequently failed
 * silently — leaving production stuck at status="building" forever.
 *
 * With this script, version.json is marked healthy atomically as part
 * of the SAME build that Vercel's native integration runs. No second
 * deploy step, no race condition, no silent failures.
 *
 * The client (useVersionCheck.ts) only prompts users to refresh when
 * status==="healthy", so this script is what unblocks the update prompt.
 *
 * CRITICAL: Updates BOTH public/version.json (source) AND dist/version.json
 * (build output, which is what Vercel actually deploys). Vite copies
 * public/ → dist/ during build, so dist/version.json is a stale copy
 * of the "building" version at this point — we must overwrite it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_VERSION = path.join(ROOT, 'public', 'version.json');
const DIST_VERSION = path.join(ROOT, 'dist', 'version.json');

if (!fs.existsSync(PUBLIC_VERSION)) {
  console.error('[mark-healthy] public/version.json not found — was prebuild run?');
  process.exit(1);
}

const now = new Date().toISOString();
const v = JSON.parse(fs.readFileSync(PUBLIC_VERSION, 'utf8'));

v.status = 'healthy';
v.stableSince = now;
v.markedHealthyAt = now;

const serialized = JSON.stringify(v, null, 2) + '\n';

// Update source
fs.writeFileSync(PUBLIC_VERSION, serialized, 'utf8');
console.log(`[mark-healthy] public/version.json marked healthy at ${now}`);

// Update build output (this is what Vercel deploys)
if (fs.existsSync(path.dirname(DIST_VERSION))) {
  fs.writeFileSync(DIST_VERSION, serialized, 'utf8');
  console.log(`[mark-healthy] dist/version.json marked healthy at ${now}`);
} else {
  console.warn('[mark-healthy] dist/ directory not found — was the build run?');
  console.warn('[mark-healthy] Only public/version.json was updated.');
}

console.log(`[mark-healthy]   sha:     ${v.sha}`);
console.log(`[mark-healthy]   branch:  ${v.branch}`);
console.log(`[mark-healthy]   builtAt: ${v.builtAt}`);
