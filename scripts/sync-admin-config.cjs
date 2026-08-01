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
