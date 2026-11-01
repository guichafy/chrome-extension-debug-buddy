import { type BrowserContext, chromium, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageCode } from '../../src/i18n/languages';
import { LANGUAGE_STORAGE_KEY } from '../../src/i18n/preference';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

export interface LaunchOptions {
	viewport?: { width: number; height: number };
	deviceScaleFactor?: number;
	/**
	 * Locale emulado nas páginas (Playwright usa en-US por padrão). Nas páginas
	 * da extensão isso também define `chrome.i18n.getUILanguage()` — o service
	 * worker não é emulado e continua vendo o idioma do sistema.
	 */
	locale?: string;
	/**
	 * Idioma da UI gravado em chrome.storage.local antes de qualquer página da
	 * extensão abrir. Default 'pt-BR': os seletores das suítes E2E, performance
	 * e docs são em português, e o Chromium do CI roda em inglês (a UI seguiria
	 * o idioma do navegador). `null` = não grava nada.
	 */
	uiLanguage?: LanguageCode | null;
}

export async function launchExtensionContext(options: LaunchOptions = {}): Promise<BrowserContext> {
	const { uiLanguage = 'pt-BR', ...contextOptions } = options;
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'debug-buddy-e2e-'));
	// Playwright 1.59 seleciona o binário `chromium-headless-shell` quando
	// headless: true. Esse binário não consegue carregar extensões — não é
	// limitação do flag --headless do Chrome, é seleção de binário pelo
	// runner. Por isso headless: false é obrigatório para forçar o Chromium
	// completo. Pré-requisito de CI: o comando precisa ser envolvido em
	// xvfb-run (ou equivalente) em runners Linux sem display nativo.
	const context = await chromium.launchPersistentContext(userDataDir, {
		headless: false,
		...contextOptions,
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
	if (uiLanguage !== null) {
		const sw = await waitForServiceWorker(context);
		await sw.evaluate(([key, language]) => chrome.storage.local.set({ [key]: language }), [
			LANGUAGE_STORAGE_KEY,
			uiLanguage,
		] as const);
	}
	return context;
}

async function waitForServiceWorker(context: BrowserContext) {
	return (
		context.serviceWorkers()[0] ??
		(await context.waitForEvent('serviceworker', { timeout: 10_000 }))
	);
}

// A UI cria o IndexedDB (com os object stores) no mount do Layout, que só
// acontece depois do init do i18n (preferência + chunk do idioma). Um seed que
// abra o banco antes disso cria a versão sem stores e a UI não roda o upgrade —
// então quem semeia logo após o `goto` precisa esperar o banco existir.
// Se a UI estiver no meio do upgrade, o `open` seguinte espera ele terminar.
export async function waitForAppDatabase(page: Page): Promise<void> {
	await page.waitForFunction(
		async () => {
			const databases = await indexedDB.databases();
			return databases.some((db) => db.name === 'debugger-extension-db' && (db.version ?? 0) >= 2);
		},
		undefined,
		{ timeout: 10_000 },
	);
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
	const sw = await waitForServiceWorker(context);
	const url = sw.url();
	const match = url.match(/^chrome-extension:\/\/([a-z]+)\//);
	if (!match) {
		throw new Error(`[e2e] URL de service worker inesperada: ${url}`);
	}
	return match[1];
}
