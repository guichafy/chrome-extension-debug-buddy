// Idiomas suportados pela UI e a negociação entre a preferência salva e o
// idioma do navegador. Módulo puro (sem chrome.*/i18next) para ser testável
// isoladamente e importável por qualquer contexto.

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

// Idioma usado quando o navegador está num idioma que ainda não traduzimos.
// Inglês por ser o idioma da listagem principal na Chrome Web Store e do
// README principal.
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

// Nome de cada idioma no próprio idioma — o seletor mostra sempre o nome
// nativo, independente do idioma ativo (convenção de seletores de idioma).
export const LANGUAGE_NATIVE_NAMES: Record<LanguageCode, string> = {
	'pt-BR': 'Português (Brasil)',
	en: 'English',
};

export function isSupportedLanguage(value: unknown): value is LanguageCode {
	return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function primarySubtag(tag: string): string {
	return tag.toLowerCase().split(/[-_]/)[0];
}

/**
 * Casa uma language tag BCP 47 (`chrome.i18n.getUILanguage()`, `pt-BR`,
 * `en_US`, `pt-PT`...) com um idioma suportado: primeiro match exato
 * (case-insensitive, `_` ≡ `-`), depois pelo subtag primário (`pt-PT` →
 * `pt-BR`, `en-GB` → `en`). Retorna null quando nenhum idioma suportado casa.
 */
export function matchSupportedLanguage(tag: string): LanguageCode | null {
	const normalized = tag.trim().replace(/_/g, '-').toLowerCase();
	if (normalized === '') return null;
	const exact = SUPPORTED_LANGUAGES.find((code) => code.toLowerCase() === normalized);
	if (exact) return exact;
	const primary = primarySubtag(normalized);
	return SUPPORTED_LANGUAGES.find((code) => primarySubtag(code) === primary) ?? null;
}

/**
 * Idioma efetivo da UI: a escolha explícita do usuário vence; sem escolha,
 * segue o idioma do navegador; navegador em idioma não suportado →
 * DEFAULT_LANGUAGE.
 */
export function resolveLanguage(
	stored: LanguageCode | null,
	browserLanguage: string,
): LanguageCode {
	if (stored) return stored;
	return matchSupportedLanguage(browserLanguage) ?? DEFAULT_LANGUAGE;
}
