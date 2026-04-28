#!/usr/bin/env node
/**
 * Manual publish helper for Chrome Web Store.
 *
 * Usage:
 *   npm run package                # build + lint:ext + ZIP, no upload (--dry-run)
 *   npm run publish:cws            # full pipeline, upload as draft
 *   npm run publish:cws -- --publish  # upload + auto-publish to all users
 *
 * Required env vars (when not --dry-run):
 *   CWS_EXTENSION_ID
 *   CWS_CLIENT_ID
 *   CWS_CLIENT_SECRET
 *   CWS_REFRESH_TOKEN
 *
 * Pipeline:
 *   1. Build dist/ if missing.
 *   2. Run lint:ext (Chrome MV3 validator) — fail fast on bad manifest.
 *   3. ZIP dist/ → app/debug-buddy-<version>.zip.
 *   4. (skipped on --dry-run) Upload via chrome-webstore-upload-cli.
 *
 * No fallbacks: any error fails fast with a clear message.
 */

import { existsSync, createWriteStream, readFileSync, statSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const distDir = resolve(appDir, 'dist');
const pkgPath = resolve(appDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const zipPath = resolve(appDir, `debug-buddy-${version}.zip`);

const dryRun = process.argv.includes('--dry-run');
const publish = process.argv.includes('--publish');

// 0. Validate env (skip on dry run)
if (!dryRun) {
	const required = ['CWS_EXTENSION_ID', 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN'];
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length > 0) {
		console.error(`✘ Missing required env vars: ${missing.join(', ')}`);
		console.error('  Set them via shell env, .env (gitignored), or GitHub Actions secrets.');
		process.exit(1);
	}
}

// 1. Build if needed
if (!existsSync(distDir)) {
	console.log('▸ dist/ missing — running npm run build');
	execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
}

// 2. Validate extension shape (defense in depth)
console.log('▸ Validating extension shape (lint:ext)');
const lintResult = spawnSync('npm', ['run', 'lint:ext'], { cwd: appDir, stdio: 'inherit' });
if (lintResult.status !== 0) {
	console.error('✘ lint:ext failed — fix issues before publishing');
	process.exit(1);
}

// 3. Build the ZIP
console.log(`▸ Packaging ${distDir} → ${zipPath}`);
await new Promise((resolveZip, rejectZip) => {
	const output = createWriteStream(zipPath);
	const archive = archiver('zip', { zlib: { level: 9 } });
	output.on('close', () => {
		const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
		console.log(`  ${sizeKb} KB`);
		resolveZip();
	});
	archive.on('error', rejectZip);
	archive.pipe(output);
	archive.directory(distDir, false);
	archive.finalize();
});

if (dryRun) {
	console.log(`✓ Dry run complete — ZIP at ${zipPath}`);
	process.exit(0);
}

// 4. Upload (and optionally auto-publish) via CLI
const args = [
	'upload',
	'--source',
	zipPath,
	'--extension-id',
	process.env.CWS_EXTENSION_ID,
	'--client-id',
	process.env.CWS_CLIENT_ID,
	'--client-secret',
	process.env.CWS_CLIENT_SECRET,
	'--refresh-token',
	process.env.CWS_REFRESH_TOKEN,
];
if (publish) {
	args.push('--auto-publish');
}

console.log(`▸ Uploading to Chrome Web Store (publish=${publish})`);
const upload = spawnSync('npx', ['--yes', 'chrome-webstore-upload-cli', ...args], {
	cwd: appDir,
	stdio: 'inherit',
});
if (upload.status !== 0) {
	console.error('✘ Upload failed');
	process.exit(1);
}
console.log('✓ Done');
