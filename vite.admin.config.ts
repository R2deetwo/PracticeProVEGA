/**
 * Vite config for the FOUNDER APK (com.practicepro.admin).
 *
 * Builds the admin/founder frontend to dist-admin/ using admin.html
 * as the entry point (which loads src/admin/main.tsx → AdminApp.tsx).
 *
 * Usage:
 *   npm run build:admin  — builds dist-admin/
 *   npm run cap:sync:admin — syncs dist-admin/ into the Android project
 *   npm run apk:admin:release — builds the founder release APK
 */

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function gitSha(fallback = '') {
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (manifest.sha && manifest.sha !== 'unknown') return manifest.sha;
    }
  } catch {}
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() }
  catch { return fallback || `build-${Date.now()}` }
}

function buildTimestamp() {
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (manifest.buildTimestamp && typeof manifest.buildTimestamp === 'number') return manifest.buildTimestamp;
    }
  } catch {}
  return Date.now()
}

function appVersion() {
  // Version string surfaced in the Founder APK Settings > About tab.
  // Reads the consumer manifest (public/version.json) so the founder app
  // reports the same platform version users are running.
  try {
    const versionFile = path.join(__dirname, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (typeof manifest.apkVersion === 'string' && manifest.apkVersion) {
        return `${manifest.apkVersion} (${gitSha().slice(0, 7)})`
      }
    }
  } catch {}
  return `dev-${gitSha().slice(0, 7)}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')

  return {
    plugins: [react()],
    server: { port: 5001, host: true },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'dist-admin',
      sourcemap: mode !== 'production',
      rollupOptions: {
        input: path.resolve(__dirname, 'admin.html'),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('convex')) return 'vendor-convex';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
              if (id.includes('framer-motion')) return 'vendor-animation';
            }
          }
        }
      }
    },
    define: {
      'process.env': {
        API_KEY: env.GEMINI_API_KEY || env.API_KEY || '',
        VITE_CONVEX_URL: env.VITE_CONVEX_URL || 'https://gregarious-malamute-537.convex.cloud',
        NODE_ENV: JSON.stringify(mode),
      },
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || 'https://gregarious-malamute-537.convex.cloud'),
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || 'https://gregarious-malamute-537.convex.cloud'),
      'import.meta.env.VITE_BUILD_SHA': JSON.stringify(gitSha()),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp()),
      // Build-time constants consumed by src/admin/views/Settings.tsx (About tab).
      // Without these defines the identifiers survive as bare globals and the
      // whole admin bundle throws ReferenceError on module evaluation.
      '__APP_VERSION__': JSON.stringify(appVersion()),
      '__APP_MODE__': JSON.stringify(mode),
    }
  }
})
