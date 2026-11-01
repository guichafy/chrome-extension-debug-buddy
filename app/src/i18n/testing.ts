// Inicialização síncrona do i18n para a suíte Vitest (importada pelo
// vitest.setup.ts). Carrega todos os idiomas e começa em pt-BR — os testes
// existentes verificam os textos em português. Chave ausente ou variável de
// interpolação não informada lança, fazendo o teste falhar.
//
// Testes que precisam de outro idioma: `await i18n.changeLanguage('en')` e
// voltar para 'pt-BR' no afterEach.

import { buildInitOptions, i18n, type LanguageResources } from './instance';
import type { LanguageCode } from './languages';
import en from './locales/en';
import ptBR from './locales/pt-BR';

// Record (e não Partial): ao adicionar um idioma em SUPPORTED_LANGUAGES, o tsc
// exige registrá-lo aqui também.
const TEST_RESOURCES: Record<LanguageCode, LanguageResources> = { 'pt-BR': ptBR, en };

export function initI18nForTests(): void {
	if (i18n.isInitialized) return;
	i18n.init(
		buildInitOptions('pt-BR', TEST_RESOURCES, (message) => {
			throw new Error(message);
		}),
	);
}
