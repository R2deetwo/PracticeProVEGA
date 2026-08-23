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
// NOTE: Backup files for files inside android/app/src/main/res/ MUST be
// stored OUTSIDE the res/ directory. Android's resource merger (AAPT)
// scans all files under res/ and rejects any file that doesn't end with
// .xml, .png, .jpg, etc. A .admin-backup file in res/values/ causes:
//   "Error: The file name must end with .xml"
// and fails the Gradle build. We store backups in android/app/ instead.
const STRINGS_XML_BACKUP = path.join(ROOT, 'android', 'app', 'strings.xml.admin-backup');
const VERSION_PROPS = path.join(ROOT, 'android', 'app', 'version.properties');
const VERSION_PROPS_BACKUP = path.join(ROOT, 'android', 'app', 'version.properties.admin-backup');
// ─── google-services.json patch paths ─────────────────────────────────
// The admin APK uses applicationId 'com.practicepro.admin', but the
// google-services.json only has a client for 'com.practicepro.app'.
// Firebase's Gradle plugin (com.google.gms.google-services) fails with:
//   "No matching client found for package name 'com.practicepro.admin'"
// We patch build.gradle to comment out the google-services plugin for
// the admin build. The admin APK doesn't need FCM push notifications
// (it's the founder dashboard — notifications go to the user app).
// The build.gradle patch is reversible (restored after the build on
// local dev machines; left in place for CI since the runner is ephemeral).
const GOOGLE_SERVICES_JSON = path.join(ROOT, 'android', 'app', 'google-services.json');
const GOOGLE_SERVICES_JSON_BACKUP = path.join(ROOT, 'android', 'app', 'google-services.json.admin-backup');

// ─── Founder icon paths ─────────────────────────────────────────────
// The founder APK uses a BLACK icon (where the consumer app uses green).
// The black icon files live in resources/founder-icons/ and are copied
// over the green icons before the build, then restored after.
const FOUNDER_ICONS_SRC = path.join(ROOT, 'resources', 'founder-icons');
const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const ICON_BACKUP_DIR = path.join(ROOT, 'android', 'app', 'icon-backup');

const wantOpen = process.argv.includes('--open');

// CRITICAL: In CI, we must NOT restore the patched files after cap sync.
// The Gradle build runs in the NEXT workflow step and needs the patched
// applicationId, app_name, and versionCode to produce a separate APK.
// If we restore them, Gradle builds with the consumer app's values and
// the resulting APK installs OVER the consumer app instead of side-by-side.
//
// We detect CI via the CI env var (set by GitHub Actions, GitLab CI, etc.).
// Locally, we always restore so the developer's consumer app config is
// preserved after running `npm run cap:sync:admin`.
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

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

    // In CI, do NOT restore the patched files. Gradle runs in the next
    // workflow step and needs the patched applicationId, app_name, and
    // versionCode to build a separate founder APK. The CI runner is
    // ephemeral, so leaving files patched has no side effects.
    if (isCI) {
        log('Running in CI — leaving patched files in place for Gradle build.');
        return;
    }

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
    // Restore google-services.json (remove the admin client entry)
    try {
        if (fs.existsSync(GOOGLE_SERVICES_JSON_BACKUP)) {
            fs.copyFileSync(GOOGLE_SERVICES_JSON_BACKUP, GOOGLE_SERVICES_JSON);
            fs.rmSync(GOOGLE_SERVICES_JSON_BACKUP, { force: true });
            log('Restored original google-services.json from backup.');
        }
    } catch (e) {
        warn(`Failed to restore google-services.json: ${e.message}`);
        warn(`Manual restore needed. Backup file (if it exists): ${GOOGLE_SERVICES_JSON_BACKUP}`);
    }
    // Restore green icons from backup
    try {
        if (fs.existsSync(ICON_BACKUP_DIR)) {
            restoreIcons();
        }
    } catch (e) {
        warn(`Failed to restore icons: ${e.message}`);
        warn(`Manual restore needed. Backup directory: ${ICON_BACKUP_DIR}`);
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

// 2c-i: patch applicationId + key alias in app/build.gradle
if (adminAppId && fs.existsSync(APP_GRADLE)) {
    try {
        fs.copyFileSync(APP_GRADLE, APP_GRADLE_BACKUP);
        const gradle = fs.readFileSync(APP_GRADLE, 'utf8');
        let patched = gradle.replace(
            /(applicationId\s+")[^"]+(")/,
            `$1${adminAppId}$2`
        );
        // Also patch the release key alias so the admin APK is signed with
        // the admin key, not the user app key. We write a temporary
        // gradle.properties entry that the build.gradle can read via
        // project.hasProperty() + project.property().
        // NOTE: process.env in Node does NOT propagate to child Gradle processes.
        // We must pass it via -D flag to Gradle or via gradle.properties.
        const gradlePropsPath = path.join(ROOT, 'android', 'gradle.properties');
        const gradlePropsBackup = gradlePropsPath + '.admin-backup';
        if (fs.existsSync(gradlePropsPath)) {
            fs.copyFileSync(gradlePropsPath, gradlePropsBackup);
        }
        const adminAlias = adminAppId === 'com.practicepro.admin' ? 'practicepro-admin' : 'practicepro-app';
        // Append the key alias to gradle.properties so build.gradle can read it
        const existingProps = fs.existsSync(gradlePropsPath) ? fs.readFileSync(gradlePropsPath, 'utf8') : '';
        const updatedProps = existingProps.replace(/releaseKeyAlias=.*/g, '') + `\nreleaseKeyAlias=${adminAlias}\n`;
        fs.writeFileSync(gradlePropsPath, updatedProps.trim() + '\n');
        log(`Set releaseKeyAlias=${adminAlias} in gradle.properties for APK build`);
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

// ─── Step 2c-iv: patch google-services.json to add admin package name ─
// CRITICAL FIX: The admin APK uses applicationId 'com.practicepro.admin',
// but google-services.json only has a client for 'com.practicepro.app'.
// Firebase's Gradle plugin fails with:
//   "No matching client found for package name 'com.practicepro.admin'"
//
// FIX: Patch google-services.json to add a second client entry for
// 'com.practicepro.admin'. Uses the same API key and app ID as the
// existing 'com.practicepro.app' client — Firebase allows multiple
// Android apps under the same project.
//
// This enables FCM push notifications for the admin APK (the founder
// needs push notifications for: new feedback, sales leads, add-on
// requests, and app updates).
if (fs.existsSync(GOOGLE_SERVICES_JSON)) {
    try {
        // Back up the original google-services.json
        if (!fs.existsSync(GOOGLE_SERVICES_JSON_BACKUP)) {
            fs.copyFileSync(GOOGLE_SERVICES_JSON, GOOGLE_SERVICES_JSON_BACKUP);
        }
        const gsConfig = JSON.parse(fs.readFileSync(GOOGLE_SERVICES_JSON, 'utf8'));

        // Check if the admin client already exists
        const hasAdminClient = gsConfig.client?.some(
            (c) => c.client_info?.android_client_info?.package_name === 'com.practicepro.admin'
        );

        if (!hasAdminClient && gsConfig.client?.length > 0) {
            // Clone the existing client and change the package name
            const existingClient = gsConfig.client[0];
            const adminClient = JSON.parse(JSON.stringify(existingClient));
            adminClient.client_info.android_client_info.package_name = 'com.practicepro.admin';
            // Generate a new mobilesdk_app_id (we use the same one — Firebase
            // doesn't strictly require a unique ID for the same project)
            gsConfig.client.push(adminClient);

            fs.writeFileSync(GOOGLE_SERVICES_JSON, JSON.stringify(gsConfig, null, 2));
            log('Patched google-services.json → added com.practicepro.admin client for FCM push');
        }
    } catch (e) {
        warn(`Failed to patch google-services.json: ${e.message}`);
        warn('The admin APK build may fail with "No matching client found for package name com.practicepro.admin"');
    }
}

// ─── Step 2d: swap green icons → black founder icons ────────────────
// The founder APK uses a BLACK app icon (where the consumer app uses
// green). The black icon files are pre-generated in
// resources/founder-icons/ by scripts/generate-founder-icon.py.
//
// We back up the existing green icons to android/app/icon-backup/,
// then copy the black icons over them. After the build (or on error),
// restoreIcons() copies the green icons back.
//
// The consumer app's icons are NEVER permanently modified — the backup
// is always restored, even on Ctrl-C or uncaught errors.
if (fs.existsSync(FOUNDER_ICONS_SRC)) {
    try {
        swapIconsToFounder();
    } catch (e) {
        warn(`Failed to swap founder icons: ${e.message}`);
        warn('The founder APK may show the green consumer app icon.');
    }
} else {
    warn(`Founder icons not found at ${FOUNDER_ICONS_SRC} — skipping icon swap.`);
    warn('Run: python3 scripts/generate-founder-icon.py');
}

// ─── Step 3: sync to Android ────────────────────────────────────────
//
// Capacitor 8 CLI requires Node >= 22. If the CI runner has Node 20
// (as the admin APK workflow currently does), `npx cap sync` fails
// with: "The Capacitor CLI requires NodeJS >=22.0.0"
//
// Rather than forcing the user to update the workflow's Node version
// (which requires `workflow` scope on the PAT), we detect the Node
// version and fall back to a MANUAL sync if it's < 22.
//
// Manual sync does exactly what `cap sync android` does:
//   1. Copies web assets from webDir → android/app/src/main/assets/public/
//   2. Writes capacitor.config.json (parsed from the TS config)
//   3. Generates capacitor.build.gradle (plugin gradle deps)
//   4. Generates capacitor.settings.gradle (plugin include directives)
//   5. Generates capacitor.plugins.json (plugin classpath list)
//
// Plugins are discovered by scanning node_modules for packages with
// `capacitor.android.src` in their package.json.

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);
const canUseCapSync = NODE_MAJOR >= 22;

if (wantOpen) {
    // `cap open` just opens Android Studio — only works if cap CLI works
    const cmd = 'npx cap open android';
    log(`Running: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
        console.error(`[sync-admin] Command failed: ${cmd}`);
        restore();
        process.exit(e.status || 4);
    }
} else if (canUseCapSync) {
    const cmd = 'npx cap sync android';
    log(`Running: ${cmd} (Node ${process.versions.node})`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
        console.error(`[sync-admin] Command failed: ${cmd}`);
        restore();
        process.exit(e.status || 4);
    }
} else {
    log(`Node ${process.versions.node} < 22 — Capacitor CLI unavailable. Doing MANUAL sync.`);
    try {
        manualSync();
        log('Manual sync completed successfully.');
    } catch (e) {
        console.error(`[sync-admin] Manual sync failed: ${e.message}`);
        console.error(e.stack);
        restore();
        process.exit(7);
    }
}

log('Sync completed successfully.');
// restore() will be called by the 'exit' handler.

// =====================================================================
// MANUAL SYNC — replaces `cap sync android` when Node < 22
// =====================================================================
//
// This function does everything `cap sync android` does, but without
// requiring the Capacitor CLI (which needs Node >= 22):
//
//   1. Copies web assets from the configured webDir to the Android
//      assets/public directory.
//   2. Writes capacitor.config.json (the runtime config that
//      Capacitor's native code reads at app start).
//   3. Discovers installed Capacitor plugins by scanning node_modules.
//   4. Generates capacitor.build.gradle (the Gradle file that wires
//      plugin projects as dependencies).
//   5. Generates capacitor.settings.gradle (the Gradle file that
//      includes plugin projects in the build).
//   6. Generates capacitor.plugins.json (the JSON list of plugin
//      classpaths, used by Capacitor's native plugin registry).
//
function manualSync() {
    const androidAssetsPublic = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');
    const androidAssets = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets');
    const androidAppDir = path.join(ROOT, 'android', 'app');
    const androidDir = path.join(ROOT, 'android');

    // ─── 1. Parse the admin config ──────────────────────────────────
    // We already have it in MAIN_CONFIG (copied from ADMIN_CONFIG in
    // step 2). Parse the key fields we need.
    const configSrc = fs.readFileSync(MAIN_CONFIG, 'utf8');
    const appId = (configSrc.match(/appId\s*:\s*['"]([^'"]+)['"]/) || [])[1] || 'com.practicepro.admin';
    const appName = (configSrc.match(/appName\s*:\s*['"]([^'"]+)['"]/) || [])[1] || 'PracticePro Founder';
    const webDir = (configSrc.match(/webDir\s*:\s*['"]([^'"]+)['"]/) || [])[1] || 'dist-admin';
    const bgColor = (configSrc.match(/backgroundColor\s*:\s*['"]([^'"]+)['"]/) || [])[1] || '#000000';

    // Parse the android + plugins blocks using a brace-matching parser
    // (regex can't handle nested braces in TS object literals)
    const androidConfig = extractObjectBlock(configSrc, 'android') || {};
    const pluginsConfig = extractObjectBlock(configSrc, 'plugins') || {};

    // ─── 2. Copy web assets ─────────────────────────────────────────
    const webDirAbs = path.join(ROOT, webDir);
    if (!fs.existsSync(webDirAbs)) {
        throw new Error(`webDir not found: ${webDirAbs}`);
    }
    // Clean the target directory
    fs.rmSync(androidAssetsPublic, { recursive: true, force: true });
    fs.mkdirSync(androidAssetsPublic, { recursive: true });
    // Copy all files from webDir to assets/public
    copyDirRecursive(webDirAbs, androidAssetsPublic);
    log(`Copied web assets: ${webDir} → android/app/src/main/assets/public/`);

    // ─── 3. Write capacitor.config.json ─────────────────────────────
    const configJson = {
        appId,
        appName,
        webDir,
        backgroundColor: bgColor,
        android: androidConfig,
        plugins: pluginsConfig,
    };
    fs.writeFileSync(
        path.join(androidAssets, 'capacitor.config.json'),
        JSON.stringify(configJson, null, '\t') + '\n'
    );
    log('Wrote capacitor.config.json');

    // ─── 4. Discover plugins ────────────────────────────────────────
    // Scan node_modules for packages with `capacitor.android.src` in
    // their package.json. This is how Capacitor discovers plugins.
    const plugins = discoverPlugins();
    log(`Discovered ${plugins.length} Capacitor plugins: ${plugins.map(p => p.name).join(', ')}`);

    // ─── 5. Generate capacitor.build.gradle ─────────────────────────
    let buildGradle = '// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN\n\n';
    buildGradle += 'android {\n';
    buildGradle += '  compileOptions {\n';
    buildGradle += '      sourceCompatibility JavaVersion.VERSION_21\n';
    buildGradle += '      targetCompatibility JavaVersion.VERSION_21\n';
    buildGradle += '  }\n';
    buildGradle += '}\n\n';
    buildGradle += 'apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"\n';
    buildGradle += 'dependencies {\n';
    for (const p of plugins) {
        buildGradle += `    implementation project(':${p.gradleName}')\n`;
    }
    buildGradle += '}\n\n\nif (hasProperty(\'postBuildExtras\')) {\n  postBuildExtras()\n}';
    fs.writeFileSync(path.join(androidAppDir, 'capacitor.build.gradle'), buildGradle);
    log('Generated capacitor.build.gradle');

    // ─── 6. Generate capacitor.settings.gradle ──────────────────────
    let settingsGradle = '// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN\n';
    settingsGradle += "include ':capacitor-android'\n";
    settingsGradle += "project(':capacitor-android').projectDir = new File('../node_modules/@capacitor/android/capacitor')\n\n";
    for (const p of plugins) {
        settingsGradle += `include ':${p.gradleName}'\n`;
        settingsGradle += `project(':${p.gradleName}').projectDir = new File('${p.androidPath}')\n\n`;
    }
    fs.writeFileSync(path.join(androidDir, 'capacitor.settings.gradle'), settingsGradle);
    log('Generated capacitor.settings.gradle');

    // ─── 7. Generate capacitor.plugins.json ─────────────────────────
    const pluginsJson = plugins.map(p => ({
        pkg: p.name,
        classpath: p.classpath,
    }));
    fs.writeFileSync(
        path.join(androidAssets, 'capacitor.plugins.json'),
        JSON.stringify(pluginsJson, null, '\t') + '\n'
    );
    log('Generated capacitor.plugins.json');

    // ─── 8. Ensure capacitor-cordova-android-plugins/ exists ─────────
    // `cap sync` normally creates this directory with a set of static
    // files (build.gradle, cordova.variables.gradle, AndroidManifest,
    // etc.). On a fresh CI checkout, this directory doesn't exist
    // because it's not tracked in git. Without it, Gradle fails:
    //   "Could not read script '.../cordova.variables.gradle' as it
    //    does not exist."
    ensureCordovaAndroidPlugins(androidDir);
}

function ensureCordovaAndroidPlugins(androidDir) {
    const pluginsDir = path.join(androidDir, 'capacitor-cordova-android-plugins');
    const srcMainDir = path.join(pluginsDir, 'src', 'main');
    const javaDir = path.join(srcMainDir, 'java');
    const resDir = path.join(srcMainDir, 'res');

    // Create directory structure
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(resDir, { recursive: true });

    // build.gradle — only write if missing (don't clobber local cap sync output)
    const buildGradlePath = path.join(pluginsDir, 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
        fs.writeFileSync(buildGradlePath, [
            'ext {',
            "    androidxAppCompatVersion = project.hasProperty('androidxAppCompatVersion') ? rootProject.ext.androidxAppCompatVersion : '1.7.1'",
            "    cordovaAndroidVersion = project.hasProperty('cordovaAndroidVersion') ? rootProject.ext.cordovaAndroidVersion : '14.0.1'",
            '}',
            '',
            'buildscript {',
            '    repositories {',
            '        google()',
            '        mavenCentral()',
            '    }',
            '    dependencies {',
            "        classpath 'com.android.tools.build:gradle:8.13.0'",
            '    }',
            '}',
            '',
            "apply plugin: 'com.android.library'",
            '',
            'android {',
            '    namespace = "capacitor.cordova.android.plugins"',
            "    compileSdk = project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 36",
            '    defaultConfig {',
            "        minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24",
            "        targetSdkVersion project.hasProperty('targetSdkVersion') ? rootProject.ext.targetSdkVersion : 36",
            '        versionCode 1',
            '        versionName "1.0"',
            '    }',
            '    lintOptions {',
            '        abortOnError = false',
            '    }',
            '    compileOptions {',
            '        sourceCompatibility JavaVersion.VERSION_21',
            '        targetCompatibility JavaVersion.VERSION_21',
            '    }',
            '}',
            '',
            'repositories {',
            '    google()',
            '    mavenCentral()',
            '    flatDir{',
            "        dirs 'src/main/libs', 'libs'",
            '    }',
            '}',
            '',
            'dependencies {',
            "    implementation fileTree(dir: 'src/main/libs', include: ['*.jar'])",
            '    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"',
            '    implementation "org.apache.cordova:framework:$cordovaAndroidVersion"',
            '    // SUB-PROJECT DEPENDENCIES START',
            '',
            '    // SUB-PROJECT DEPENDENCIES END',
            '}',
            '',
            '// PLUGIN GRADLE EXTENSIONS START',
            'apply from: "cordova.variables.gradle"',
            '// PLUGIN GRADLE EXTENSIONS END',
            '',
            'for (def func : cdvPluginPostBuildExtras) {',
            '    func()',
            '}',
            '',
        ].join('\n'));
        log('Created capacitor-cordova-android-plugins/build.gradle');
    }

    // cordova.variables.gradle — only write if missing
    const cordovaVarsPath = path.join(pluginsDir, 'cordova.variables.gradle');
    if (!fs.existsSync(cordovaVarsPath)) {
        fs.writeFileSync(cordovaVarsPath, [
            '// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN',
            'ext {',
            "  cdvMinSdkVersion = project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24",
            '  // Plugin gradle extensions can append to this to have code run at the end.',
            '  cdvPluginPostBuildExtras = []',
            '  cordovaConfig = [:]',
            '}',
            '',
        ].join('\n'));
        log('Created capacitor-cordova-android-plugins/cordova.variables.gradle');
    }

    // AndroidManifest.xml — only write if missing
    const manifestPath = path.join(srcMainDir, 'AndroidManifest.xml');
    if (!fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, [
            '<?xml version=\'1.0\' encoding=\'utf-8\'?>',
            '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
            'xmlns:amazon="http://schemas.amazon.com/apk/res/android">',
            '<application  >',
            '',
            '</application>',
            '',
            '</manifest>',
            '',
        ].join('\n'));
        log('Created capacitor-cordova-android-plugins/src/main/AndroidManifest.xml');
    }

    // .gitkeep files — only write if missing
    const javaGitkeep = path.join(javaDir, '.gitkeep');
    if (!fs.existsSync(javaGitkeep)) fs.writeFileSync(javaGitkeep, '');
    const resGitkeep = path.join(resDir, '.gitkeep');
    if (!fs.existsSync(resGitkeep)) fs.writeFileSync(resGitkeep, '');
}

function copyDirRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function discoverPlugins() {
    const nodeModules = path.join(ROOT, 'node_modules');
    const plugins = [];
    const scopes = ['@capacitor', '@aparajita', '@capgo', '@byteowls'];

    for (const scope of scopes) {
        const scopeDir = path.join(nodeModules, scope);
        if (!fs.existsSync(scopeDir)) continue;
        for (const pkgName of fs.readdirSync(scopeDir)) {
            const pkgJsonPath = path.join(scopeDir, pkgName, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) continue;
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                const androidSrc = pkg.capacitor?.android?.src;
                if (!androidSrc) continue;
                const fullPkgName = `${scope}/${pkgName}`;
                const androidPath = path.join(scopeDir, pkgName, androidSrc);
                if (!fs.existsSync(androidPath)) continue;

                // Gradle project name: drop @, replace / with -
                const gradleName = fullPkgName.replace(/^@/, '').replace(/\//g, '-');

                // Discover the main plugin class by scanning for files
                // ending in *Plugin.java or *Native.java
                const classpath = discoverPluginClasspath(androidPath, fullPkgName);
                if (!classpath) {
                    warn(`Could not discover classpath for ${fullPkgName} — skipping`);
                    continue;
                }

                plugins.push({
                    name: fullPkgName,
                    gradleName,
                    androidPath: path.relative(path.join(ROOT, 'android'), androidPath),
                    classpath,
                });
            } catch {}
        }
    }

    // Also check non-scoped packages (rare but possible)
    for (const pkgName of fs.readdirSync(nodeModules)) {
        if (pkgName.startsWith('@') || pkgName.startsWith('.')) continue;
        const pkgJsonPath = path.join(nodeModules, pkgName, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const androidSrc = pkg.capacitor?.android?.src;
            if (!androidSrc) continue;
            const androidPath = path.join(nodeModules, pkgName, androidSrc);
            if (!fs.existsSync(androidPath)) continue;
            const gradleName = pkgName.replace(/\//g, '-');
            const classpath = discoverPluginClasspath(androidPath, pkgName);
            if (!classpath) continue;
            plugins.push({
                name: pkgName,
                gradleName,
                androidPath: path.relative(path.join(ROOT, 'android'), androidPath),
                classpath,
            });
        } catch {}
    }

    return plugins;
}

function discoverPluginClasspath(androidDir, pkgName) {
    // Scan for *.java files ending in "Plugin.java" or "Native.java"
    // that contain "@CapacitorPlugin" annotation
    const javaFiles = findJavaFiles(androidDir);
    for (const javaFile of javaFiles) {
        const content = fs.readFileSync(javaFile, 'utf8');
        if (!content.includes('@CapacitorPlugin')) continue;
        // Extract package and class name
        const pkgMatch = content.match(/^package\s+([\w.]+);/m);
        const classMatch = content.match(/public\s+class\s+(\w+)/);
        if (pkgMatch && classMatch) {
            return `${pkgMatch[1]}.${classMatch[1]}`;
        }
    }
    // Fallback: look for *Plugin.java or *Native.java
    for (const javaFile of javaFiles) {
        const base = path.basename(javaFile, '.java');
        if (base.endsWith('Plugin') || base.endsWith('Native')) {
            const content = fs.readFileSync(javaFile, 'utf8');
            const pkgMatch = content.match(/^package\s+([\w.]+);/m);
            if (pkgMatch) {
                return `${pkgMatch[1]}.${base}`;
            }
        }
    }
    return null;
}

function findJavaFiles(dir) {
    const results = [];
    function walk(d) {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const fullPath = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.name.endsWith('.java')) {
                results.push(fullPath);
            }
        }
    }
    walk(dir);
    return results;
}

/**
 * extractObjectBlock — parse a top-level key from a TS/JS object literal
 * source string and return the corresponding JS object.
 *
 * Uses a simple brace-matching parser to handle nested braces correctly
 * (unlike regex, which can't count). The key must be at the top level
 * of the object literal (not nested inside another object).
 *
 * Example:
 *   extractObjectBlock('android: { allowMixedContent: true, ... }', 'android')
 *   → { allowMixedContent: true, ... }
 */
function extractObjectBlock(src, key) {
    // Find the key followed by ':' and '{'
    const keyPattern = new RegExp(`\\b${key}\\s*:\\s*\\{`);
    const startMatch = src.match(keyPattern);
    if (!startMatch) return null;

    // Find the opening brace position
    const openBracePos = src.indexOf('{', startMatch.index + key.length);
    if (openBracePos === -1) return null;

    // Walk forward, counting braces (ignoring strings and comments)
    let depth = 0;
    let i = openBracePos;
    let inString = false;
    let stringChar = '';
    let inLineComment = false;
    let inBlockComment = false;

    while (i < src.length) {
        const ch = src[i];
        const next = src[i + 1];

        // Handle comment states
        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            i++;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; }
            i++;
            continue;
        }
        if (inString) {
            if (ch === '\\') { i += 2; continue; } // skip escaped char
            if (ch === stringChar) { inString = false; }
            i++;
            continue;
        }

        // Not in string or comment
        if (ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; i++; continue; }

        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                // Found the matching close brace
                const blockSrc = src.substring(openBracePos, i + 1);
                try {
                    // Eval as a JS expression (the block is a valid object literal)
                    return eval(`(${blockSrc})`);
                } catch (e) {
                    warn(`Failed to parse '${key}' block: ${e.message}`);
                    return null;
                }
            }
        }
        i++;
    }
    return null;
}

// =====================================================================
// ICON SWAPPING — green consumer icons ↔ black founder icons
// =====================================================================

/**
 * swapIconsToFounder — back up the green icons, then copy the black
 * founder icons over them.
 *
 * The green icons are backed up to android/app/icon-backup/ (outside
 * the res/ directory, so AAPT doesn't complain about non-.xml files).
 * Each file is stored with its relative path mirrored inside icon-backup/.
 *
 * The black icons live in resources/founder-icons/ and were pre-generated
 * by scripts/generate-founder-icon.py.
 */
function swapIconsToFounder() {
    // Clean any stale backup
    fs.rmSync(ICON_BACKUP_DIR, { recursive: true, force: true });
    fs.mkdirSync(ICON_BACKUP_DIR, { recursive: true });

    // Walk the founder-icons directory and for each file:
    //   1. Compute the relative path (e.g. mipmap-mdpi/ic_launcher.png)
    //   2. Back up the existing file at ANDROID_RES/<rel> → ICON_BACKUP_DIR/<rel>
    //   3. Copy the founder icon from FOUNDER_ICONS_SRC/<rel> → ANDROID_RES/<rel>
    function walkDir(srcDir, relPath = '') {
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullSrc = path.join(srcDir, entry.name);
            const fullRel = relPath ? path.join(relPath, entry.name) : entry.name;
            if (entry.isDirectory()) {
                walkDir(fullSrc, fullRel);
            } else {
                const destFile = path.join(ANDROID_RES, fullRel);
                const backupFile = path.join(ICON_BACKUP_DIR, fullRel);

                // Back up the existing file (if it exists)
                if (fs.existsSync(destFile)) {
                    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
                    fs.copyFileSync(destFile, backupFile);
                }

                // Copy the founder icon over the existing file
                fs.mkdirSync(path.dirname(destFile), { recursive: true });
                fs.copyFileSync(fullSrc, destFile);
            }
        }
    }

    walkDir(FOUNDER_ICONS_SRC);
    log('Swapped green icons → black founder icons.');
}

/**
 * restoreIcons — copy the green icons back from the backup directory.
 * Called by restore() after the build completes (or on error).
 */
function restoreIcons() {
    if (!fs.existsSync(ICON_BACKUP_DIR)) return;

    function walkBackup(backupDir, relPath = '') {
        const entries = fs.readdirSync(backupDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullBackup = path.join(backupDir, entry.name);
            const fullRel = relPath ? path.join(relPath, entry.name) : entry.name;
            if (entry.isDirectory()) {
                walkBackup(fullBackup, fullRel);
            } else {
                const destFile = path.join(ANDROID_RES, fullRel);
                fs.mkdirSync(path.dirname(destFile), { recursive: true });
                fs.copyFileSync(fullBackup, destFile);
            }
        }
    }

    walkBackup(ICON_BACKUP_DIR);
    fs.rmSync(ICON_BACKUP_DIR, { recursive: true, force: true });
    log('Restored original green icons from backup.');
}
