// Preferência de idioma da UI em `chrome.storage.local.uiLanguage`.
// Compartilhada entre a aba de opções e o side panel: os dois escutam
// `chrome.storage.onChanged` e trocam de idioma juntos.
//
// Chave ausente = usuário nunca escolheu (segue o navegador). Valor presente
// mas inválido é erro — lançamos em vez de inventar um idioma (regra
// no-fallbacks); quem chama decide como expor.

import { isSupportedLanguage, type LanguageCode } from './languages';

export const LANGUAGE_STORAGE_KEY = 'uiLanguage';

export async function getStoredLanguage(): Promise<LanguageCode | null> {
	const result = await chrome.storage.local.get([LANGUAGE_STORAGE_KEY]);
	const raw = result[LANGUAGE_STORAGE_KEY];
	if (raw === undefined) return null;
	if (!isSupportedLanguage(raw)) {
		throw new Error(
			`${LANGUAGE_STORAGE_KEY} corrompido em chrome.storage: idioma não suportado ${JSON.stringify(raw)}`,
		);
	}
	return raw;
}

export async function setStoredLanguage(language: LanguageCode): Promise<void> {
	await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
}
