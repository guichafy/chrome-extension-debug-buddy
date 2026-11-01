// Instância i18next da UI (options + side panel).
//
// SOMENTE a UI importa este módulo. O service worker (background.ts) e os
// content scripts (probe/*) não podem alcançá-lo: service workers MV3 proíbem
// `import()` (usado no lazy loading dos catálogos) e o react-i18next puxaria
// React para dentro do worker. `scripts/validate-extension.mjs` falha o build
// se o runtime do i18next aparecer no grafo de imports do background.

import i18next, { type InitOptions, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { type LanguageCode, SUPPORTED_LANGUAGES } from './languages';
import type ptBR from './locales/pt-BR';
import type { Translation } from './types';

export type SourceResources = typeof ptBR;
export type LanguageResources = SourceResources | Translation<SourceResources>;

// Destino dos problemas de tradução (chave inexistente, variável de
// interpolação não passada). Produção: console.error + a chave/placeholder
// fica visível na tela. Testes: lança, para a suíte falhar.
export type TranslationProblemReporter = (message: string) => void;

export const i18n = i18next.createInstance();
i18n.use(initReactI18next);

export function buildInitOptions(
	language: LanguageCode,
	resources: Partial<Record<LanguageCode, LanguageResources>>,
	report: TranslationProblemReporter,
): InitOptions {
	const active = resources[language];
	if (!active) {
		throw new Error(`[i18n] catálogo de ${language} não foi carregado antes do init`);
	}
	return {
		lng: language,
		resources: resources as Resource,
		supportedLngs: [...SUPPORTED_LANGUAGES],
		load: 'currentOnly',
		// Sem idioma de fallback: chave faltando em um idioma é bug a ser
		// exposto, não algo a mascarar mostrando outro idioma. A paridade dos
		// catálogos é garantida pelo tsc + catalogParity.test.ts.
		fallbackLng: false,
		ns: Object.keys(active),
		defaultNS: 'common',
		returnNull: false,
		returnEmptyString: false,
		// Chave ausente aparece como `namespace:chave` — inconfundível na UI.
		appendNamespaceToMissingKey: true,
		saveMissing: true,
		missingKeyHandler: (languages, namespace, key) => {
			report(`[i18n] chave sem tradução: ${namespace}:${key} (${languages.join(', ')})`);
		},
		missingInterpolationHandler: (text, match) => {
			report(`[i18n] variável de interpolação não informada: ${match[0]} em "${text}"`);
			// Mantém o placeholder visível em vez de sumir com ele.
			return match[0];
		},
		// React já escapa o conteúdo renderizado.
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
		initAsync: false,
	};
}

export function currentLanguage(): LanguageCode {
	const language = i18n.language;
	if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
		throw new Error(`[i18n] idioma ativo inesperado: ${JSON.stringify(language)}`);
	}
	return language as LanguageCode;
}
