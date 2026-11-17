# Brand Clarity Runbook — what changed & how to run it

> For the founder and any agent operating this repo. Written for the Brand
> Clarity Pass (2026-11-18). Companion documents:
> `docs/brand/BRAND_CONSISTENCY_AUDIT.md` (what was wrong) and
> `docs/brand-architecture.md` (the standard).

## 1. What changed, in one page

| Change | Where | Effect |
|---|---|---|
| **The splash now ends on the product** | `src/components/SplashScreen.tsx`, `src/components/splashEndCard.ts`, `src/components/App.tsx` | The cinematic sequence you liked is untouched (black → amber → green); the final settle frame now heroes **Vega / Atrium / Komplete** with a small "by PracticePro Systems" credit. Logged-out users see the company logo + a "Vega · Atrium · Komplete" lockup. |
| **Fixed a latent splash bug** | `App.tsx` (old line ~1933) | Atrium firms previously resolved to `'vega'` (a dead `=== 'property'` comparison); unified firms never got a Komplete card. Both fixed via `normalizeSplashProduct()`. |
| **The published APK is no longer a debug build** | `.github/workflows/build-apk.yml` | CI builds `assembleRelease` and publishes THAT to Releases + the in-app updater. While the keystore secret is unset it falls back to the debug build (stable signature — updates keep working) and the filename says `-debug`. |
| **Stable release signing** | `build-apk.yml`, `build-admin-apk.yml` | The random per-run keystore generation is gone. The keystore comes from the `RELEASE_KEYSTORE_BASE64` secret. **You must do the one-time setup in §3.** |
| **APK filenames are branded** | CI workflows | `practicepro-1.0.791-release.apk` (universal), `vega-…`, `atrium-…`, `komplete-…` (product variants), `practicepro-founder-…-release.apk` (founder). |
| **Per-product wrapper builds** | `capacitor.{vega,atrium,komplete}.config.ts`, `scripts/sync-product-config.cjs`, `scripts/generate-product-launcher-assets.py`, `android/branding/` | "Vega" on the home screen with the Seal as the launcher icon, same `com.practicepro.app` (in-place update for every existing install). Law firms download Vega; estate managers download Atrium. |
| **Founder APK pulled from public Releases** | `build-admin-apk.yml` | It was on the public Releases page of a public repo — anyone could download the founder/admin app. Now it is a login-gated Actions artifact only. |
| **Brand rules for agents** | `AGENTS.md`, `CONTEXT.md`, `README.md` | Future agent sessions are pointed at `docs/brand-architecture.md` and the naming model. |
| **Regression pins** | `tests/unit/brandClarity.test.ts` | All of the above is pinned so it cannot silently regress. |

## 2. How to build APKs now

### Universal build (the default — what users get via the in-app updater)

Nothing to do — every push to `main` builds it automatically. Download from
**Releases** (public, no login, works on mobile):
`https://github.com/R2deetwo/PracticeProVEGA/releases`

- Do NOT use the Actions "Artifacts" section for human downloads: it
  requires a GitHub login (that's why the download button was missing on
  your phone) and wraps the APK in a zip (that zip is what triggered your
  desktop antivirus).
- The in-app update prompt (`version.json` → `apkUrl`) points at Releases
  automatically.

### Per-product builds (Vega / Atrium / Komplete)

Manual trigger (keeps the push pipeline fast):

1. GitHub repo → **Actions** tab → **Build Product APKs (Vega / Atrium / Komplete)** → **Run workflow**
2. Choose `all` (or one product) → Run
3. When it finishes: Releases page shows a pre-release "Product APKs v…"
   with `vega-…-release.apk`, `atrium-…-release.apk`, `komplete-…-release.apk`

Locally (you have the repo checked out):

```bash
npm run apk:vega:release      # or apk:atrium:release / apk:komplete:release
# debug channel: npm run apk:vega:debug
```

The swap script patches the wrapper (app name, launcher icons), runs the
build, then **restores the universal state automatically** — your working
tree is never left clobbered.

### Founder build (unchanged flow)

```bash
npm run apk:admin:release
```
Distributed ONLY as a login-gated Actions artifact (`practicepro-founder-v…-release.apk`). It is never a public Release — that was a real exposure on a public repo, now closed.

## 3. ONE-TIME setup: the release keystore secret (do this when ready)

Until you do this, every published APK stays debug-signed (works, updates
fine, but debuggable — not right for a legal product long-term).

1. **Create the keystore ONCE, on your machine, and keep it safe forever**
   (if it is lost, users must reinstall the app; if it leaks, someone can
   impersonate your updates):

   ```bash
   cd android/app
   keytool -genkeypair -keystore release.keystore -alias practicepro-app \
     -keyalg RSA -keysize 4096 -validity 10950 -storetype PKCS12 \
     -dname "CN=PracticePro Systems Limited, OU=Engineering, O=PracticePro Systems Limited, L=Lagos, ST=Lagos, C=NG"
   keytool -genkeypair -keystore release.keystore -alias practicepro-admin \
     -keyalg RSA -keysize 4096 -validity 10950 -storetype PKCS12 \
     -dname "CN=PracticePro Systems Limited, OU=Founder App, O=PracticePro Systems Limited, L=Lagos, ST=Lagos, C=NG"
   ```
   Use the SAME passwords as the existing `RELEASE_STORE_PASSWORD` /
   `RELEASE_KEY_PASSWORD` secrets. Store both passwords in your password
   manager and back the file up somewhere safe (not the repo — it is
   gitignored on purpose).

2. **Upload it as a GitHub secret** — repo → Settings → Secrets and
   variables → Actions → New repository secret:
   - Name: `RELEASE_KEYSTORE_BASE64`
   - Value: the output of `base64 -w0 android/app/release.keystore`
     (macOS: `base64 -i android/app/release.keystore`)

3. Done. The next build automatically ships release-signed APKs
   (`-release.apk` in the filename; the workflow logs say "release-signed").

**⚠️ Migration warning (one-time):** users who installed a previous
debug-signed APK must **uninstall and reinstall once** after the switch —
Android refuses cross-signature updates. Announce it (broadcast/push) when
you flip. After that one hop, updates are seamless.

## 4. The antivirus "Virus detected" incident (PracticePro-v1.0.789)

That was a **false positive**, not an infection: Windows Defender's
machine-learning detector (`!ml`) flagged the minified JS bundles inside
your own APK — a known false-positive family (it has flagged GitHub's own
CLI and EV-signed commercial apps). New file hashes + zip + no reputation
made it worse. What to do:

1. **Per affected version**, submit a developer dispute:
   https://www.microsoft.com/wdsi/filesubmission → "Software developer"
   → the flagged file. Takes a few days to clear; repeat per new version
   until the pattern builds reputation.
2. **Never** upload the APK to public multi-engine scanners (VirusTotal
   etc.) — the bundle is proprietary code and public submissions are
   retrievable by anyone.
3. **Structural fix:** Google Play (internal testing first). Play installs
   bypass browser/AV warnings entirely. Requires an organisation developer
   account (D-U-N-S verification) and an AAB upload — the keystore from §3
   becomes your upload key. Direct download stays as the fallback channel.

## 5. Where everything lives (cheat sheet)

| Thing | File |
|---|---|
| Naming standard (read first) | `docs/brand-architecture.md` |
| The audit (what was wrong) | `docs/brand/BRAND_CONSISTENCY_AUDIT.md` |
| Splash end-card resolver | `src/components/splashEndCard.ts` |
| Product mark components | `src/components/marketing/brand/ProductMarks.tsx` |
| Komplete colour tokens | `src/index.css` (`--color-komplete-*`) |
| Universal APK pipeline | `.github/workflows/build-apk.yml` |
| Product APK pipeline | `.github/workflows/build-product-apks.yml` |
| Founder APK pipeline | `.github/workflows/build-admin-apk.yml` |
| Product capacitor configs | `capacitor.{vega,atrium,komplete}.config.ts` |
| Wrapper swap script | `scripts/sync-product-config.cjs` |
| Launcher icon generator | `scripts/generate-product-launcher-assets.py` |
| Per-product icon assets | `android/branding/{vega,atrium,komplete}/res/` |
| Regression pins | `tests/unit/brandClarity.test.ts` |
| Version / update manifest | `public/version.json` (written by CI) |

## 6. Known follow-ups (deliberately deferred)

- **In-app copy sweep** (onboarding, empty states, share templates): 63
  component files mention PracticePro, most legitimately (attribution,
  legal entities, storage keys). Needs per-string judgment — next round.
- **Per-product native splash colour**: the native splash stays
  company-green on every variant per your direction ("the PracticePro
  splash… I like that"); the product reveal is the in-app end-card.
- **Per-product in-app update routing**: today every install updates from
  the universal APK (`version.json.apkUrl`) — correct because all variants
  share `applicationId`, but a Vega-wrapper user who updates lands on the
  universal wrapper branding. Add `apkUrlVega` etc. when the download page
  ships.
- **Public download page** (`practicepro.ng/download`): per-product buttons
  → latest Release asset + QR code + "why does my browser warn me?" note.
- **Google Play**: org account, internal-testing track, AAB.
- **Repo rename** (`PracticeProVEGA`): out of scope, needs your explicit
  sign-off (link churn).
