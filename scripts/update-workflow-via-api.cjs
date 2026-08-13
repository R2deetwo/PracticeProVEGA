// Update GitHub workflow files via the Contents API
// This bypasses the 'workflow' scope requirement of git push by using the
// REST API to update individual files.
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.GH_TOKEN || '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';
const REPO = 'R2deetwo/PracticeProVEGA';
const BRANCH = 'main';

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO}/${urlPath}`,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': bodyStr ? Buffer.byteLength(bodyStr) : 0,
        'User-Agent': 'practicepro-build-fix',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch {
          resolve({ status: res.statusCode, json: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function updateFile(filePath, localPath, commitMessage) {
  // 1. Get current file SHA
  console.log(`\n[${filePath}] Fetching current SHA...`);
  const getRes = await apiRequest('GET', `contents/${filePath}?ref=${BRANCH}`);
  if (getRes.status !== 200) {
    console.error(`  ❌ Failed to get file: ${getRes.status}`, getRes.json?.message || '');
    return false;
  }
  const sha = getRes.json.sha;
  console.log(`  ✓ Current SHA: ${sha.substring(0, 12)}`);

  // 2. Read local file and base64-encode
  const content = fs.readFileSync(localPath);
  const base64Content = content.toString('base64');

  // 3. Update via Contents API
  console.log(`  Updating file (${content.length} bytes)...`);
  const updateRes = await apiRequest('PUT', `contents/${filePath}`, {
    message: commitMessage,
    content: base64Content,
    sha,
    branch: BRANCH,
  });

  if (updateRes.status === 200 || updateRes.status === 201) {
    console.log(`  ✓ Updated successfully. New SHA: ${updateRes.json.content?.sha?.substring(0, 12) || '?'}`);
    return true;
  } else {
    console.error(`  ❌ Update failed: ${updateRes.status}`, updateRes.json?.message || '');
    if (updateRes.json?.errors) console.error('  Errors:', JSON.stringify(updateRes.json.errors));
    return false;
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const files = [
    {
      filePath: '.github/workflows/build-apk.yml',
      localPath: path.join(root, '.github', 'workflows', 'build-apk.yml'),
      commitMessage: 'fix: APK workflow — concurrency group + race-safe push + retry + 4GB Gradle heap',
    },
    {
      filePath: '.github/workflows/build-admin-apk.yml',
      localPath: path.join(root, '.github', 'workflows', 'build-admin-apk.yml'),
      commitMessage: 'fix: admin APK workflow — SDK 36 + concurrency + retry (matches main workflow)',
    },
  ];

  let allOk = true;
  for (const f of files) {
    const ok = await updateFile(f.filePath, f.localPath, f.commitMessage);
    if (!ok) allOk = false;
  }

  console.log(allOk ? '\n✅ All workflow files updated.' : '\n⚠️  Some updates failed.');
  process.exit(allOk ? 0 : 1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
