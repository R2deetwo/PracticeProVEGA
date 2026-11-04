#!/usr/bin/env node
/** R67 — poll the production-deploy run status (token from git cred store). */
const fs = require('fs');
const https = require('https');

const REPO = 'R2deetwo/PracticeProVEGA';

function token() {
  const raw = fs.readFileSync(`${process.env.HOME}/.git-credentials`, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/https:\/\/([^:]+):([^@]+)@github\.com/);
    if (m) return m[2];
  }
  throw new Error('no token');
}

function api(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/${path}`,
      headers: { Authorization: `token ${token()}`, Accept: 'application/vnd.github+json', 'User-Agent': 'r67-poll' },
    }, (res) => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  // find the latest production-deploy run
  for (let i = 0; i < 60; i++) {
    const runs = await api('actions/workflows/production-deploy.yml/runs?per_page=1');
    const run = runs.workflow_runs?.[0];
    if (run) {
      const jobs = await api(`actions/runs/${run.id}/jobs`);
      const jobLines = jobs.jobs.map(j => `    ${j.name}: ${j.status}${j.conclusion ? ' / ' + j.conclusion : ''}`).join('\n');
      console.log(`run ${run.id} ${run.status}${run.conclusion ? ' / ' + run.conclusion : ''} (${run.html_url})\n${jobLines}`);
      if (run.status === 'completed') {
        console.log('FINAL:', run.conclusion);
        process.exit(run.conclusion === 'success' ? 0 : 2);
      }
    }
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('TIMED OUT waiting for run');
  process.exit(1);
})();
