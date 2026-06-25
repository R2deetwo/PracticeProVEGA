# PracticePro Backup & Disaster Recovery

## What's Backed Up

| Component | Backup Method | Frequency | Retention |
|---|---|---|---|
| **Convex Database** (all 72 tables) | Nightly export → GitHub + Telegram | Daily at 2:00 AM UTC (3 AM WAT) | 30 days |
| **Code** | GitHub (with full git history) | Every push | Unlimited |
| **Frontend** | Rebuilds from GitHub on deploy | Every push | Unlimited |
| **API keys / secrets** | Manual export to password manager | One-time | Permanent |

---

## Two Redundant Targets (Both Free, No Credit Card)

Your database backup goes to **both** of these every night:

1. **GitHub Private Repo** — browseable via web UI, downloadable via git
2. **Telegram Private Channel** — files stored in Telegram's cloud forever

If one goes down, the other still has your data.

---

## Part 1: GitHub Setup (5 minutes)

### Step 1: Create a Private GitHub Repo
1. Go to https://github.com/new
2. Repository name: `PracticePro-Backups`
3. **Private** (not public — your data is in here)
4. **Don't** initialize with README (keeps it empty)
5. Click **Create repository**

### Step 2: Create a Personal Access Token
1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Note: `PracticePro Backup`
4. Expiration: **No expiration** (or 1 year — you'll need to renew)
5. Scopes: check **`repo`** (full repo access)
6. Click **Generate token**
7. **Copy the token immediately** — you won't see it again. Looks like `ghp_xxxxxxxxxxxx...`

### Step 3: Add Env Vars to Convex
Go to your Convex dashboard → **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `GITHUB_BACKUP_TOKEN` | `ghp_xxxxxxxxxxxx...` (your token) |
| `GITHUB_BACKUP_OWNER` | `R2deetwo` (your GitHub username) |
| `GITHUB_BACKUP_REPO` | `PracticePro-Backups` |

### Step 4: Test
In Convex dashboard → **Functions** → find `backups/triggerBackupNow` → click **Run Function**. Check logs for `✓ GitHub: https://github.com/...`. Then go to your repo — you'll see a folder `2026-06-25/` containing the backup file.

---

## Part 2: Telegram Setup (5 minutes)

### Step 1: Create a Telegram Bot
1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Name: `PracticePro Backup Bot`
4. Username: `practicepro_backup_bot` (must end in `_bot`)
5. BotFather gives you a **token** — copy it. Looks like `123456789:ABCdefGHIjklMNOpqr...`

### Step 2: Create a Private Channel
1. In Telegram, click the pencil icon → **New Channel**
2. Name: `PracticePro Backups`
3. **Private** (not public)
4. Click **Create**

### Step 3: Add the Bot to the Channel
1. Open your new channel
2. Click the channel name → **Administrators** → **Add Admin**
3. Search for your bot's username (`@practicepro_backup_bot`)
4. Make sure **Post Messages** permission is ON
5. Click **Save**

### Step 4: Get the Channel ID
1. In the channel, post any message
2. Forward that message to **@userinfobot** (or use @RawDataBot)
3. It replies with the chat info — copy the **chat ID** (a negative number like `-1001234567890`)

Alternatively, open the channel in the Telegram web client (web.telegram.org) and look at the URL — the number after `#/p` or in the URL is related to the chat ID.

### Step 5: Add Env Vars to Convex
Go to your Convex dashboard → **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456789:ABCdefGHIjklMNOpqr...` |
| `TELEGRAM_BACKUP_CHAT_ID` | `-1001234567890` |

### Step 6: Test
In Convex dashboard → **Functions** → find `backups/triggerBackupNow` → click **Run Function**. Check logs for `✓ Telegram: message 123`. Then open your Telegram channel — you'll see the backup file.

---

## Part 3: Verify Everything Works

Once both targets are configured, trigger a test backup:
1. Convex dashboard → **Functions** → `backups/triggerBackupNow` → **Run Function**
2. Check the logs — you should see both:
   ```
   [Backup] ✓ GitHub: https://github.com/R2deetwo/PracticePro-Backups/...
   [Backup] ✓ Telegram: message 456
   ```
3. Verify in GitHub: your repo now has `2026-06-25/convex-backup-HHMMSS.json.gz`
4. Verify in Telegram: your channel now has a file message

You can also check status via the `backups/getBackupStatus` function — it returns which targets are configured and the last 10 backup results.

---

## How to Restore from Backup

### Option A: Restore from GitHub
```bash
# Clone your backup repo
git clone https://github.com/R2deetwo/PracticePro-Backups.git
cd PracticePro-Backups

# Find the date you want to restore
ls  # shows folders like 2026-06-25/

# Decompress
gunzip 2026-06-25/convex-backup-020000.json.gz

# Now you have convex-backup-020000.json — a full snapshot of all tables
```

### Option B: Restore from Telegram
1. Open your Telegram channel
2. Download the `.json.gz` file from the desired date
3. Decompress: `gunzip convex-backup-020000.json.gz`

### Importing the Backup
The JSON file contains an object with each table name as a key:
```json
{
  "_metadata": { "exportedAt": "...", "tableCount": 72 },
  "firms": [ ... ],
  "users": [ ... ],
  "matters": [ ... ],
  ...
}
```

To restore to a new Convex deployment:
1. Create a new Convex project
2. Deploy your schema: `npx convex deploy`
3. Write a restore script that reads the JSON and inserts documents via Convex mutations
4. (I can build this restore script on-demand — it's only needed during an actual disaster)

---

## Disaster Recovery Runbook

### Scenario: Convex has a regional outage
1. **Immediate**: Your app will go read-only (Convex is unavailable)
2. **Short-term**: Wait for Convex to recover (usually < 1 hour)
3. **Long-term**: If Convex is down for > 24 hours:
   - Create a new Convex project in a different region
   - Deploy your code: `npx convex deploy`
   - Download latest backup from GitHub or Telegram
   - Run the restore script (I can build this when needed)
   - Update `VITE_CONVEX_URL` in your frontend env
   - Redeploy frontend

### Scenario: Convex account is locked / billing dispute
1. Your data is safe — you have 30 days of backups in GitHub AND Telegram
2. Create a new Convex project under a different account
3. Deploy + restore from either backup target
4. Update frontend env vars + redeploy

### Scenario: Accidental data deletion
1. Don't panic — last night's backup is in both GitHub and Telegram
2. Download the backup
3. Extract the affected table array
4. Write a script to re-insert the deleted documents
5. (I can build this on-demand)

### Scenario: GitHub is down / account locked
1. Your Telegram backup is completely independent — still safe
2. Restore from Telegram instead

### Scenario: Telegram is down
1. Your GitHub backup is completely independent — still safe
2. Restore from GitHub instead

---

## Costs

| Item | Cost |
|---|---|
| GitHub Private Repo | **$0** (free since 2019) |
| Telegram Bot API | **$0** (free forever) |
| Convex (your existing plan) | Already paying |
| **Total additional cost** | **$0.00/month** |

---

## Monitoring

### Check if backups are running:
1. Convex dashboard → **Functions** → `backups/runBackup`
2. Check the **Logs** tab — nightly entries at 2:00 AM UTC

### Check GitHub:
1. Go to your `PracticePro-Backups` repo
2. You'll see folders organized by date

### Check Telegram:
1. Open your `PracticePro Backups` channel
2. Each backup is a file message with the date in the caption

### Check via API:
Run the `backups/getBackupStatus` function in Convex dashboard. It returns:
```json
{
  "githubConfigured": true,
  "telegramConfigured": true,
  "tableCount": 72,
  "recentBackups": [
    { "target": "github", "backupKey": "2026-06-25/...", "success": true, "sizeBytes": 456789, ... },
    { "target": "telegram", "backupKey": "2026-06-25/...", "success": true, ... }
  ]
}
```

### If backups stop working:
- Check that env vars are still set in Convex
- Check Convex function logs for errors
- Verify GitHub token hasn't expired (regenerate if needed)
- Verify Telegram bot is still in the channel as admin
- Run `triggerBackupNow` manually to test

---

## What's NOT Backed Up Yet (Future Work)

| Item | Status | Recommendation |
|---|---|---|
| File uploads (portal attachments, documents) | ⚠️ In Convex File Storage only | Build nightly file mirror to GitHub/Telegram |
| API keys | ⚠️ In Convex env vars | Export to password manager NOW |

### To back up file uploads:
The database backup includes the *storage IDs* of all uploaded files, but not the file *contents*. If you need file contents backed up too, a second cron can:
1. Query all documents with file attachments
2. Download each file from Convex File Storage
3. Upload to GitHub and/or Telegram

Let me know if you want me to build this.
