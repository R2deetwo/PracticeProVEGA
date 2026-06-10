
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
      output: {
          manualChunks(id) {
            // ── Vendor: Node modules ──────────────────────────────────
            if (id.includes('node_modules')) {
              // Heavy editor libraries — split away from main
              if (id.includes('@tiptap') || id.includes('prosemirror')) {
                return 'vendor-editor';
              }
              // Convex realtime engine
              if (id.includes('convex')) {
                return 'vendor-convex';
              }
              // Icon set (large SVG payload)
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // PDF/canvas utilities
              if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('pdfjs')) {
                return 'vendor-pdf';
              }
              // Date utilities
              if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
                return 'vendor-dates';
              }
              // AI / streaming SDKs
              if (id.includes('@google') || id.includes('openai') || id.includes('anthropic')) {
                return 'vendor-ai';
              }
              // Animation libraries
              if (id.includes('framer-motion')) {
                return 'vendor-animation';
              }
              // React core — always needed, keep in main vendor
              if (id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
            }

            // ── App modules: Legal OS (Vega) ─────────────────────────
            if (
              id.includes('/research/') ||
              id.includes('ResearchStudio') ||
              id.includes('LawReports')
            ) {
              return 'module-research';
            }

            // ── App modules: Property OS (Atrium) ────────────────────
            if (
              id.includes('PropertyManagerView') ||
              id.includes('PropertyDetailView') ||
              id.includes('AtriumInbox') ||
              id.includes('RevenueEngine') ||
              id.includes('RentDemand')
            ) {
              return 'module-atrium';
            }

            // ── App modules: Documents & Editor ──────────────────────
            if (
              id.includes('DraftProEditor') ||
              id.includes('tiptap') ||
              id.includes('DocumentsView') ||
              id.includes('HeaderDesigner')
            ) {
              return 'module-documents';
            }

            // ── App modules: Settings ─────────────────────────────────
            if (id.includes('/settings/') || id.includes('SettingsView')) {
              return 'module-settings';
            }
          }
        }

      }
    },
    define: {
      // Polyfill process.env to prevent crashes in third-party libs or agent code
      'process.env': {
        API_KEY: env.API_KEY || env.GEMINI_API_KEY || '',
        VITE_CONVEX_URL: env.VITE_CONVEX_URL || '',
        NODE_ENV: JSON.stringify(mode),
      },
      // Specific overrides for direct usage
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL || ''),
    }
  }
})
