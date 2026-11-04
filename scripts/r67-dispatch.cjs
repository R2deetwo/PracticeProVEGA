#!/usr/bin/env node
/** R67 — dispatch production-deploy.yml on the pinned sha (token from the
 * git credential store; never printed). Prints HTTP status + run id only. */
const fs = require('fs');
const https = require('https');

const SHA = process.argv[2];
const REPO = 'R2deetwo/PracticeProVEGA';

function token() {
  // ~/.git-credentials line: https://<user>:<token>@github.com
  const raw = fs.readFileSync(`${process.env.HOME}/.git-credentials`, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/https:\/\/([^:]+):([^@]+)@github\.com/);
    if (m) return m[2];
  }
  throw new Error('no github token in credential store');
}

const body = JSON.stringify({ ref: 'main', inputs: { sha: SHA } });
const req = https.request({
  hostname: 'api.github.com',
  path: `/repos/${REPO}/actions/workflows/production-deploy.yml/dispatches`,
  method: 'POST',
  headers: {
    Authorization: `token ${token()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'User-Agent': 'r67-promote',
  },
}, (res) => {
  let d = '';
  res.on('data', c => (d += c));
  res.on('end', () => {
    console.log('dispatch status:', res.statusCode, res.headers.location || d.slice(0, 200));
    if (res.statusCode !== 204) process.exit(1);
  });
});
req.write(body);
req.end();
