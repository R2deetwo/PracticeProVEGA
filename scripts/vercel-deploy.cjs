#!/usr/bin/env node
/**
 * Vercel deploy script — uploads files and creates a production deployment
 * via the Vercel REST API (bypasses the CLI's broken user-lookup logic).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = 'practice-pro-vega';
const TEAM = 'team_A7hmMQYYvmT5paSA3ZbPdnip';
const DIST = path.join(__dirname, '..', 'dist');

if (!TOKEN) { console.error('VERCEL_TOKEN not set'); process.exit(1); }
if (!fs.existsSync(DIST)) { console.error('dist/ not found — run build first'); process.exit(1); }

async function api(endpoint, opts = {}) {
  const url = endpoint.includes('?')
    ? `https://api.vercel.com${endpoint}`
    : `https://api.vercel.com${endpoint}?teamId=${TEAM}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    console.error(`API ${res.status}:`, JSON.stringify(json).slice(0, 500));
    throw new Error(`API error ${res.status}`);
  }
  return json;
}

function walk(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...walk(path.join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

async function main() {
  // 1. Collect all files in dist/
  const filePaths = walk(DIST);
  console.log(`[deploy] Found ${filePaths.length} files in dist/`);

  // 2. Compute SHA for each file
  const files = filePaths.map(rel => {
    const abs = path.join(DIST, rel);
    const content = fs.readFileSync(abs);
    const sha = crypto.createHash('sha1').update(content).digest('hex');
    // Vercel API v12+ requires both 'sha' (legacy) and 'digest' (new format)
    return { file: rel, sha, digest: `sha1-${sha}`, size: content.length };
  });

  // 3. Upload each file individually — check response for errors
  const uploaded = new Set();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = fs.readFileSync(path.join(DIST, file.file));
    process.stdout.write(`  [${i+1}/${files.length}] ${file.file}... `);
    try {
      const uploadRes = await fetch('https://api.vercel.com/v2/files?teamId=' + TEAM, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'x-vercel-digest': file.sha,  // raw sha1 hex, NOT 'sha1-xxx'
          'Content-Length': file.size,
        },
        body: content,
      });
      if (uploadRes.ok) {
        uploaded.add(file.sha);
        console.log('✓ uploaded');
      } else {
        const errText = await uploadRes.text();
        // If file already exists, that's fine
        if (errText.includes('already') || uploadRes.status === 409) {
          uploaded.add(file.sha);
          console.log('✓ exists');
        } else {
          console.log(`✗ ${uploadRes.status}: ${errText.slice(0, 100)}`);
        }
      }
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
  console.log(`[deploy] Uploaded ${uploaded.size} files`);

  // 4. Create deployment — skip build since we uploaded pre-built dist/
<<<<<<< HEAD
  //    Include vercel.json config inline so rewrites/headers work correctly.
=======
>>>>>>> ce3f5d6 (3692863c-c258-460e-95fa-4dfbe91c9667)
  console.log('[deploy] Creating production deployment...');
  const deployRes = await api('/v13/deployments?skipBuild=1', {
    method: 'POST',
    body: JSON.stringify({
      name: PROJECT,
      target: 'production',
      files: files.map(f => ({ file: f.file, sha: f.sha, size: f.size })),
      projectSettings: {
        framework: null,
        buildCommand: null,
        outputDirectory: null,
        installCommand: null,
      },
<<<<<<< HEAD
      routes: [
        { src: '/version.json', dest: '/version.json', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0' } },
        { src: '/assets/(.*)', dest: '/assets/$1', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        { src: '/(.*\\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico))', dest: '/$1', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        { src: '/(.*)', dest: '/index.html' },
      ],
=======
>>>>>>> ce3f5d6 (3692863c-c258-460e-95fa-4dfbe91c9667)
    }),
  });

  console.log('[deploy] Deployment created!');
  console.log('  ID:', deployRes.id);
  console.log('  URL:', deployRes.url);
  console.log('  Inspector:', deployRes.inspectorUrl);

  // 5. Wait for deployment to be ready
  console.log('[deploy] Waiting for deployment to build...');
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const status = await api(`/v13/deployments/${deployRes.id}`);
    if (status.readyState === 'READY') {
      ready = true;
      console.log('[deploy] ✅ Deployment READY!');
      console.log('  Production URL:', `https://${status.alias?.[0] || status.url}`);
    } else if (status.readyState === 'ERROR') {
      console.error('[deploy] ❌ Deployment FAILED');
      console.error(JSON.stringify(status, null, 2));
      process.exit(1);
    } else {
      process.stdout.write(`  ${status.readyState}...`);
    }
  }
  if (!ready) console.error('[deploy] Timed out waiting for deployment');
}

main().catch(e => { console.error(e); process.exit(1); });
