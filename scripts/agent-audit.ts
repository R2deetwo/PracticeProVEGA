/**
 * agent-audit.ts — Autonomous Playwright crawler that tests the live app,
 * captures console errors, network failures, screenshots, and DOM defects.
 *
 * Usage: npm run audit:app
 *
 * Output: ./audit-results/report.json + ./audit-results/screenshots/
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ────────────────────────────────────────────────────────────

// Test against local dev server (demo login only works in dev mode)
// Use 127.0.0.1 instead of localhost (Playwright sandbox issue)
const TARGET_URL = process.env.AUDIT_URL || 'http://127.0.0.1:5173';
const DEMO_LOGIN_URL = `${TARGET_URL}/?impersonate=demo@practicepro.ng`;
const ATRIUM_DEMO_LOGIN_URL = `${TARGET_URL}/?impersonate=demo@practicepro.ng&product=atrium`;
const SCREENSHOT_DIR = path.join(__dirname, '..', 'audit-results', 'screenshots');
const REPORT_PATH = path.join(__dirname, '..', 'audit-results', 'report.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsoleError {
  route: string;
  type: string;
  text: string;
  timestamp: string;
}

interface NetworkError {
  route: string;
  url: string;
  status: number;
  method: string;
  timestamp: string;
}

interface UIDefect {
  route: string;
  component: string;
  issue: string;
  screenshot?: string;
  domSnippet?: string;
}

interface RouteResult {
  route: string;
  status: 'ok' | 'error' | 'partial';
  loadTimeMs: number;
  hasContent: boolean;
  consoleErrors: number;
  networkErrors: number;
}

interface AuditReport {
  timestamp: string;
  targetUrl: string;
  totalRoutesCrawled: number;
  routes: RouteResult[];
  consoleErrors: ConsoleError[];
  networkErrors: NetworkError[];
  uiDefects: UIDefect[];
  summary: {
    healthyRoutes: number;
    errorRoutes: number;
    totalConsoleErrors: number;
    totalNetworkErrors: number;
    totalUiDefects: number;
  };
}

// ─── Main Audit Function ─────────────────────────────────────────────────────

async function runAudit() {
  console.log(`[audit] Starting audit against ${TARGET_URL}`);

  // Create screenshot directory
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    targetUrl: TARGET_URL,
    totalRoutesCrawled: 0,
    routes: [],
    consoleErrors: [],
    networkErrors: [],
    uiDefects: [],
    summary: {
      healthyRoutes: 0,
      errorRoutes: 0,
      totalConsoleErrors: 0,
      totalNetworkErrors: 0,
      totalUiDefects: 0,
    },
  };

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    // ─── Phase 1: Test public routes (no login) ──────────────────────────────
    await testPublicRoutes(browser, report);

    // ─── Phase 2: Test demo login ─────────────────────────────────────────────
    const loggedInPage = await testDemoLogin(browser, report);
    if (loggedInPage) {
      // ─── Phase 3: Test authenticated routes ─────────────────────────────────
      await testAuthenticatedRoutes(loggedInPage, report);

      // ─── Phase 4: Test interactive elements (modals, accordions, forms) ─────
      await testInteractiveElements(loggedInPage, report);

      // Close the logged-in page to free resources before opening new ones
      await loggedInPage.close();
    }

    // ─── Phase 5: Test portal routes ────────────────────────────────────────
    await testPortalRoutes(browser, report);

    // ─── Phase 6: Test dead-end detection (buttons without handlers) ──────────
    await testDeadEnds(browser, report);

    // ─── Phase 7: UI/UX quality audit ───────────────────────────────────────
    await testUIUXQuality(browser, report);

  } catch (err: any) {
    console.error('[audit] Fatal error:', err.message);
    report.uiDefects.push({
      route: 'AUDIT_SCRIPT',
      component: 'audit-runner',
      issue: `Fatal audit error: ${err.message}`,
    });
  } finally {
    await browser.close();
  }

  // Compute summary
  report.summary.healthyRoutes = report.routes.filter(r => r.status === 'ok').length;
  report.summary.errorRoutes = report.routes.filter(r => r.status === 'error').length;
  report.summary.totalConsoleErrors = report.consoleErrors.length;
  report.summary.totalNetworkErrors = report.networkErrors.length;
  report.summary.totalUiDefects = report.uiDefects.length;
  report.totalRoutesCrawled = report.routes.length;

  // Write report
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n[audit] ═══════════════════════════════════════════════');
  console.log(`[audit] Audit complete! Report: ${REPORT_PATH}`);
  console.log(`[audit] Routes crawled: ${report.totalRoutesCrawled}`);
  console.log(`[audit] Healthy: ${report.summary.healthyRoutes} | Errors: ${report.summary.errorRoutes}`);
  console.log(`[audit] Console errors: ${report.summary.totalConsoleErrors}`);
  console.log(`[audit] Network errors: ${report.summary.totalNetworkErrors}`);
  console.log(`[audit] UI defects: ${report.summary.totalUiDefects}`);
  console.log('[audit] ═══════════════════════════════════════════════\n');
}

// ─── Helper: Attach error listeners to a page ────────────────────────────────

function attachErrorListeners(page: any, currentRoute: string, report: AuditReport) {
  // Console errors
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push({
        route: currentRoute,
        type: msg.type(),
        text: msg.text().slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Page errors (uncaught exceptions)
  page.on('pageerror', (err: Error) => {
    report.consoleErrors.push({
      route: currentRoute,
      type: 'pageerror',
      text: err.message.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  });

  // Network failures
  page.on('requestfailed', (req: any) => {
    report.networkErrors.push({
      route: currentRoute,
      url: req.url(),
      status: 0,
      method: req.method(),
      timestamp: new Date().toISOString(),
    });
  });

  // HTTP error responses (4xx, 5xx)
  page.on('response', (res: any) => {
    if (res.status() >= 400) {
      report.networkErrors.push({
        route: currentRoute,
        url: res.url(),
        status: res.status(),
        method: res.request().method(),
        timestamp: new Date().toISOString(),
      });
    }
  });
}

// ─── Helper: Navigate to a route and record results ──────────────────────────

async function testRoute(
  page: any,
  route: string,
  report: AuditReport,
  screenshotName?: string
): Promise<RouteResult> {
  const url = route.startsWith('http') ? route : `${TARGET_URL}${route}`;
  const startTime = Date.now();
  const result: RouteResult = {
    route,
    status: 'ok',
    loadTimeMs: 0,
    hasContent: false,
    consoleErrors: 0,
    networkErrors: 0,
  };

  const errorCountBefore = report.consoleErrors.length;
  const networkErrorCountBefore = report.networkErrors.length;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for content to appear (up to 8 seconds)
    await page.waitForTimeout(3000);

    // Try to dismiss cookie banner if present (so it doesn't block screenshots)
    try {
      const cookieBtn = page.locator('button:has-text("Acknowledge")').first();
      if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cookieBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {}

    result.loadTimeMs = Date.now() - startTime;

    // Check if page has content (not blank)
    const bodyText = await page.evaluate(() => document.body?.innerText?.length || 0);
    result.hasContent = bodyText > 100;

    if (!result.hasContent) {
      result.status = 'error';
      report.uiDefects.push({
        route,
        component: 'page-body',
        issue: 'Page rendered blank or with minimal content',
      });
    }

    // Take screenshot if requested
    if (screenshotName) {
      const screenshotPath = path.join(SCREENSHOT_DIR, `${screenshotName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } catch (err: any) {
    result.status = 'error';
    result.loadTimeMs = Date.now() - startTime;
    report.uiDefects.push({
      route,
      component: 'navigation',
      issue: `Failed to load: ${err.message.slice(0, 200)}`,
    });
  }

  result.consoleErrors = report.consoleErrors.length - errorCountBefore;
  result.networkErrors = report.networkErrors.length - networkErrorCountBefore;

  if (result.consoleErrors > 0 || result.networkErrors > 0) {
    result.status = result.status === 'ok' ? 'partial' : result.status;
  }

  report.routes.push(result);
  console.log(`  ${result.status === 'ok' ? '✓' : result.status === 'partial' ? '⚠' : '✗'} ${route} (${result.loadTimeMs}ms, ${result.consoleErrors} console errs, ${result.networkErrors} network errs)`);

  return result;
}

// ─── Phase 1: Test public routes ─────────────────────────────────────────────

async function testPublicRoutes(browser: any, report: AuditReport) {
  console.log('\n[audit] Phase 1: Testing public routes...');
  const page = await browser.newPage();
  attachErrorListeners(page, 'public', report);

  const publicRoutes = [
    { route: '/', name: 'landing' },
    { route: '/portal/tenant/login', name: 'tenant-login' },
    { route: '/portal/client/login', name: 'client-login' },
    { route: '/privacy-policy', name: 'privacy' },
    { route: '/terms-of-service', name: 'terms' },
  ];

  for (const { route, name } of publicRoutes) {
    await testRoute(page, route, report, `public-${name}`);
  }

  await page.close();
}

// ─── Phase 2: Test demo login ────────────────────────────────────────────────

async function testDemoLogin(browser: any, report: AuditReport): Promise<Page | null> {
  console.log('\n[audit] Phase 2: Logging in via URL bypass (?impersonate=demo@practicepro.ng)...');
  const page = await browser.newPage();
  attachErrorListeners(page, 'login', report);

  try {
    // Use the URL bypass — no form interaction needed
    await page.goto(DEMO_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Give the app time to load demo data

    // Check if we're logged in by looking for dashboard content
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const isLoggedIn = bodyText.includes('Dashboard') || bodyText.includes('Good Morning') || 
                       bodyText.includes('Good Afternoon') || bodyText.includes('Welcome') ||
                       bodyText.includes('Matters') || bodyText.includes('Properties');

    if (isLoggedIn) {
      console.log('  ✓ Demo login successful via URL bypass');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard-loaded.png'), fullPage: false });
      return page;
    } else {
      // Maybe the app is still loading — wait longer
      await page.waitForTimeout(5000);
      const bodyText2 = await page.evaluate(() => document.body?.innerText || '');
      const isLoggedIn2 = bodyText2.length > 500;

      if (isLoggedIn2) {
        console.log('  ✓ Demo login successful (delayed load)');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard-loaded.png'), fullPage: false });
        return page;
      }

      console.log('  ✗ Login appears to have failed — no dashboard content found');
      report.uiDefects.push({
        route: '/?impersonate=demo@practicepro.ng',
        component: 'login-flow',
        issue: 'URL bypass login did not load the dashboard. Demo mode may not be working.',
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-failed.png'), fullPage: true });
      await page.close();
      return null;
    }
  } catch (err: any) {
    console.log(`  ✗ Login failed: ${err.message.slice(0, 100)}`);
    report.uiDefects.push({
      route: '/?impersonate=demo@practicepro.ng',
      component: 'login-flow',
      issue: `URL bypass login failed: ${err.message.slice(0, 200)}`,
    });
    await page.close();
    return null;
  }
}

// ─── Phase 3: Test authenticated routes ──────────────────────────────────────

async function testAuthenticatedRoutes(page: any, report: AuditReport) {
  console.log('\n[audit] Phase 3: Testing authenticated routes...');

  const authRoutes = [
    { route: '/', name: 'dashboard' },
    { route: '/?view=matters', name: 'matters' },
    { route: '/?view=properties', name: 'properties' },
    { route: '/?view=tasks', name: 'tasks' },
    { route: '/?view=calendar', name: 'calendar' },
    { route: '/?view=billing', name: 'billing' },
    { route: '/?view=documents', name: 'documents' },
    { route: '/?view=messaging', name: 'messaging' },
    { route: '/?view=notes', name: 'notes' },
    { route: '/?view=reporting', name: 'reporting' },
    { route: '/?view=settings', name: 'settings' },
    { route: '/?view=help', name: 'help' },
  ];

  for (const { route, name } of authRoutes) {
    attachErrorListeners(page, route, report);
    await testRoute(page, route, report, `auth-${name}`);
  }
}

// ─── Phase 4: Test interactive elements ──────────────────────────────────────

async function testInteractiveElements(page: any, report: AuditReport) {
  console.log('\n[audit] Phase 4: Testing interactive elements...');

  // Test: Open and close modals
  try {
    await page.goto(`${TARGET_URL}/?view=matters`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for "New Matter" button
    const newMatterBtn = page.locator('button:has-text("New Matter"), button:has-text("Create"), [aria-label*="New"]').first();
    if (await newMatterBtn.isVisible().catch(() => false)) {
      await newMatterBtn.click();
      await page.waitForTimeout(1000);

      // Check if modal opened
      const modal = page.locator('[role="dialog"], .fixed.z-50, .modal').first();
      if (await modal.isVisible().catch(() => false)) {
        console.log('  ✓ New Matter modal opens');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'modal-new-matter.png'), fullPage: true });

        // Try to close it
        const closeBtn = page.locator('[aria-label="Close"], button:has-text("Cancel"), button:has-text("×")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
          await page.waitForTimeout(500);
          console.log('  ✓ Modal closes');
        }
      } else {
        report.uiDefects.push({
          route: '/?view=matters',
          component: 'NewMatterModal',
          issue: 'Clicking "New Matter" button did not open a modal',
        });
        console.log('  ✗ New Matter modal did not open');
      }
    }
  } catch (err: any) {
    report.uiDefects.push({
      route: '/?view=matters',
      component: 'interactive-test',
      issue: `Modal test error: ${err.message.slice(0, 200)}`,
    });
  }

  // Test: Settings accordions
  try {
    await page.goto(`${TARGET_URL}/?view=settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for accordion items
    const accordions = page.locator('[data-accordion], .accordion-item, button:has-text("Settings")');
    const count = await accordions.count();
    if (count > 0) {
      console.log(`  ✓ Found ${count} accordion items in settings`);
    }
  } catch (err: any) {
    // Non-critical
  }

  // Test: Sidebar navigation
  try {
    const navItems = page.locator('nav button, nav a, [role="tab"]');
    const navCount = await navItems.count();
    console.log(`  ✓ Found ${navCount} navigation items`);
  } catch (err: any) {
    // Non-critical
  }
}

// ─── Phase 5: Test portal routes ─────────────────────────────────────────────

async function testPortalRoutes(browser: any, report: AuditReport) {
  console.log('\n[audit] Phase 5: Testing portal routes...');
  const page = await browser.newPage();
  attachErrorListeners(page, 'portal', report);

  const portalRoutes = [
    { route: '/portal/tenant', name: 'tenant-portal' },
    { route: '/portal/client', name: 'client-portal' },
    { route: '/gatehouse', name: 'gatehouse' },
  ];

  for (const { route, name } of portalRoutes) {
    await testRoute(page, route, report, `portal-${name}`);
  }

  await page.close();
}

// ─── Phase 6: Detect dead-end buttons (onClick without handlers) ─────────────

async function testDeadEnds(browser: any, report: AuditReport) {
  console.log('\n[audit] Phase 6: Detecting dead-end buttons...');
  const page = await browser.newPage();
  attachErrorListeners(page, 'dead-ends', report);

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Find all buttons that might be dead-ends
    const deadEnds = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const issues: { component: string; issue: string; text: string }[] = [];

      for (const btn of buttons) {
        const text = btn.innerText?.trim() || btn.getAttribute('aria-label') || '';
        if (!text) continue;

        const hasOnClick = btn.onclick !== null || btn.hasAttribute('onclick');
        const hasListener = btn.getAttribute('data-listener') !== null;

        // Check if button is disabled
        if (btn.disabled) continue;

        // Check if button has no event handlers (heuristic: no onclick attribute and no role)
        if (!hasOnClick && !btn.hasAttribute('role') && text.length > 0 && text.length < 50) {
          // Check if it's inside a form (submit button)
          const isInForm = btn.closest('form') !== null;
          if (!isInForm && !btn.type || btn.type !== 'submit') {
            issues.push({
              component: 'button',
              issue: `Button "${text}" may be missing a click handler`,
              text,
            });
          }
        }
      }

      return issues.slice(0, 20); // Limit to 20
    });

    for (const deadEnd of deadEnds) {
      report.uiDefects.push({
        route: '/',
        component: deadEnd.component,
        issue: deadEnd.issue,
      });
    }

    console.log(`  ✓ Found ${deadEnds.length} potential dead-end buttons`);
  } catch (err: any) {
    // Non-critical
  }

  await page.close();
}

// ─── Phase 7: UI/UX Quality Audit ────────────────────────────────────────────

async function testUIUXQuality(browser: any, report: AuditReport) {
  console.log('\n[audit] Phase 7: Auditing UI/UX quality...');

  const page = await browser.newPage();
  attachErrorListeners(page, 'uiux', report);

  try {
    await page.goto(DEMO_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // ─── Check 1: Text legibility (font sizes, opacity) ─────────────────────
    const legibilityIssues = await page.evaluate(() => {
      const issues: { component: string; issue: string }[] = [];
      const allElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, label, button, a, div');

      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);

        if (fontSize > 0 && fontSize < 12) {
          const text = el.textContent?.trim().slice(0, 50) || '';
          if (text) {
            issues.push({
              component: 'text-legibility',
              issue: `Text "${text}" is ${fontSize}px (below 12px minimum)`,
            });
          }
        }

        const opacity = parseFloat(style.opacity);
        if (opacity > 0 && opacity < 0.5 && el.textContent?.trim()) {
          issues.push({
            component: 'text-opacity',
            issue: `Text "${el.textContent?.trim().slice(0, 30)}" has opacity ${opacity} (too transparent)`,
          });
        }
      }

      return issues.slice(0, 15);
    });

    for (const issue of legibilityIssues) {
      report.uiDefects.push({ route: '/dashboard', ...issue });
    }
    console.log(`  ✓ Found ${legibilityIssues.length} text legibility issues`);

    // ─── Check 2: Layout overflow ───────────────────────────────────────────
    const overlapIssues = await page.evaluate(() => {
      const issues: { component: string; issue: string }[] = [];
      const fixedElements = Array.from(document.querySelectorAll('[class*="fixed"], [class*="sticky"], [class*="absolute"]'));

      for (const el of fixedElements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 10 || rect.bottom > window.innerHeight + 10) {
          issues.push({
            component: 'layout-overflow',
            issue: `Fixed/absolute element extends beyond viewport`,
          });
        }
      }

      return issues.slice(0, 10);
    });

    for (const issue of overlapIssues) {
      report.uiDefects.push({ route: '/dashboard', ...issue });
    }
    console.log(`  ✓ Found ${overlapIssues.length} layout overflow issues`);

    // ─── Check 3: Touch target sizes ────────────────────────────────────────
    const touchTargetIssues = await page.evaluate(() => {
      const issues: { component: string; issue: string }[] = [];
      const clickables = document.querySelectorAll('button, a, [role="button"], [onclick]');

      for (const el of clickables) {
        const rect = el.getBoundingClientRect();
        const text = el.textContent?.trim().slice(0, 30) || '';
        if (rect.height > 0 && rect.height < 32 && text) {
          issues.push({
            component: 'touch-target',
            issue: `Clickable "${text}" is ${rect.height}px tall (min 32px)`,
          });
        }
      }

      return issues.slice(0, 10);
    });

    for (const issue of touchTargetIssues) {
      report.uiDefects.push({ route: '/dashboard', ...issue });
    }
    console.log(`  ✓ Found ${touchTargetIssues.length} touch target issues`);

    // ─── Check 4: Navigate to key routes and screenshot ─────────────────────
    const routes = [
      { name: 'matters', navText: ['Matters', 'Cases'] },
      { name: 'properties', navText: ['Properties', 'Portfolio'] },
      { name: 'tasks', navText: ['Tasks'] },
      { name: 'calendar', navText: ['Calendar'] },
      { name: 'billing', navText: ['Billing', 'Finance'] },
      { name: 'documents', navText: ['Documents'] },
      { name: 'messaging', navText: ['Messages', 'Inbox'] },
      { name: 'settings', navText: ['Settings'] },
    ];

    for (const route of routes) {
      try {
        let found = false;
        for (const text of route.navText) {
          const navItem = page.locator(`nav button:has-text("${text}"), nav a:has-text("${text}"), [role="tab"]:has-text("${text}"), button:has-text("${text}")`).first();
          if (await navItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await navItem.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `route-${route.name}.png`), fullPage: false });
            found = true;
            console.log(`  ✓ Navigated to ${route.name}`);
            break;
          }
        }
        if (!found) {
          report.uiDefects.push({
            route: `/${route.name}`,
            component: 'navigation',
            issue: `Could not find nav item for "${route.name}"`,
          });
        }
      } catch (err: any) {
        // Non-critical
      }
    }

  } catch (err: any) {
    report.uiDefects.push({
      route: '/uiux',
      component: 'uiux-audit',
      issue: `UI/UX audit error: ${err.message.slice(0, 200)}`,
    });
  }

  await page.close();
}

// ─── Run ──────────────────────────────────────────────────────────────────────

runAudit().catch(err => {
  console.error('[audit] Unhandled error:', err);
  process.exit(1);
});
