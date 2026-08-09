/**
 * Vite config for the PracticePro Founder APK build.
 *
 * Same as the main vite.config.ts but:
 *   - Entry: admin.html (not index.html)
 *   - Output: dist-admin/ (not dist/)
 *
 * The sync script (scripts/sync-admin-config.cjs) handles:
 *   - Copying admin.html → index.html (Capacitor requires index.html)
 *   - Patching applicationId, strings.xml, version.properties
 *   - Manual sync fallback when Node < 22 (Capacitor 8 CLI requires >= 22)
 *
 * Usage: npx vite build --config vite.admin.config.ts
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function gitSha(fallback = 'unknown') {
  // CRO AUDIT FIX — read SHA from version.json first (same fix as vite.config.ts)
  // This ensures the founder APK bundle gets a real SHA instead of 'unknown',
  // which was causing the version-check to never fire on the founder app.
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (manifest.sha && manifest.sha !== 'unknown') {
        return manifest.sha;
      }
    }
  } catch {}
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

// Read the app version from android/app/version.properties so the
// Settings page can display the real version (e.g., "1.0.403") instead
// of a hardcoded fallback.
function getAppVersion(): string {
  try {
    const versionFile = path.join(__dirname, 'android', 'app', 'version.properties');
    if (fs.existsSync(versionFile)) {
      const content = fs.readFileSync(versionFile, 'utf8');
      const major = (content.match(/^MAJOR=(\d+)/m) || [])[1] || '1';
      const minor = (content.match(/^MINOR=(\d+)/m) || [])[1] || '0';
      const patch = (content.match(/^PATCH=(\d+)/m) || [])[1] || '0';
      return `${major}.${minor}.${patch}`;
    }
  } catch (e) {
    console.warn('[vite.admin.config] Failed to read app version:', e);
  }
  return '2.0.0';
}

function generateVersionManifest() {
  return {
    name: 'generate-version-manifest',
    buildStart() {
      const publicDir = path.join(__dirname, 'public');
      const versionFile = path.join(publicDir, 'version.json');
      try {
        const sha = gitSha();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const version = JSON.stringify({
          sha, branch,
          builtAt: new Date().toISOString(),
          commitTime: new Date().toISOString(),
          status: 'building',
          stableSince: null,
          apkVersion: 'admin',
          apkBuildStatus: 'building',
        }, null, 2);
        if (!require('fs').existsSync(versionFile) || require('fs').readFileSync(versionFile, 'utf8').trim() !== version.trim()) {
          require('fs').writeFileSync(versionFile, version);
        }
      } catch (e) {
        const fallback = JSON.stringify({ sha: 'unknown', branch: 'main', status: 'building', apkBuildStatus: 'unknown' }, null, 2);
        try { require('fs').writeFileSync(versionFile, fallback); } catch {}
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), generateVersionManifest()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist-admin',
      emptyOutDir: true,
      sourcemap: mode !== 'production',
      rollupOptions: {
        input: {
          admin: path.resolve(__dirname, 'admin.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('convex')) return 'vendor-convex';
              if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
              if (id.includes('lucide-react')) return 'vendor-icons';
            }
          }
        }
      }
    },
    define: {
      'process.env': {
        VITE_CONVEX_URL: env.VITE_CONVEX_URL || '',
        NODE_ENV: JSON.stringify(mode),
      },
      'process.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || ''),
      'import.meta.env.VITE_BUILD_SHA': JSON.stringify(gitSha()),
      // Use __APP_VERSION__ (not import.meta.env.VITE_APP_VERSION) because
      // Vite's built-in env handling can interfere with define replacements
      // for import.meta.env.* keys.
      '__APP_VERSION__': JSON.stringify(getAppVersion()),
      '__APP_MODE__': JSON.stringify(mode),
    }
  };
});
