/**
 * bust-css-cache.cjs
 *
 * CACHE-POISONING HOTFIX (2026-08-31) — rotates CSS asset URLs per deploy.
 *
 * WHAT HAPPENED
 * -------------
 * Vite emits content-hashed filenames, so the compiled CSS keeps the SAME
 * URL (e.g. /assets/index-DdjUCuWC.css) across every deployment where the
 * CSS source is unchanged. During a deployment's asset-propagation window,
 * a request for that URL can hit a CDN edge node that briefly serves the
 * SPA fallback (index.html) instead of the real file. Cloudflare's edge for
 * *.workers.dev domains does not purge or revalidate those entries when a
 * new version deploys, so an edge PoP (and the browser) can keep serving
 * HTML for the CSS URL indefinitely — a permanently unstyled site that a
 * normal refresh cannot fix. Observed in production on 2026-08-31: the CSS
 * was present in both the Vercel and Cloudflare deployments (verified in
 * CI build logs), yet some edge PoPs answered /assets/index-DdjUCuWC.css
 * with 200 text/html (the 16 KB SPA fallback) instead of the 322 KB
 * text/css file.
 *
 * THE FIX
 * -------
 * After `vite build` writes dist/, this script appends the deploy id (git
 * sha from public/version.json, which prebuild sets from GITHUB_SHA) to
 * every CSS filename and rewrites all references in dist/ (index.html and
 * every JS bundle). Every deploy therefore publishes under a brand-new CSS
 * URL that has no stale cache entries at any edge PoP or in any browser.
 *
 * The entry JS already rotates on every build by design (the baked
 * VITE_BUILD_TIMESTAMP changes its content hash), so only the CSS needed
 * this treatment. Cost is negligible: the CSS is ~46 kB gzipped.
 *
 * This runs as part of `npm run build` (see package.json), so every build
 * path — Vercel workflow, Cloudflare workflow, APK workflow (cap:sync),
 * local builds — picks it up automatically.
 *
 * WHY A POST-BUILD SCRIPT, NOT A VITE PLUGIN
 * ------------------------------------------
 * Vite's internal html/asset post-processing re-derives emitted filenames
 * from chunk metadata (viteMetadata.importedCss), so renaming bundle
 * entries inside a generateBundle hook does not survive the write phase.
 * Renaming files on disk after the build is deterministic and
 * framework-independent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const VERSION_FILE = path.join(ROOT, 'public', 'version.json');

// Deploy id: prefer the sha prebuild recorded in version.json (set from
// GITHUB_SHA in CI) so the CSS URL matches the sha reported by
// /version.json. Fall back to git, then to a per-run timestamp.
function deployId() {
  try {
    const manifest = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (manifest.sha && manifest.sha !== 'unknown') {
      return String(manifest.sha).slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
    }
  } catch {}
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf8' })
      .trim()
      .slice(0, 8)
      .replace(/[^a-zA-Z0-9]/g, '');
  } catch {}
  return Date.now().toString(36);
}

function fail(msg) {
  console.error(`[cache-bust] ${msg}`);
  process.exit(1);
}

const id = deployId();
if (!id) fail('could not determine a deploy id');

if (!fs.existsSync(ASSETS)) {
  fail('dist/assets/ not found — did `vite build` run?');
}

// 1. Collect CSS renames: assets/<name>.css -> assets/<name>-<id>.css
const renames = [];
for (const entry of fs.readdirSync(ASSETS)) {
  if (!entry.endsWith('.css')) continue;
  if (entry.endsWith(`-${id}.css`)) continue; // already rotated (idempotent)
  const oldBase = entry; // e.g. index-DdjUCuWC.css
  const newBase = entry.replace(/\.css$/, `-${id}.css`);
  renames.push([oldBase, newBase]);
}

if (renames.length === 0) {
  console.log(`[cache-bust] no CSS files to rotate (deploy id ${id}) — nothing to do`);
  process.exit(0);
}

// 2. Rename the files on disk.
for (const [oldBase, newBase] of renames) {
  fs.renameSync(path.join(ASSETS, oldBase), path.join(ASSETS, newBase));
}

// 3. Rewrite references in every text file under dist/ (index.html, JS
//    bundles, any nested css). We match the bare filename so both
//    "/assets/<name>.css" and "assets/<name>.css" spellings are covered.
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
let patchedFiles = 0;
for (const file of walk(DIST)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // binary-ish; skip
  }
  let updated = content;
  for (const [oldBase, newBase] of renames) {
    if (updated.includes(oldBase)) {
      updated = updated.split(oldBase).join(newBase);
    }
  }
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    patchedFiles++;
  }
}

// 4. Verify: no stale reference may survive anywhere in dist/.
const stale = [];
for (const file of walk(DIST)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  try {
    const content = fs.readFileSync(file, 'utf8');
    for (const [oldBase] of renames) {
      if (content.includes(oldBase)) stale.push(`${file}: ${oldBase}`);
    }
  } catch {}
}
if (stale.length > 0) {
  fail(`stale CSS references survived the rewrite:\n  ${stale.join('\n  ')}`);
}

console.log(
  `[cache-bust] Rotated ${renames.length} CSS asset URL(s) with deploy id ${id}: ` +
    renames.map(([o, n]) => `${o} -> ${n}`).join(', ') +
    `  (${patchedFiles} file reference(s) patched)`
);
