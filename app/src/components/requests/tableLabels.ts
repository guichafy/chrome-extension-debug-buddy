// Rótulos usados pelos headers/cells da tabela de requisições.
//
// As cells rodam por linha a cada render (requests chegando ao vivo, até
// dezenas de milhares no histórico) e `i18n.t` custa ~1µs por chamada. Os
// rótulos são resolvidos uma vez por idioma e reaproveitados; a troca de
// idioma invalida o cache e o DataTable (que usa useTranslation) re-renderiza
// as linhas.

import { i18n } from '@/i18n/instance';
import { APPLIED_TYPE_LABELS } from '@/types/filters';
import type { AppliedType } from '@/types/intercepted';

export interface RequestTableLabels {
	columns: {
		tipo: string;
		timestamp: string;
		duration: string;
		transferSize: string;
		method: string;
		url: string;
		statusCode: string;
		requestType: string;
		mimeType: string;
		actions: string;
	};
	editedAtRuntime: string;
	methodMissing: string;
	statusMissing: string;
	noContentType: string;
	openMenu: string;
	actionsMenu: string;
	viewDetails: string;
	appliedTypes: Record<AppliedType, string>;
}

let cache: { language: string; labels: RequestTableLabels } | null = null;

function buildLabels(): RequestTableLabels {
	return {
		columns: {
			tipo: i18n.t('commandCenter:table.columns.tipo'),
			timestamp: i18n.t('commandCenter:table.columns.timestamp'),
			duration: i18n.t('commandCenter:table.columns.duration'),
			transferSize: i18n.t('commandCenter:table.columns.transferSize'),
			method: i18n.t('commandCenter:table.columns.method'),
			url: i18n.t('commandCenter:table.columns.url'),
			statusCode: i18n.t('commandCenter:table.columns.statusCode'),
			requestType: i18n.t('commandCenter:table.columns.requestType'),
			mimeType: i18n.t('commandCenter:table.columns.mimeType'),
			actions: i18n.t('commandCenter:table.columns.actions'),
		},
		editedAtRuntime: i18n.t('commandCenter:table.editedAtRuntime'),
		methodMissing: i18n.t('commandCenter:table.methodMissing'),
		statusMissing: i18n.t('commandCenter:table.statusMissing'),
		noContentType: i18n.t('commandCenter:table.noContentType'),
		openMenu: i18n.t('commandCenter:table.openMenu'),
		actionsMenu: i18n.t('commandCenter:table.actionsMenu'),
		viewDetails: i18n.t('commandCenter:table.viewDetails'),
		appliedTypes: { ...APPLIED_TYPE_LABELS },
	};
}

export function getRequestTableLabels(): RequestTableLabels {
	if (cache === null || cache.language !== i18n.language) {
		cache = { language: i18n.language, labels: buildLabels() };
	}
	return cache.labels;
}
