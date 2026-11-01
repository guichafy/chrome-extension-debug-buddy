// Inicialização síncrona do i18n para a suíte Vitest (importada pelo
// vitest.setup.ts). Carrega os dois idiomas e começa em pt-BR — os testes
// existentes verificam os textos em português. Chave ausente ou variável de
// interpolação não informada lança, fazendo o teste falhar.
//
// Testes que precisam de outro idioma: `await i18n.changeLanguage('en')` e
// voltar para 'pt-BR' no afterEach.

import { buildInitOptions, i18n } from './instance';
import en from './locales/en';
import ptBR from './locales/pt-BR';

export function initI18nForTests(): void {
	if (i18n.isInitialized) return;
	i18n.init(
		buildInitOptions('pt-BR', { 'pt-BR': ptBR, en }, (message) => {
			throw new Error(message);
		}),
	);
}
