
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react()],
    server: {
      port: 5000,
      host: true,
      allowedHosts: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'jspdf': path.resolve(__dirname, './src/stubs/jspdf-stub.ts'),
        'jspdf-autotable': path.resolve(__dirname, './src/stubs/jspdf-stub.ts'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
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
              if (id.includes('html2canvas') || id.includes('pdfjs')) {
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
    }
  }
})
