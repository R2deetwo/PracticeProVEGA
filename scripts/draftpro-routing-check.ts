/**
 * draftpro-routing-check.ts — automated regression check.
 *
 * DRAFTPRO-NEW-TAB — do not convert to same-tab navigation.
 *
 * This script scans the codebase for any code that navigates to /editor
 * via same-tab navigation (navigateTo('editor'), openEditor(), window.location
 * = '/editor', etc.) OUTSIDE of the approved locations:
 *
 *   - src/utils/tabNavigation.ts (the openDraftProNewTab function)
 *   - Mobile-only fallbacks (guarded by window.innerWidth < 768)
 *   - Comments containing "DRAFTPRO-NEW-TAB"
 *
 * If any unapproved same-tab navigation is found, this script exits with
 * code 1 (failure), which should fail the CI build.
 *
 * Run: npx tsx scripts/draftpro-routing-check.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '..', 'src');

let violations = 0;

// Patterns that indicate same-tab navigation to /editor
const SAME_TAB_PATTERNS = [
    // navigateTo('editor', ...) — same-tab SPA navigation
    /navigateTo\(\s*['"]editor['"]/,
    // openEditor( — same-tab wrapper
    /openEditor\(/,
    // openEditorRef.current( — same-tab ref wrapper
    /openEditorRef\.current\(/,
    // window.location = '/editor' or window.location.href = '/editor'
    /window\.location(?:\.href)?\s*=\s*['"`]\/editor/,
];

// Files that are ALLOWED to contain these patterns
const ALLOWED_FILES = [
    'src/utils/tabNavigation.ts',  // The single source of truth
    'src/contexts/UIContext.tsx',  // Contains the openEditor definition itself
    'src/utils/citationClassifier.test.ts',  // Test file
];

// Patterns that indicate a mobile-only fallback (allowed)
const MOBILE_GUARD_PATTERN = /window\.innerWidth\s*[<>=]+\s*768|isMobile|isMobileOrNative/;

function scanFile(filePath: string) {
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    
    // Skip allowed files
    if (ALLOWED_FILES.some(allowed => relativePath.replace(/\\/g, '/').includes(allowed))) {
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        // Skip comment lines
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
        }

        // Skip lines with the regression marker on THIS line or within 3 lines before
        if (line.includes('DRAFTPRO-NEW-TAB')) {
            return;
        }
        for (let back = 1; back <= 3; back++) {
            if (idx - back >= 0 && lines[idx - back].includes('DRAFTPRO-NEW-TAB')) {
                return;
            }
        }

        // Check each pattern
        for (const pattern of SAME_TAB_PATTERNS) {
            if (pattern.test(line)) {
                // Check if this line is inside a mobile guard block (heuristic:
                // look 8 lines before for a mobile check)
                const contextStart = Math.max(0, idx - 8);
                const context = lines.slice(contextStart, idx + 1).join('\n');
                if (MOBILE_GUARD_PATTERN.test(context)) {
                    return; // Mobile-guarded — allowed
                }

                violations++;
                console.error(`❌ VIOLATION: ${relativePath}:${idx + 1}`);
                console.error(`   ${line.trim()}`);
                console.error(`   Pattern: ${pattern}`);
                console.error('');
            }
        }
    });
}

function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanDirectory(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            scanFile(fullPath);
        }
    }
}

console.log('=== DRAFTPRO ROUTING REGRESSION CHECK ===');
console.log(`Scanning ${SRC_DIR} for same-tab navigation to /editor...`);
console.log('');

scanDirectory(SRC_DIR);

if (violations > 0) {
    console.error(`\n❌ ${violations} violation(s) found.`);
    console.error('All DraftPro navigation MUST go through openDraftProNewTab() in tabNavigation.ts');
    console.error('See the DRAFTPRO-NEW-TAB marker comments for context.');
    process.exit(1);
} else {
    console.log('✅ No same-tab navigation violations found.');
    console.log('All DraftPro entry points route through openDraftProNewTab().');
    process.exit(0);
}
