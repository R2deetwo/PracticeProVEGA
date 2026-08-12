/**
 * generate-dev-report.ts — Living Context & Documentation Loop
 *
 * Generates a structured development report that captures:
 * - Current build version + SHA
 * - Audit results summary
 * - Recent git commits
 * - Feature inventory
 * - Known issues
 * - Deployment status
 *
 * The report is saved to ./audit-results/dev-report.json AND
 * can be pushed to Convex for the founder app to consume.
 *
 * Usage: npm run dev-report
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

interface DevReport {
  generatedAt: string;
  buildVersion: {
    sha: string;
    branch: string;
    builtAt: string;
    buildTimestamp: number;
    status: string;
  };
  auditSummary: {
    overallScore: number;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    domainScores: { domain: string; score: number; status: string }[];
    criticalIssues: { domain: string; issue: string }[];
  } | null;
  recentCommits: { hash: string; message: string; date: string; author: string }[];
  featureInventory: {
    totalRoutes: number;
    totalComponents: number;
    totalConvexFunctions: number;
    totalSchemaTables: number;
    products: string[];
  };
  deploymentStatus: {
    vercel: { url: string; status: string; lastChecked: string };
    cloudflare: { url: string; status: string; lastChecked: string };
  };
  knownIssues: { severity: string; issue: string; domain: string }[];
  metrics: {
    bundleSizeKB: number;
    totalFiles: number;
    linterErrors: number;
  };
}

function run(cmd: string, fallback = ''): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return fallback;
  }
}

async function main() {
  console.log('[dev-report] Generating development report...');

  const report: DevReport = {
    generatedAt: new Date().toISOString(),
    buildVersion: { sha: '', branch: '', builtAt: '', buildTimestamp: 0, status: '' },
    auditSummary: null,
    recentCommits: [],
    featureInventory: { totalRoutes: 0, totalComponents: 0, totalConvexFunctions: 0, totalSchemaTables: 0, products: [] },
    deploymentStatus: { vercel: { url: '', status: '', lastChecked: '' }, cloudflare: { url: '', status: '', lastChecked: '' } },
    knownIssues: [],
    metrics: { bundleSizeKB: 0, totalFiles: 0, linterErrors: 0 },
  };

  // ─── Build Version ──────────────────────────────────────────────────────────
  try {
    const versionFile = path.join(ROOT, 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const v = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      report.buildVersion = {
        sha: v.sha || 'unknown',
        branch: v.branch || 'unknown',
        builtAt: v.builtAt || '',
        buildTimestamp: v.buildTimestamp || 0,
        status: v.status || 'unknown',
      };
    }
  } catch {}

  // ─── Audit Summary ──────────────────────────────────────────────────────────
  try {
    const masterReport = path.join(ROOT, 'audit-results', 'master-report.json');
    if (fs.existsSync(masterReport)) {
      const m = JSON.parse(fs.readFileSync(masterReport, 'utf8'));
      report.auditSummary = {
        overallScore: m.overallScore || 0,
        totalChecks: m.summary?.totalChecks || 0,
        passed: m.summary?.totalPassed || 0,
        failed: m.summary?.totalFailed || 0,
        warnings: m.summary?.totalWarnings || 0,
        domainScores: (m.domains || []).map((d: any) => ({
          domain: d.domain,
          score: d.checks > 0 ? Math.round((d.passed / d.checks) * 100) : 0,
          status: d.status,
        })),
        criticalIssues: (m.criticalIssues || []).map((c: any) => ({
          domain: c.domain,
          issue: c.issue.slice(0, 200),
        })),
      };

      // Extract known issues from warnings
      for (const domain of m.domains || []) {
        for (const detail of domain.details || []) {
          if (detail.status === 'warn' || detail.status === 'fail') {
            report.knownIssues.push({
              severity: detail.status === 'fail' ? 'critical' : 'warning',
              issue: detail.message.slice(0, 200),
              domain: domain.domain,
            });
          }
        }
      }
    }
  } catch {}

  // ─── Recent Commits ─────────────────────────────────────────────────────────
  try {
    const log = run('git log --oneline --format="%h|%s|%ci|%an" -20');
    report.recentCommits = log.split('\n').filter(Boolean).map(line => {
      const [hash, message, date, author] = line.split('|');
      return { hash, message: message.slice(0, 200), date, author };
    });
  } catch {}

  // ─── Feature Inventory ──────────────────────────────────────────────────────
  try {
    // Count components
    const componentFiles = run(`find ${ROOT}/src/components -name "*.tsx" | wc -l`, '0');
    report.featureInventory.totalComponents = parseInt(componentFiles) || 0;

    // Count Convex functions
    const convexFiles = run(`grep -r "export const" ${ROOT}/convex/*.ts 2>/dev/null | wc -l`, '0');
    report.featureInventory.totalConvexFunctions = parseInt(convexFiles) || 0;

    // Count schema tables
    const schemaContent = fs.readFileSync(path.join(ROOT, 'convex', 'schema.ts'), 'utf8');
    const tableCount = (schemaContent.match(/defineTable/g) || []).length;
    report.featureInventory.totalSchemaTables = tableCount;

    // Routes from App.tsx
    const appContent = fs.readFileSync(path.join(ROOT, 'src', 'components', 'App.tsx'), 'utf8');
    const routeCount = (appContent.match(/case '/g) || []).length;
    report.featureInventory.totalRoutes = routeCount;

    // Products
    report.featureInventory.products = ['Vega (Legal)', 'Atrium (Property)', 'Komplete (Unified)'];
  } catch {}

  // ─── Deployment Status ──────────────────────────────────────────────────────
  report.deploymentStatus.vercel = {
    url: 'https://practice-pro-vega.vercel.app',
    status: report.buildVersion.status === 'healthy' ? 'healthy' : 'unknown',
    lastChecked: new Date().toISOString(),
  };
  report.deploymentStatus.cloudflare = {
    url: 'https://practice-pro-vega.prototypechigo.workers.dev',
    status: report.buildVersion.status === 'healthy' ? 'healthy' : 'unknown',
    lastChecked: new Date().toISOString(),
  };

  // ─── Metrics ────────────────────────────────────────────────────────────────
  try {
    const distPath = path.join(ROOT, 'dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath, { recursive: true });
      report.metrics.totalFiles = files.length;

      // Calculate total bundle size
      let totalSize = 0;
      const assetPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetPath)) {
        for (const file of fs.readdirSync(assetPath)) {
          const stat = fs.statSync(path.join(assetPath, file));
          totalSize += stat.size;
        }
      }
      report.metrics.bundleSizeKB = Math.round(totalSize / 1024);
    }
  } catch {}

  // ─── Write Report ───────────────────────────────────────────────────────────
  const reportPath = path.join(ROOT, 'audit-results', 'dev-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('[dev-report] Report saved to:', reportPath);
  console.log('[dev-report] Summary:');
  console.log(`  Build SHA: ${report.buildVersion.sha.slice(0, 12)}`);
  console.log(`  Audit Score: ${report.auditSummary?.overallScore || 'N/A'}/100`);
  console.log(`  Components: ${report.featureInventory.totalComponents}`);
  console.log(`  Convex Functions: ${report.featureInventory.totalConvexFunctions}`);
  console.log(`  Schema Tables: ${report.featureInventory.totalSchemaTables}`);
  console.log(`  Known Issues: ${report.knownIssues.length}`);
  console.log(`  Bundle Size: ${report.metrics.bundleSizeKB}KB`);
  console.log(`  Recent Commits: ${report.recentCommits.length}`);

  // Also write a markdown summary for easy reading
  const markdownPath = path.join(ROOT, 'audit-results', 'dev-report.md');
  let md = `# PracticePro Development Report\n\n`;
  md += `**Generated:** ${report.generatedAt}\n`;
  md += `**Build SHA:** ${report.buildVersion.sha.slice(0, 12)}\n`;
  md += `**Status:** ${report.buildVersion.status}\n\n`;
  md += `## Audit Score\n\n`;
  md += `**Overall: ${report.auditSummary?.overallScore || 'N/A'}/100**\n\n`;
  if (report.auditSummary) {
    md += `| Domain | Score | Status |\n|--------|-------|--------|\n`;
    for (const d of report.auditSummary.domainScores) {
      md += `| ${d.domain} | ${d.score}% | ${d.status} |\n`;
    }
  }
  md += `\n## Feature Inventory\n\n`;
  md += `- **Components:** ${report.featureInventory.totalComponents}\n`;
  md += `- **Convex Functions:** ${report.featureInventory.totalConvexFunctions}\n`;
  md += `- **Schema Tables:** ${report.featureInventory.totalSchemaTables}\n`;
  md += `- **Routes:** ${report.featureInventory.totalRoutes}\n`;
  md += `- **Products:** ${report.featureInventory.products.join(', ')}\n\n`;
  md += `## Deployment Status\n\n`;
  md += `| Platform | URL | Status |\n|----------|-----|--------|\n`;
  md += `| Vercel | ${report.deploymentStatus.vercel.url} | ${report.deploymentStatus.vercel.status} |\n`;
  md += `| Cloudflare | ${report.deploymentStatus.cloudflare.url} | ${report.deploymentStatus.cloudflare.status} |\n\n`;
  md += `## Known Issues (${report.knownIssues.length})\n\n`;
  for (const issue of report.knownIssues.slice(0, 15)) {
    md += `- **[${issue.severity}]** [${issue.domain}] ${issue.issue}\n`;
  }
  md += `\n## Recent Commits\n\n`;
  for (const commit of report.recentCommits.slice(0, 10)) {
    md += `- \`${commit.hash}\` ${commit.message} (${commit.date})\n`;
  }
  fs.writeFileSync(markdownPath, md, 'utf8');
  console.log('[dev-report] Markdown summary saved to:', markdownPath);
}

main().catch(err => {
  console.error('[dev-report] Error:', err);
  process.exit(1);
});
