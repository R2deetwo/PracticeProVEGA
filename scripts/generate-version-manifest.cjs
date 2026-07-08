/**
 * generate-version-manifest.js
 *
 * Writes /public/version.json with the current git commit SHA and build
 * timestamp. This file is served as a static asset by Vercel and fetched
 * by the client to detect when a new deploy has shipped.
 *
 * The client compares the SHA in version.json against the SHA baked into
 * the current bundle (import.meta.env.VITE_BUILD_SHA). If they differ,
 * a refresh prompt appears.
 *
 * Run automatically before `vite build` via the `prebuild` npm script.
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

const manifest = {
  sha,
  branch,
  builtAt: timestamp,
  commitTime: isoTimestamp,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[version] wrote public/version.json  sha=${sha.slice(0, 8)}  branch=${branch}  builtAt=${timestamp}`);
