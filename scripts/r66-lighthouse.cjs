#!/usr/bin/env node
/**
 * R65 — Lighthouse Performance on /vega against the local preview build.
 * Usage: node r65_lighthouse.cjs <label>   (label: "after" | "before")
 */
const { spawn } = require('child_process');
const fs = require('fs');

const REPO = '/home/z/my-project/tmp/pprepo';
const OUT = '/home/z/my-project/download/r66-video-hero';
const PORT = 4175;
const label = process.argv[2] || 'run';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. preview server
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://localhost:${PORT}/version.json`); if (r.ok) break; } catch {}
      await sleep(500);
    }
    // 2. lighthouse
    const reportFile = `${OUT}/lighthouse-${label}.json`;
    const lh = spawn('npx', ['lighthouse', `http://localhost:${PORT}/vega`,
      '--output=json', `--output-path=${reportFile}`, '--preset=desktop',
      '--only-categories=performance', '--quiet',
      '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage'],
      { cwd: REPO, env: { ...process.env, CHROME_PATH: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' }, stdio: 'inherit' });
    const code = await new Promise((res) => lh.on('close', res));
    if (code !== 0) throw new Error('lighthouse exited ' + code);

    // 3. summarize
    const rep = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const perf = rep.categories.performance.score * 100;
    const audits = rep.audits;
    const lcp = audits['largest-contentful-paint'];
    const lcpEl = lcp.details && lcp.details.items && lcp.details.items[0];
    const fcp = audits['first-contentful-paint'];
    const tbt = audits['total-blocking-time'];
    const cls = audits['cumulative-layout-shift'];
    const summary = {
      label, performanceScore: perf,
      lcp: { value: lcp.numericValue, display: lcp.displayValue,
             element: lcpEl ? (lcpEl.items && lcpEl.items[0] ? (lcpEl.items[0].node ? lcpEl.items[0].node.snippet : String(lcpEl.items[0])) : 'n/a') : 'n/a' },
      fcp: { value: fcp.numericValue, display: fcp.displayValue },
      tbt: { value: tbt.numericValue, display: tbt.displayValue },
      cls: { value: cls.numericValue, display: cls.displayValue },
    };
    fs.writeFileSync(`${OUT}/lighthouse-${label}-summary.json`, JSON.stringify(summary, null, 2));
    console.log('SUMMARY:', JSON.stringify(summary, null, 2));
  } finally {
    server.kill('SIGKILL');
  }
})().catch((e) => { console.error('LIGHTHOUSE RUN FAILED:', e); process.exit(1); });
