// Bootstrap do i18n nas páginas da UI (options.html e sidepanel.html).
//
// Fluxo: lê a preferência salva → resolve o idioma (preferência > idioma do
// navegador > DEFAULT_LANGUAGE) → carrega só o catálogo desse idioma (chunk
// lazy) → inicializa o i18next → React renderiza. Trocar de idioma grava a
// preferência; o `chrome.storage.onChanged` propaga a troca para todas as
// páginas abertas da extensão (aba de opções + side panel).

import { type LanguageResources, buildInitOptions, i18n } from './instance';
import { type LanguageCode, isSupportedLanguage, resolveLanguage } from './languages';
import { LANGUAGE_STORAGE_KEY, getStoredLanguage, setStoredLanguage } from './preference';

// Um chunk por idioma: só o idioma ativo é baixado no carregamento da página.
const LOADERS: Record<LanguageCode, () => Promise<LanguageResources>> = {
	'pt-BR': () => import('./locales/pt-BR').then((module) => module.default),
	en: () => import('./locales/en').then((module) => module.default),
};

const loadedLanguages = new Set<LanguageCode>();
let initPromise: Promise<void> | null = null;

function reportToConsole(message: string): void {
	console.error(message);
}

function browserLanguage(): string {
	return chrome.i18n.getUILanguage();
}

function syncDocumentLanguage(language: string): void {
	document.documentElement.lang = language;
}

async function readStoredLanguage(): Promise<LanguageCode | null> {
	try {
		return await getStoredLanguage();
	} catch (err) {
		// Preferência corrompida não pode deixar a UI em branco: reporta o erro
		// e segue o idioma do navegador até o usuário escolher de novo no
		// seletor (que sobrescreve o valor inválido).
		console.error('[i18n] preferência de idioma inválida, usando o idioma do navegador:', err);
		return null;
	}
}

async function ensureLanguageLoaded(language: LanguageCode): Promise<void> {
	if (loadedLanguages.has(language)) return;
	const resources = await LOADERS[language]();
	for (const [namespace, bundle] of Object.entries(resources)) {
		i18n.addResourceBundle(language, namespace, bundle, true, true);
	}
	loadedLanguages.add(language);
}

/** Carrega o catálogo (se preciso) e troca o idioma ativo. Idempotente. */
export async function applyUiLanguage(language: LanguageCode): Promise<void> {
	await ensureLanguageLoaded(language);
	if (i18n.language !== language) {
		await i18n.changeLanguage(language);
	}
}

/** Escolha explícita do usuário no seletor: persiste e aplica. */
export async function selectUiLanguage(language: LanguageCode): Promise<void> {
	await setStoredLanguage(language);
	await applyUiLanguage(language);
}

export function handleLanguageStorageChange(
	changes: Record<string, chrome.storage.StorageChange>,
	areaName: string,
): void {
	if (areaName !== 'local') return;
	const change = changes[LANGUAGE_STORAGE_KEY];
	if (!change) return;
	const next = change.newValue;
	let target: LanguageCode;
	if (next === undefined) {
		// Preferência removida → volta a seguir o navegador.
		target = resolveLanguage(null, browserLanguage());
	} else if (isSupportedLanguage(next)) {
		target = next;
	} else {
		console.error('[i18n] preferência de idioma inválida recebida do storage:', next);
		return;
	}
	applyUiLanguage(target).catch((err) => {
		console.error(`[i18n] falha ao aplicar o idioma ${target}:`, err);
	});
}

async function initialize(): Promise<void> {
	const stored = await readStoredLanguage();
	const language = resolveLanguage(stored, browserLanguage());
	const resources = await LOADERS[language]();
	loadedLanguages.add(language);
	await i18n.init(buildInitOptions(language, { [language]: resources }, reportToConsole));
	syncDocumentLanguage(language);
	i18n.on('languageChanged', syncDocumentLanguage);
	chrome.storage.onChanged.addListener(handleLanguageStorageChange);
}

/** Inicializa o i18n uma única vez por página; chamar antes do primeiro render. */
export function initUiI18n(): Promise<void> {
	initPromise ??= initialize();
	return initPromise;
}
