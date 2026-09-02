
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function gitSha(fallback = '') {
  // CRO AUDIT FIX — read SHA from version.json first (set by prebuild script
  // which uses GITHUB_SHA when available). This ensures the SHA baked into
  // the Vite bundle matches the SHA in version.json that the client fetches
  // at runtime. Previously both used `git rev-parse HEAD` which returned
  // the bot's version-bump commit during CI, causing a SHA mismatch.
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (manifest.sha && manifest.sha !== 'unknown') {
        return manifest.sha;
      }
    }
  } catch {}
  // Fallback to git rev-parse HEAD for local dev
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    // Final fallback: unique per-build timestamp so version check always works.
    // NEVER return 'unknown' — that causes useVersionCheck to skip entirely,
    // meaning users never see the "Refresh to Update" prompt.
    return fallback || `build-${Date.now()}`
  }
}

// BULLETPROOF build timestamp — read from version.json (set by prebuild).
// This is the PRIMARY version identifier used by useVersionCheck. Unlike
// SHA, a timestamp is ALWAYS available (just Date.now() at build time)
// and guaranteed unique per build. Falls back to Date.now() if version.json
// doesn't exist yet.
function buildTimestamp() {
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (manifest.buildTimestamp && typeof manifest.buildTimestamp === 'number') {
        return manifest.buildTimestamp;
      }
    }
  } catch {}
  return Date.now()
}

// Vite plugin that generates public/version.json BEFORE the build runs.
// This ensures version.json always exists — whether the build is triggered
// via `npm run build` (which runs prebuild) or `npx vite build` (which
// does NOT run prebuild, e.g. in the GH Actions APK workflow).
function generateVersionManifest() {
  return {
    name: 'generate-version-manifest',
    buildStart() {
      const publicDir = path.join(__dirname, 'public');
      const versionFile = path.join(publicDir, 'version.json');

      // Don't overwrite if it already exists (prebuild may have created it)
      if (fs.existsSync(versionFile)) {
        console.log('[version] public/version.json already exists — skipping generation');
        return;
      }

      const sha = gitSha();
      const branch = (() => {
        try { return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); }
        catch { return 'unknown'; }
      })();
      const timestamp = new Date().toISOString();
      const isoTimestamp = (() => {
        try { return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim(); }
        catch { return timestamp; }
      })();

      // Read version.properties for APK version info
      const versionPropsPath = path.join(__dirname, 'android', 'app', 'version.properties');
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

      const manifest = {
        sha,
        branch,
        builtAt: timestamp,
        commitTime: isoTimestamp,
        status: 'building',
        stableSince: null,
        apkVersion,
        apkVersionCode,
        apkUrl: null,
        apkBuildStatus: 'building',
        apkBuiltAt: timestamp,
      };

      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(versionFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(`[version] Generated public/version.json  sha=${sha.slice(0, 8)}  branch=${branch}`);
    },
  };
}

// CACHE-BUST NOTE (2026-08-31): CSS asset URLs are rotated per deploy by
// scripts/bust-css-cache.cjs (run by `npm run build` AFTER vite build), NOT
// by a vite plugin — Vite's internal html/asset post-processing re-derives
// emitted filenames, so in-bundle renames do not survive. See the script for
// the full rationale (edge-cache poisoning of stable CSS URLs).

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react(), generateVersionManifest()],
    server: {
      port: 5000,
      host: true,
      allowedHosts: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      // Disable sourcemaps in production to reduce build memory.
      // Sourcemaps require Vite to keep the entire AST in memory,
      // which causes OOM (Out of Memory) crashes on Vercel's 1GB limit.
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@tiptap') || id.includes('prosemirror')) {
                return 'vendor-editor';
              }
              if (id.includes('convex')) {
                return 'vendor-convex';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('html2canvas') || id.includes('pdfjs') || id.includes('jspdf')) {
                return 'vendor-pdf';
              }
              if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
                return 'vendor-dates';
              }
              if (id.includes('@google') || id.includes('openai') || id.includes('anthropic')) {
                return 'vendor-ai';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-animation';
              }
              if (id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
            }

            // ── SHARED LEAF CHUNK ──────────────────────────────────────────
            // src/types.ts (the home of ALL 18 app enums) and src/constants.ts
            // must live in their own chunk. Without this rule, Rollup merged
            // types.ts into module-atrium while module-settings imported it,
            // creating a cyclic chunk pair (settings ↔ atrium). module-settings'
            // top-level constants (AUTOMATION_RECIPES priority, specialty
            // arrays, Object.values over enums) then executed while the atrium
            // chunk was still mid-evaluation and the enum bindings were
            // undefined:
            //   TypeError: Cannot read properties of undefined (reading 'High')
            //   → the entire module graph died → white screen for all visitors.
            // A dedicated leaf chunk is a dependency of BOTH module chunks, so
            // it is always fully evaluated first — enums are always ready.
            if (
              id.endsWith('/src/types.ts') ||
              id.endsWith('/src/constants.ts')
            ) {
              return 'module-shared';
            }

            if (
              id.includes('/research/') ||
              id.includes('ResearchStudio') ||
              id.includes('LawReports')
            ) {
              return 'module-research';
            }

            if (
              id.includes('PropertyManagerView') ||
              id.includes('PropertyDetailView') ||
              id.includes('AtriumInbox') ||
              id.includes('RevenueEngine') ||
              id.includes('RentDemand')
            ) {
              return 'module-atrium';
            }

            if (
              id.includes('DraftProEditor') ||
              id.includes('tiptap') ||
              id.includes('DocumentsView') ||
              id.includes('HeaderDesigner')
            ) {
              return 'module-documents';
            }

            if (id.includes('/settings/') || id.includes('SettingsView')) {
              return 'module-settings';
            }
          }
        }
      }
    },
    define: {
      'process.env': {
        API_KEY: env.GEMINI_API_KEY || env.API_KEY || '',
        VITE_CONVEX_URL: env.VITE_CONVEX_URL || '',
        NODE_ENV: JSON.stringify(mode),
      },
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      // Bake the build SHA into the bundle so the client can compare it
      // against /version.json at runtime to detect new deploys.
      'import.meta.env.VITE_BUILD_SHA': JSON.stringify(gitSha()),
      // BULLETPROOF: Bake the build timestamp into the bundle. This is the
      // PRIMARY version identifier — always available, always unique per build.
      // The useVersionCheck hook compares this against version.json's buildTimestamp.
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp()),
    }
  }
})
