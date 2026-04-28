#!/usr/bin/env node
/**
 * Validates the built Chrome MV3 extension at app/dist/.
 *
 * Why this exists: web-ext lint (Mozilla's tool) only knows the Firefox
 * WebExtensions schema — it errors on Chrome-only fields like
 * background.service_worker and demands gecko.id. There's no Chrome-aware
 * equivalent shipped by Google, so we validate the bits we care about
 * ourselves.
 *
 * Checks performed:
 * 1. manifest.json parses as JSON.
 * 2. manifest_version === 3.
 * 3. Required string fields present and non-empty: name, version, description.
 * 4. background.service_worker file exists in dist/.
 * 5. Every entry HTML referenced by options_page / side_panel.default_path
 *    exists in dist/.
 * 6. Every icon path in icons + action.default_icon resolves under dist/.
 * 7. Every web_accessible_resources entry resolves (globs allowed; we test
 *    by checking that at least one file matches each pattern).
 * 8. version string matches semver-ish pattern (digits + dots, no pre-release
 *    tags — Chrome Web Store rejects those).
 * 9. permissions array contains only known Chrome MV3 permissions
 *    (warn-only — new permissions get added as Chrome evolves).
 *
 * Exits 0 on success, 1 on any failure. Prints a checklist-style report.
 *
 * No fallbacks: missing files / invalid manifest = hard error.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const distDir = resolve(appDir, 'dist');
const manifestPath = resolve(distDir, 'manifest.json');

let errors = 0;
let warnings = 0;

const fail = (msg) => {
	console.error(`✘ ${msg}`);
	errors += 1;
};
const warn = (msg) => {
	console.warn(`! ${msg}`);
	warnings += 1;
};
const ok = (msg) => {
	console.log(`✓ ${msg}`);
};

// 0. dist/ exists
if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
	fail(`dist/ not found at ${distDir} — run 'npm run build' first`);
	process.exit(1);
}

// 1. manifest parses
let manifest;
try {
	manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	ok('manifest.json parses as valid JSON');
} catch (err) {
	fail(`manifest.json invalid JSON: ${err.message}`);
	process.exit(1);
}

// 2. manifest_version
if (manifest.manifest_version !== 3) {
	fail(`manifest_version must be 3 (got ${manifest.manifest_version})`);
} else {
	ok('manifest_version is 3');
}

// 3. Required fields
for (const field of ['name', 'version', 'description']) {
	if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
		fail(`manifest.${field} is missing or empty`);
	} else {
		ok(`manifest.${field} present`);
	}
}

// 4. background.service_worker
if (!manifest.background || typeof manifest.background !== 'object') {
	fail('manifest.background is missing');
} else if (typeof manifest.background.service_worker !== 'string') {
	fail('manifest.background.service_worker must be a string path (MV3)');
} else {
	const swPath = resolve(distDir, manifest.background.service_worker);
	if (!existsSync(swPath)) {
		fail(`background.service_worker file missing: ${manifest.background.service_worker}`);
	} else {
		ok(`background.service_worker → ${manifest.background.service_worker}`);
	}
}

// 5. options_page + side_panel.default_path
const htmlEntries = [];
if (manifest.options_page) htmlEntries.push(['options_page', manifest.options_page]);
if (manifest.side_panel?.default_path) {
	htmlEntries.push(['side_panel.default_path', manifest.side_panel.default_path]);
}
for (const [key, value] of htmlEntries) {
	const p = resolve(distDir, value);
	if (!existsSync(p)) {
		fail(`${key} file missing: ${value}`);
	} else {
		ok(`${key} → ${value}`);
	}
}

// 6. Icons
const iconsToCheck = new Set();
if (manifest.icons && typeof manifest.icons === 'object') {
	for (const v of Object.values(manifest.icons)) {
		if (typeof v === 'string') iconsToCheck.add(v);
	}
}
if (manifest.action?.default_icon) {
	const di = manifest.action.default_icon;
	if (typeof di === 'string') iconsToCheck.add(di);
	else if (typeof di === 'object') {
		for (const v of Object.values(di)) {
			if (typeof v === 'string') iconsToCheck.add(v);
		}
	}
}
for (const icon of iconsToCheck) {
	const p = resolve(distDir, icon);
	if (!existsSync(p)) {
		fail(`icon file missing: ${icon}`);
	}
}
if (iconsToCheck.size > 0 && errors === 0) {
	ok(`${iconsToCheck.size} icon path(s) resolved under dist/`);
}

// 7. web_accessible_resources (glob-aware)
if (Array.isArray(manifest.web_accessible_resources)) {
	for (const block of manifest.web_accessible_resources) {
		if (!Array.isArray(block.resources)) continue;
		for (const pattern of block.resources) {
			// glob accepts both literal paths and glob patterns
			const matches = await glob(pattern, { cwd: distDir, dot: false });
			if (matches.length === 0) {
				warn(`web_accessible_resources pattern matched 0 files: ${pattern}`);
			}
		}
	}
	ok(`web_accessible_resources patterns checked (${manifest.web_accessible_resources.length} block(s))`);
}

// 8. version string
if (typeof manifest.version === 'string' && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
	fail(`manifest.version "${manifest.version}" not accepted by Chrome Web Store (must be 1-4 dot-separated integers, no pre-release tags)`);
} else if (manifest.version) {
	ok(`manifest.version "${manifest.version}" matches CWS format`);
}

// 9. permissions sanity check (warn-only)
const knownPermissions = new Set([
	'activeTab', 'alarms', 'background', 'bookmarks', 'browsingData',
	'clipboardRead', 'clipboardWrite', 'contentSettings', 'contextMenus',
	'cookies', 'debugger', 'declarativeContent', 'declarativeNetRequest',
	'declarativeNetRequestWithHostAccess', 'declarativeNetRequestFeedback',
	'desktopCapture', 'documentScan', 'downloads', 'enterprise.deviceAttributes',
	'enterprise.hardwarePlatform', 'enterprise.networkingAttributes',
	'enterprise.platformKeys', 'fileBrowserHandler', 'fileSystemProvider',
	'fontSettings', 'gcm', 'geolocation', 'history', 'identity', 'idle',
	'loginState', 'management', 'nativeMessaging', 'notifications',
	'offscreen', 'pageCapture', 'platformKeys', 'power', 'printerProvider',
	'printing', 'printingMetrics', 'privacy', 'processes', 'proxy',
	'scripting', 'search', 'sessions', 'sidePanel', 'storage', 'system.cpu',
	'system.display', 'system.memory', 'system.storage', 'tabCapture',
	'tabGroups', 'tabs', 'topSites', 'tts', 'ttsEngine', 'unlimitedStorage',
	'vpnProvider', 'wallpaper', 'webNavigation', 'webRequest',
	'webRequestBlocking', 'webRequestAuthProvider',
]);
if (Array.isArray(manifest.permissions)) {
	for (const p of manifest.permissions) {
		if (!knownPermissions.has(p)) {
			warn(`permission "${p}" not in known Chrome MV3 list — is this intentional?`);
		}
	}
	ok(`${manifest.permissions.length} permission(s) checked`);
}

// Summary
console.log('');
if (errors > 0) {
	console.error(`✘ Validation failed: ${errors} error(s), ${warnings} warning(s)`);
	process.exit(1);
}
console.log(`✓ Validation passed (${warnings} warning(s))`);
process.exit(0);
