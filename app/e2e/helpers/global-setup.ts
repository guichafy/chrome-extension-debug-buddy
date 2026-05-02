import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const distPath = path.resolve(__dirname, '../../dist');
	const manifestPath = path.join(distPath, 'manifest.json');

	if (!existsSync(manifestPath)) {
		throw new Error(
			`[e2e] manifest.json não encontrado em ${manifestPath}. ` +
				`Rode "npm run build" antes de "npm run e2e".`,
		);
	}

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name?: string };
	if (manifest.name !== 'Debug Buddy') {
		throw new Error(
			`[e2e] manifest.json com nome inesperado: "${manifest.name}". Esperado "Debug Buddy".`,
		);
	}

	console.log(`[e2e] dist validado em ${distPath}`);
}
