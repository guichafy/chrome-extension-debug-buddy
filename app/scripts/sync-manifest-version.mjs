#!/usr/bin/env node
/**
 * Syncs the version field of app/manifest.json to a target value.
 * Called by semantic-release's @semantic-release/exec plugin during the
 * `prepare` step:
 *   node scripts/sync-manifest-version.mjs ${nextRelease.version}
 *
 * Why this exists: semantic-release's npm plugin only knows package.json.
 * Chrome extensions need manifest.json's version to match (it's what
 * shows in chrome://extensions and in the Chrome Web Store dashboard).
 *
 * No fallbacks: missing arg or invalid version string fails fast.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '..', 'manifest.json');

const version = process.argv[2];
if (!version) {
	console.error('✘ Missing version argument');
	console.error('  Usage: node scripts/sync-manifest-version.mjs <version>');
	process.exit(1);
}

// Chrome Web Store accepts 1-4 dot-separated integers (no pre-release tags).
// semantic-release produces semver; our config has no pre-release branches,
// so this should always be a clean x.y.z.
if (!/^\d+(\.\d+){0,3}$/.test(version)) {
	console.error(`✘ Version "${version}" not accepted by Chrome Web Store`);
	console.error('  (must be 1–4 dot-separated integers, no pre-release tags)');
	process.exit(1);
}

const raw = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);
const previous = manifest.version;
manifest.version = version;

// Preserve trailing newline if present (manifest.json uses 2-space indent)
const trailingNewline = raw.endsWith('\n') ? '\n' : '';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}${trailingNewline}`);

console.log(`✓ manifest.json version: ${previous} → ${version}`);
