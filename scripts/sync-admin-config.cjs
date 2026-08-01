#!/usr/bin/env node
/**
 * sync-admin-config.cjs
 *
 * Workaround for Capacitor 8 CLI: the `cap` command no longer supports
 * a `--config` flag, so there is no built-in way to sync the Android
 * project using `capacitor.admin.config.ts` instead of the default
 * `capacitor.config.ts`.
 *
 * This script does the swap atomically:
 *   1. Backs up the existing `capacitor.config.ts` (if any) to
 *      `capacitor.config.ts.admin-backup`.
 *   2. Copies `capacitor.admin.config.ts` → `capacitor.config.ts`.
 *   3. Runs `npx cap sync android` (or `cap open android` if --open is
 *      passed).
 *   4. Restores the original `capacitor.config.ts` from the backup,
 *      EVEN IF step 3 fails — so the consumer app's config is never
 *      left clobbered.
 *
 * Usage:
 *   node scripts/sync-admin-config.cjs            # cap sync android
 *   node scripts/sync-admin-config.cjs --open     # cap open android
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MAIN_CONFIG = path.join(ROOT, 'capacitor.config.ts');
const ADMIN_CONFIG = path.join(ROOT, 'capacitor.admin.config.ts');
const BACKUP = path.join(ROOT, 'capacitor.config.ts.admin-backup');
const APP_GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');
const APP_GRADLE_BACKUP = path.join(ROOT, 'android', 'app', 'build.gradle.admin-backup');
const STRINGS_XML = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const STRINGS_XML_BACKUP = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml.admin-backup');
const VERSION_PROPS = path.join(ROOT, 'android', 'app', 'version.properties');
const VERSION_PROPS_BACKUP = path.join(ROOT, 'android', 'app', 'version.properties.admin-backup');

const wantOpen = process.argv.includes('--open');

// Read the appId and appName out of capacitor.admin.config.ts so we can
// patch android/app/build.gradle and strings.xml to match. Capacitor's
// `cap sync` step does NOT update applicationId, app_name, package_name,
// or custom_url_scheme — only `cap add` does. Without these patches,
// the admin APK would install over the consumer app (same appId) AND
// show up on the home screen as 'PracticePro' (same app name).
function readAdminConfig() {
    const src = fs.readFileSync(ADMIN_CONFIG, 'utf8');
    const appIdMatch = src.match(/appId\s*:\s*['"]([^'"]+)['"]/);
    const appNameMatch = src.match(/appName\s*:\s*['"]([^'"]+)['"]/);
    return {
        appId: appIdMatch ? appIdMatch[1] : null,
        appName: appNameMatch ? appNameMatch[1] : null,
    };
}

function log(msg) { console.log(`[sync-admin] ${msg}`); }
function warn(msg) { console.warn(`[sync-admin] WARN: ${msg}`); }

if (!fs.existsSync(ADMIN_CONFIG)) {
    console.error(`[sync-admin] FATAL: admin config not found at ${ADMIN_CONFIG}`);
    process.exit(2);
}

let restored = false;
function restore() {
    if (restored) return;
    restored = true;
    try {
        if (fs.existsSync(BACKUP)) {
            // Restore the original consumer config
            fs.copyFileSync(BACKUP, MAIN_CONFIG);
            fs.rmSync(BACKUP, { force: true });
            log('Restored original capacitor.config.ts from backup.');
        } else if (fs.existsSync(MAIN_CONFIG)) {
            // No backup means we created the file ourselves — remove it
            // so we don't leave a stale admin-as-main config around.
            // But ONLY do this if the current file is identical to the
            // admin config (i.e., we put it there).
            const cur = fs.readFileSync(MAIN_CONFIG, 'utf8');
            const adm = fs.readFileSync(ADMIN_CONFIG, 'utf8');
            if (cur === adm) {
                fs.rmSync(MAIN_CONFIG, { force: true });
                log('Removed temporary capacitor.config.ts (no original to restore).');
            }
        }
    } catch (e) {
        warn(`Failed to restore capacitor.config.ts: ${e.message}`);
        warn(`Manual restore needed. Backup file (if it exists): ${BACKUP}`);
    }
    // Restore android/app/build.gradle applicationId
    try {
        if (fs.existsSync(APP_GRADLE_BACKUP)) {
            fs.copyFileSync(APP_GRADLE_BACKUP, APP_GRADLE);
            fs.rmSync(APP_GRADLE_BACKUP, { force: true });
            log('Restored original android/app/build.gradle from backup.');
        }
    } catch (e) {
        warn(`Failed to restore android/app/build.gradle: ${e.message}`);
        warn(`Manual restore needed. Backup file (if it exists): ${APP_GRADLE_BACKUP}`);
    }
    // Restore android/app/src/main/res/values/strings.xml
    try {
        if (fs.existsSync(STRINGS_XML_BACKUP)) {
            fs.copyFileSync(STRINGS_XML_BACKUP, STRINGS_XML);
            fs.rmSync(STRINGS_XML_BACKUP, { force: true });
            log('Restored original android/app/src/main/res/values/strings.xml from backup.');
        }
    } catch (e) {
        warn(`Failed to restore strings.xml: ${e.message}`);
        warn(`Manual restore needed. Backup file (if it exists): ${STRINGS_XML_BACKUP}`);
    }
    // Restore android/app/version.properties
    try {
        if (fs.existsSync(VERSION_PROPS_BACKUP)) {
            fs.copyFileSync(VERSION_PROPS_BACKUP, VERSION_PROPS);
            fs.rmSync(VERSION_PROPS_BACKUP, { force: true });
            log('Restored original android/app/version.properties from backup.');
        }
    } catch (e) {
        warn(`Failed to restore version.properties: ${e.message}`);
        warn(`Manual restore needed. Backup file (if it exists): ${VERSION_PROPS_BACKUP}`);
    }
}

// Make sure we ALWAYS restore, even on Ctrl-C or uncaught errors.
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });
process.on('exit', restore);
process.on('uncaughtException', (e) => {
    console.error('[sync-admin] Uncaught exception:', e);
    restore();
    process.exit(1);
});

// ─── Step 1: backup existing main config ────────────────────────────
const hadMain = fs.existsSync(MAIN_CONFIG);
if (hadMain) {
    fs.copyFileSync(MAIN_CONFIG, BACKUP);
    log(`Backed up existing capacitor.config.ts → ${path.basename(BACKUP)}`);
} else {
    log('No existing capacitor.config.ts — will create from admin config.');
}

// ─── Step 2: copy admin config → main config ────────────────────────
try {
    fs.copyFileSync(ADMIN_CONFIG, MAIN_CONFIG);
    log('Installed admin config as capacitor.config.ts.');
} catch (e) {
    console.error(`[sync-admin] FATAL: could not copy admin config: ${e.message}`);
    restore();
    process.exit(3);
}

// ─── Step 2b: ensure dist-admin/index.html exists ───────────────────
// Capacitor's CLI hard-codes the requirement that the webDir contains
// `index.html`. Our admin build (vite.admin.config.ts) emits `admin.html`
// instead, because that's the Vite entry name we configured. We don't
// want to rename the entry (it's referenced by the workflow), so we
// just copy admin.html → index.html here as a compatibility shim.
// The two files are byte-identical, so it doesn't matter which one
// Capacitor loads at runtime.
const distAdmin = path.join(ROOT, 'dist-admin');
const adminHtml = path.join(distAdmin, 'admin.html');
const indexHtmlShim = path.join(distAdmin, 'index.html');
if (!fs.existsSync(adminHtml)) {
    console.error(`[sync-admin] FATAL: ${adminHtml} not found. Run \`npm run build:admin\` first.`);
    restore();
    process.exit(5);
}
try {
    fs.copyFileSync(adminHtml, indexHtmlShim);
    log('Copied admin.html → index.html (Capacitor requires index.html).');
} catch (e) {
    console.error(`[sync-admin] FATAL: could not create index.html shim: ${e.message}`);
    restore();
    process.exit(6);
}

// ─── Step 2c: patch applicationId + strings.xml ───────────────────
// `cap sync` does NOT update applicationId, app_name, package_name,
// or custom_url_scheme — only `cap add` does. Without these patches,
// the admin APK would install over the consumer app (same appId) AND
// show up on the home screen as 'PracticePro' (same app name).
const { appId: adminAppId, appName: adminAppName } = readAdminConfig();

// 2c-i: patch applicationId in app/build.gradle
if (adminAppId && fs.existsSync(APP_GRADLE)) {
    try {
        fs.copyFileSync(APP_GRADLE, APP_GRADLE_BACKUP);
        const gradle = fs.readFileSync(APP_GRADLE, 'utf8');
        const patched = gradle.replace(
            /(applicationId\s+")[^"]+(")/,
            `$1${adminAppId}$2`
        );
        if (patched !== gradle) {
            fs.writeFileSync(APP_GRADLE, patched);
            log(`Patched applicationId in app/build.gradle → ${adminAppId}`);
        } else {
            warn(`Could not find applicationId line in app/build.gradle — leaving as-is.`);
            fs.rmSync(APP_GRADLE_BACKUP, { force: true });
        }
    } catch (e) {
        warn(`Failed to patch applicationId: ${e.message}`);
        warn('The admin APK may install over the consumer app.');
        try { fs.rmSync(APP_GRADLE_BACKUP, { force: true }); } catch {}
    }
} else if (!adminAppId) {
    warn('Could not parse appId from capacitor.admin.config.ts — applicationId not patched.');
}

// 2c-ii: patch strings.xml (app_name, title_activity_main, package_name, custom_url_scheme)
if (fs.existsSync(STRINGS_XML)) {
    try {
        fs.copyFileSync(STRINGS_XML, STRINGS_XML_BACKUP);
        let stringsXml = fs.readFileSync(STRINGS_XML, 'utf8');
        let changed = false;
        if (adminAppName) {
            stringsXml = stringsXml.replace(
                /(<string name="app_name">)[^<]*(<\/string>)/,
                `$1${adminAppName}$2`
            );
            stringsXml = stringsXml.replace(
                /(<string name="title_activity_main">)[^<]*(<\/string>)/,
                `$1${adminAppName}$2`
            );
            changed = true;
        }
        if (adminAppId) {
            stringsXml = stringsXml.replace(
                /(<string name="package_name">)[^<]*(<\/string>)/,
                `$1${adminAppId}$2`
            );
            stringsXml = stringsXml.replace(
                /(<string name="custom_url_scheme">)[^<]*(<\/string>)/,
                `$1${adminAppId}$2`
            );
            changed = true;
        }
        if (changed) {
            fs.writeFileSync(STRINGS_XML, stringsXml);
            log(`Patched strings.xml → app_name='${adminAppName}', package='${adminAppId}'`);
        } else {
            fs.rmSync(STRINGS_XML_BACKUP, { force: true });
        }
    } catch (e) {
        warn(`Failed to patch strings.xml: ${e.message}`);
        warn('The admin APK may show as "PracticePro" on the home screen.');
        try { fs.rmSync(STRINGS_XML_BACKUP, { force: true }); } catch {}
    }
}

// ─── Step 2c-iii: patch version.properties ──────────────────────────
// The founder APK and the consumer APK share the same Android project,
// so they share android/app/version.properties. If we don't patch it,
// both APKs end up with the SAME versionCode — which means:
//   (a) Android's installer treats them as the same app, so installing
//       the founder APK prompts "Update PracticePro?" instead of
//       installing side-by-side.
//   (b) The consumer useApkVersionCheck hook (which we don't import in
//       the founder app, but Android's installer doesn't know that)
//       would compare the founder APK's versionCode against the
//       consumer version.json and prompt an update.
//
// We push the founder APK into a separate versionCode range:
//   - Consumer: 1.0.x → versionCode 10000 + 0*100 + x = 10000..10099
//   - Founder:  we bump MINOR to 99 and reset PATCH to 1, giving
//               versionCode 10000 + 99*100 + 1 = 19901, which is
//               permanently HIGHER than the consumer's range. This
//               means the founder APK will never be prompted to
//               "update" to a consumer APK (consumer versionCodes
//               are always < 19900). And the consumer app, when it
//               sees the founder APK's versionCode in version.json,
//               will correctly see it as older-than-local (consumer
//               app reads its OWN version.json, not the founder's).
if (fs.existsSync(VERSION_PROPS)) {
    try {
        fs.copyFileSync(VERSION_PROPS, VERSION_PROPS_BACKUP);
        let vp = fs.readFileSync(VERSION_PROPS, 'utf8');
        // Bump MINOR to 99 and reset PATCH to 1 for the founder APK.
        // This puts it in a separate versionCode range (19901+).
        vp = vp.replace(/^MINOR=.*$/m, 'MINOR=99');
        vp = vp.replace(/^PATCH=.*$/m, 'PATCH=1');
        fs.writeFileSync(VERSION_PROPS, vp);
        log('Patched version.properties → MINOR=99, PATCH=1 (founder versionCode range 19901+)');
    } catch (e) {
        warn(`Failed to patch version.properties: ${e.message}`);
        warn('The founder APK may collide with the consumer app versionCode.');
        try { fs.rmSync(VERSION_PROPS_BACKUP, { force: true }); } catch {}
    }
}

// ─── Step 3: run cap sync (or cap open) ─────────────────────────────
const cmd = wantOpen ? 'npx cap open android' : 'npx cap sync android';
log(`Running: ${cmd}`);
try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
} catch (e) {
    console.error(`[sync-admin] Command failed: ${cmd}`);
    restore();
    process.exit(e.status || 4);
}

log('cap command completed successfully.');
// restore() will be called by the 'exit' handler.
