# PracticePro Backup & Disaster Recovery

## What's Backed Up

| Component | Backup Method | Frequency | Retention |
|---|---|---|---|
| **Convex Database** (all 72 tables) | Nightly export → Cloudflare R2 | Daily at 2:00 AM UTC (3 AM WAT) | 30 days |
| **Code** | GitHub (with full git history) | Every push | Unlimited |
| **Frontend** | Rebuilds from GitHub on deploy | Every push | Unlimited |
| **API keys / secrets** | Manual export to password manager | One-time | Permanent |

## Setting Up Cloudflare R2 (One-Time, ~10 Minutes)

### Step 1: Create a Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free)

### Step 2: Create an R2 Bucket
1. In the Cloudflare dashboard, click **R2** in the left sidebar
2. Click **Create bucket**
3. Name it: `practicepro-backups`
4. Location: Auto (let Cloudflare decide)
5. Click **Create**

### Step 3: Get Your Account ID
1. Still in the R2 dashboard
2. Look at the right sidebar — you'll see **Account ID**
3. Copy it (looks like `a1b2c3d4e5f6...`)

### Step 4: Create an API Token
1. In R2 dashboard, click **Manage R2 API Tokens** (or go to R2 → API Tokens)
2. Click **Create API Token**
3. Name: `practicepro-convex-backup`
4. Permissions: **Object Read & Write**
5. Specify bucket: `practicepro-backups` (or all buckets)
6. Click **Create API Token**
7. You'll see:
   - **Access Key ID** — copy this
   - **Secret Access Key** — copy this (only shown once!)
   - **Endpoint** — looks like `https://a1b2c3d4.r2.cloudflarestorage.com`
8. **Save all three in a password manager immediately**

### Step 5: Add Environment Variables to Convex
1. Go to your Convex dashboard: https://dashboard.convex.dev
2. Select your deployment: `gregarious-malamute-537`
3. Go to **Settings → Environment Variables**
4. Add these 5 variables (for both Production and Preview):

| Name | Value |
|---|---|
| `R2_ACCOUNT_ID` | (your account ID from step 3) |
| `R2_ACCESS_KEY` | (access key ID from step 4) |
| `R2_SECRET_KEY` | (secret access key from step 4) |
| `R2_BUCKET_NAME` | `practicepro-backups` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

5. Click **Save** on each

### Step 6: Trigger a Test Backup
Once the env vars are set and the code is deployed, you can trigger a backup immediately from the Convex dashboard:
1. Go to your Convex dashboard
2. Go to **Functions** → find `backups/triggerBackupNow`
3. Click **Run Function**
4. Check the logs — you should see:
   ```
   [Backup] Starting export for 2026-06-25...
   [Backup] firms: 5 docs (2.1 KB)
   [Backup] users: 23 docs (8.4 KB)
   ...
   [Backup] ✓ Uploaded to R2: 2026-06-25/convex-backup-020000.json.gz
   ```

### Step 7: Verify in R2
1. Go back to Cloudflare R2 dashboard
2. Click on `practicepro-backups` bucket
3. You should see a folder `2026-06-25/` containing `convex-backup-020000.json.gz`

---

## How to Restore from Backup

### If you need to restore the entire database:

1. **Download the backup from R2**
   ```bash
   # Install rclone or use the R2 web UI to download
   # The file is: YYYY-MM-DD/convex-backup-HHMMSS.json.gz
   ```

2. **Decompress it**
   ```bash
   gunzip convex-backup-020000.json.gz
   ```

3. **Import to a new Convex deployment**
   - Create a new Convex project
   - Deploy your schema: `npx convex deploy`
   - Write a restore script that reads the JSON and inserts documents via Convex mutations
   - (I can build this restore script when needed — it's not needed until a disaster happens)

### If only specific tables need restoration:
1. Download the backup JSON
2. Extract just the affected table array
3. Write targeted mutations to upsert those documents

---

## Disaster Recovery Runbook

### Scenario: Convex has a regional outage
1. **Immediate**: Your app will go read-only (Convex is unavailable)
2. **Short-term**: Wait for Convex to recover (usually < 1 hour)
3. **Long-term**: If Convex is down for > 24 hours:
   - Create a new Convex project in a different region
   - Deploy your code: `npx convex deploy`
   - Download latest backup from R2
   - Run the restore script (to be built when needed)
   - Update `VITE_CONVEX_URL` in your frontend env
   - Redeploy frontend

### Scenario: Convex account is locked / billing dispute
1. Your data is safe in R2 — you have 30 days of backups
2. Create a new Convex project under a different account
3. Deploy + restore from R2 backup
4. Update frontend env vars + redeploy

### Scenario: Accidental data deletion
1. Don't panic — last night's backup is in R2
2. Download the backup
3. Extract the affected table
4. Write a script to re-insert the deleted documents
5. (I can build this on-demand)

---

## Costs

| Item | Free Tier | Your Expected Usage |
|---|---|---|
| R2 Storage | 10 GB/month | ~1-3 GB (well within free) |
| R2 Class A ops (writes) | 1M/month | ~30/month (1 backup × 30 days) |
| R2 Class B ops (reads) | 10M/month | ~0 (only read during restore) |
| R2 Egress | Unlimited free | $0 forever |
| **Total monthly cost** | | **$0.00** |

---

## Monitoring

### Check if backups are running:
1. Convex dashboard → **Functions** → `backups/runBackup`
2. Check the **Logs** tab — you should see nightly entries at 2:00 AM UTC

### Check what's in R2:
1. Cloudflare R2 dashboard → `practicepro-backups` bucket
2. You'll see folders organized by date: `2026-06-25/`, `2026-06-26/`, etc.

### If backups stop working:
- Check that R2 env vars are still set in Convex
- Check Convex function logs for errors
- Verify R2 API token hasn't expired
- Run `triggerBackupNow` manually to test

---

## What's NOT Backed Up Yet (Future Work)

| Item | Status | Recommendation |
|---|---|---|
| File uploads (portal attachments, documents) | ⚠️ In Convex File Storage only | Build nightly file mirror to R2 |
| GitHub repo | ✅ On GitHub | Consider mirroring to GitLab |
| API keys | ⚠️ In Convex env vars | Export to password manager NOW |

### To back up file uploads:
The database backup includes the *storage IDs* of all uploaded files, but not the file *contents*. If you need the file contents backed up too, I can build a second cron that:
1. Queries all documents with file attachments
2. Downloads each file from Convex File Storage
3. Uploads to R2 at `files/<storageId>`

This is important for full disaster recovery. Let me know if you want me to build this.
