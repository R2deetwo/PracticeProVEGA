/**
 * rename_sentry_to_atrium.cjs
 * Bulk renames Sentry → Atrium across the entire codebase.
 */
const fs = require('fs');
const path = require('path');

// ─── 1. Files to rename (old → new) ───────────────────────────────────────
const FILE_RENAMES = [
  ['convex/sentry.ts',                             'convex/atrium.ts'],
  ['convex/sentryWebhook.ts',                      'convex/atriumWebhook.ts'],
  ['convex/seedSentry.ts',                         'convex/seedAtrium.ts'],
  ['src/components/sentry/SentryInbox.tsx',        'src/components/atrium/AtriumInbox.tsx'],
  ['src/components/sentry/SentryPublicApplicationForm.tsx', 'src/components/atrium/AtriumPublicApplicationForm.tsx'],
];

// ─── 2. Additional sentry-component files that just move to atrium/ ────────
const SENTRY_DIR_FILES_TO_MOVE = [
  'LedgerManager.tsx',
  'ServiceChargeMonitor.tsx',
  'NotificationCenter.tsx',
  'RevenueEngine.tsx',
  'VacancyPipeline.tsx',
];

// ─── 3. Text replacements: [regex-string or literal, replacement] ──────────
// Order matters — more specific first.
const TEXT_REPLACEMENTS = [
  // Interface / type renames
  ['SentryInboundMessage',                     'AtriumInboundMessage'],
  ['sentryEngine',                              'atriumEngine'],
  ['SENTRY_DEMO_APP_STATE',                     'ATRIUM_DEMO_APP_STATE'],
  ['SENTRY_STATS',                              'ATRIUM_STATS'],
  ['getSentrySystemInstruction',               'getAtriumSystemInstruction'],
  ['isSentryMode',                              'isAtriumMode'],
  ['isSentry',                                  'isAtrium'],
  ['SentryIcon',                                'AtriumIcon'],

  // Convex table name
  ['sentry_inbound_messages',                  'atrium_inbound_messages'],

  // API namespace
  ["api.sentry.",                              'api.atrium.'],
  ["'api/sentry'",                             "'api/atrium'"],

  // Import paths
  ["from '../sentry/SentryInbox'",             "from '../atrium/AtriumInbox'"],
  ["from '../sentry/SentryPublicApplicationForm'", "from '../atrium/AtriumPublicApplicationForm'"],
  ["from '../sentry/LedgerManager'",           "from '../atrium/LedgerManager'"],
  ["from '../sentry/ServiceChargeMonitor'",    "from '../atrium/ServiceChargeMonitor'"],
  ["from '../sentry/NotificationCenter'",      "from '../atrium/NotificationCenter'"],
  ["from '../sentry/RevenueEngine'",           "from '../atrium/RevenueEngine'"],
  ["from '../sentry/VacancyPipeline'",         "from '../atrium/VacancyPipeline'"],
  ["from './sentry/SentryInbox'",              "from './atrium/AtriumInbox'"],
  ["from './sentry/SentryPublicApplicationForm'", "from './atrium/AtriumPublicApplicationForm'"],
  ["from './sentry/LedgerManager'",            "from './atrium/LedgerManager'"],
  ["from './sentry/ServiceChargeMonitor'",     "from './atrium/ServiceChargeMonitor'"],
  ["from './sentry/NotificationCenter'",       "from './atrium/NotificationCenter'"],
  ["from './sentry/RevenueEngine'",            "from './atrium/RevenueEngine'"],
  ["from './sentry/VacancyPipeline'",          "from './atrium/VacancyPipeline'"],

  // PropertyManagementAgent import
  ["from './PropertyManagementAgent'",         "from './PropertyManagementAgent'"], // keep same file name

  // Demo IDs
  ['sentry-demo-firm-id',                      'atrium-demo-firm-id'],

  // Demo user/firm names
  ['David Sentry',                             'David Atrium'],
  ['Sentry Management Partners',               'Atrium Management Partners'],
  ["accountName: 'Sentry Management'",         "accountName: 'Atrium Management'"],
  ["userName: 'David Sentry'",                 "userName: 'David Atrium'"],

  // Session storage: backward compat (Step 21)
  ["demoProd === 'vega' || demoProd === 'atrium'",
   "demoProd === 'vega' || demoProd === 'atrium' || demoProd === 'sentry'"],

  // Product type
  ["'legal' | 'property' | 'unified' | 'sentry' | 'vega'",
   "'legal' | 'property' | 'unified' | 'atrium' | 'vega'"],

  // Code identifiers — keep 'property' alias logic
  ["product === 'property' ? 'sentry'",        "product === 'property' ? 'atrium'"],
  ["product === 'unified' || product === 'sentry'",
   "product === 'unified' || product === 'atrium'"],
  ["product === 'sentry'",                     "product === 'atrium'"],
  ["currentUser.product === 'sentry'",         "currentUser.product === 'atrium'"],
  ["demoProduct !== 'sentry'",                 "demoProduct !== 'atrium'"],
  ["setDemoProduct('sentry')",                 "setDemoProduct('atrium')"],
  ["demoProduct === 'sentry'",                 "demoProduct === 'atrium'"],
  ["switchDemoProduct('sentry')",              "switchDemoProduct('atrium')"],
  ["setActiveProduct('sentry')",               "setActiveProduct('atrium')"],
  ["activeProduct === 'sentry'",               "activeProduct === 'atrium'"],
  ["useState<'vega' | 'sentry'>",              "useState<'vega' | 'atrium'>"],
  ["product: 'vega' | 'sentry'",               "product: 'vega' | 'atrium'"],
  ["activeProduct: 'vega' | 'sentry'",         "activeProduct: 'vega' | 'atrium'"],
  ["setActiveProduct: (p: 'vega' | 'sentry')", "setActiveProduct: (p: 'vega' | 'atrium')"],
  ["as 'vega' | 'sentry'",                     "as 'vega' | 'atrium'"],
  ["demoProd === 'vega' || demoProd === 'sentry'",
   "demoProd === 'vega' || demoProd === 'atrium'"],
  ["product = demoProd as ProductType",        "product = demoProd as ProductType"], // keep same

  // View type sentryEngine already handled above

  // Displayed text (UI strings)
  ["'Sentry OS'",                              "'Atrium OS'"],
  ['"Sentry OS"',                              '"Atrium OS"'],
  ["'Sentry Property OS'",                     "'Atrium Property OS'"],
  ['"Sentry Property OS"',                     '"Atrium Property OS"'],
  ["'Sentry Plans'",                           "'Atrium Plans'"],
  ['"Sentry Plans"',                           '"Atrium Plans"'],
  ["'Switch to Sentry'",                       "'Switch to Atrium'"],
  ['"Switch to Sentry"',                       '"Switch to Atrium"'],
  ["Switch to Sentry",                         "Switch to Atrium"],
  [">Sentry<",                                 ">Atrium<"],
  [">SENTRY<",                                 ">ATRIUM<"],
  ["'Sentry'",                                 "'Atrium'"],
  ['"Sentry"',                                 '"Atrium"'],
  ["'SENTRY'",                                 "'ATRIUM'"],
  ['"SENTRY"',                                 '"ATRIUM"'],
  ['`Sentry`',                                 '`Atrium`'],

  // AI Brain names
  ['Sentry AI Brain — Memory Index',           'ARIA Brain — Memory Index'],
  ["Sentry's memory is built from your portfolio's documents and notes",
   "ARIA's memory is built from your portfolio's documents and notes"],
  ['Sentry AI Brain',                          'ARIA Brain'],
  ['Sentry Property Management Brain',         'ARIA — Asset & Revenue Intelligent Assistant'],
  ['Sentry AI',                                'ARIA'],

  // Splash screen stage
  ["stage === 'sentry'",                       "stage === 'atrium'"],
  ["setStage('sentry')",                       "setStage('atrium')"],
  ["'idle' | 'sentry' | 'vega' | 'final'",    "'idle' | 'atrium' | 'vega' | 'final'"],
  ["SplashProduct = 'practicepro' | 'vega' | 'sentry'",
   "SplashProduct = 'practicepro' | 'vega' | 'atrium'"],
  ["{stage === 'vega' ? 'Vega' : 'Sentry'}",  "{stage === 'vega' ? 'Vega' : 'Atrium'}"],

  // Comments
  ['// Sentry ', '// Atrium '],
  ['// SENTRY ', '// ATRIUM '],
  ['/* Sentry ', '/* Atrium '],
  ['Vega (Legal OS) and Sentry (Property OS)', 'Vega (Legal OS) and Atrium (Property OS)'],
  ['// Sentry Pricing (Property)', '// Atrium Pricing (Property)'],
  ['Sentry (Property OS)', 'Atrium (Property OS)'],
  ['{/* Tenant Contribution Section (Sentry Only) */}', '{/* Tenant Contribution Section (Atrium Only) */}'],

  // Settings text
  ['See the latest enhancements to Sentry OS and the Sentry AI Brain.',
   'See the latest enhancements to Atrium OS and the ARIA Brain.'],

  // Agent settings / SettingsView
  ['"Sentry AI Brain"',   '"ARIA Brain"'],
  ["'Sentry AI Brain'",   "'ARIA Brain'"],

  // AgencyHub ALOA identity blurb (partial)
  ['the proprietary intelligence engine powering Komplet (formerly Procedural OS / PracticePro).',
   'the proprietary intelligence engine powering Komplet (formerly Procedural OS / PracticePro). When operating on the property side, you are known as ARIA (Asset & Revenue Intelligent Assistant) — the AI brain of Atrium Property OS.'],

  // isBlue check (SplashScreen)
  ["stage === 'idle' || stage === 'sentry'",   "stage === 'idle' || stage === 'atrium'"],
  ["stage === 'sentry' || isBlue",             "stage === 'atrium' || isBlue"],

  // General leftover 'sentry' identifiers in code (lowercase, not in strings)
  // These are caught last to avoid double-replacing
  ["'sentry'",  "'atrium'"],
  ['"sentry"',  '"atrium"'],
];

// ─── 4. Extensions to process ─────────────────────────────────────────────
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'];

// ─── 5. Directories to skip ───────────────────────────────────────────────
const SKIP_DIRS = ['node_modules', '.git', 'dist', '.convex', 'convex/_generated'];

// ─────────────────────────────────────────────────────────────────────────────

function shouldSkip(filePath) {
  return SKIP_DIRS.some(d => filePath.replace(/\\/g, '/').includes(d));
}

function processFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch { return; }

  let modified = content;
  for (const [from, to] of TEXT_REPLACEMENTS) {
    // Simple global string replace (no regex meta-chars needed for most)
    modified = modified.split(from).join(to);
  }

  if (modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log('  UPDATED:', path.relative(process.cwd(), filePath));
  }
}

function walkDir(dir) {
  if (shouldSkip(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      processFile(full);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
const root = process.cwd();
console.log('=== Sentry → Atrium rename script ===');
console.log('Root:', root);

// 1. Rename files & ensure target dirs exist
for (const [oldRel, newRel] of FILE_RENAMES) {
  const oldPath = path.join(root, oldRel);
  const newPath = path.join(root, newRel);
  if (fs.existsSync(oldPath)) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.renameSync(oldPath, newPath);
    console.log('  RENAMED:', oldRel, '→', newRel);
  } else {
    console.log('  SKIP (not found):', oldRel);
  }
}

// 2. Move extra sentry/ files to atrium/ (keep filenames that aren't sentry-named)
const sentrySrcDir = path.join(root, 'src/components/sentry');
const atriumSrcDir = path.join(root, 'src/components/atrium');
if (fs.existsSync(sentrySrcDir)) {
  fs.mkdirSync(atriumSrcDir, { recursive: true });
  for (const fileName of SENTRY_DIR_FILES_TO_MOVE) {
    const oldPath = path.join(sentrySrcDir, fileName);
    const newPath = path.join(atriumSrcDir, fileName);
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      console.log('  MOVED:', `sentry/${fileName}`, '→', `atrium/${fileName}`);
    }
  }
  // If sentry dir is now empty, remove it
  try {
    const remaining = fs.readdirSync(sentrySrcDir);
    if (remaining.length === 0) fs.rmdirSync(sentrySrcDir);
  } catch {}
}

// 3. Walk entire project and apply text replacements
console.log('\nApplying text replacements...');
walkDir(root);

console.log('\n=== Done! ===');
