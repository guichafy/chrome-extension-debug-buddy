// Tipagem das chaves de tradução: `t('layout:header.startAnalysis')` é
// checado pelo tsc contra o catálogo fonte (pt-BR).
import 'i18next';
import type ptBR from './locales/pt-BR';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'common';
		resources: typeof ptBR;
		returnNull: false;
		returnEmptyString: false;
	}
}
