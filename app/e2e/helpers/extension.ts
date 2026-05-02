import { type BrowserContext, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

export async function launchExtensionContext(): Promise<BrowserContext> {
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'debug-buddy-e2e-'));
	// Playwright 1.59 seleciona o binário `chromium-headless-shell` quando
	// headless: true. Esse binário não consegue carregar extensões — não é
	// limitação do flag --headless do Chrome, é seleção de binário pelo
	// runner. Por isso headless: false é obrigatório para forçar o Chromium
	// completo. Pré-requisito de CI: o comando precisa ser envolvido em
	// xvfb-run (ou equivalente) em runners Linux sem display nativo.
	const context = await chromium.launchPersistentContext(userDataDir, {
		headless: false,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH}`,
			`--load-extension=${EXTENSION_PATH}`,
			'--no-first-run',
			'--no-default-browser-check',
		],
	});
	// Limpa o profile dir quando o contexto fecha. Em CI o runner já é
	// descartado, mas evita acúmulo em /tmp em runs locais repetidos.
	context.on('close', () => {
		rm(userDataDir, { recursive: true, force: true }).catch(() => {});
	});
	return context;
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
	let sw = context.serviceWorkers()[0];
	if (!sw) {
		sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
	}
	const url = sw.url();
	const match = url.match(/^chrome-extension:\/\/([a-z]+)\//);
	if (!match) {
		throw new Error(`[e2e] URL de service worker inesperada: ${url}`);
	}
	return match[1];
}
