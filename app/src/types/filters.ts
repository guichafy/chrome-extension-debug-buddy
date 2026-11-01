// Modelo de filtros aplicados sobre InterceptedResponse no Command Center.
//
// Combinador:
//   - Filtros de campos diferentes são combinados com AND.
//   - Filtros do mesmo campo são combinados com OR (ex: method:GET + method:POST).
//
// O campo `free` busca substring case-insensitive em todos os campos textuais
// (mantém o comportamento da busca livre anterior).

import { i18n } from '@/i18n/instance';
import type { AppliedType } from './intercepted';

export type FilterField =
	| 'free'
	| 'url'
	| 'method'
	| 'status'
	| 'type'
	| 'mime'
	| 'state'
	| 'tipo'
	| 'duration'
	| 'timestamp';

export type FilterOperator = 'is' | 'contains' | 'gte' | 'lte' | 'startsWith';

// Estado de execução de uma requisição. Foi reduzido para 4 valores quando os
// antigos 'mocked'/'proxy' migraram para `AppliedType` (coluna Tipo). Estado
// agora trata só de execução: ok = passou normalmente, modified = body/headers
// foram editados em runtime, pending = aguardando interação no breakpoint,
// failed = erro durante captura.
export type RequestState = 'pending' | 'modified' | 'failed' | 'ok';

export interface Filter {
	id: string;
	field: FilterField;
	operator: FilterOperator;
	value: string;
}

// Rótulos exibidos na UI, resolvidos no idioma ativo a cada leitura (getters).
// `keys` como Record força o tsc a exigir todas as chaves da union.
function localizedLabels<K extends string>(
	keys: Record<K, true>,
	resolve: (key: K) => string,
): Readonly<Record<K, string>> {
	const labels = {} as Record<K, string>;
	for (const key of Object.keys(keys) as K[]) {
		Object.defineProperty(labels, key, { enumerable: true, get: () => resolve(key) });
	}
	return labels;
}

export const FILTER_FIELD_LABELS = localizedLabels<FilterField>(
	{
		free: true,
		url: true,
		method: true,
		status: true,
		type: true,
		mime: true,
		state: true,
		tipo: true,
		duration: true,
		timestamp: true,
	},
	(field) => i18n.t(`commandCenter:filterFields.${field}`),
);

export const FILTER_OPERATOR_LABELS = localizedLabels<FilterOperator>(
	{ is: true, contains: true, gte: true, lte: true, startsWith: true },
	(operator) => i18n.t(`commandCenter:filterOperators.${operator}`),
);

export const REQUEST_STATE_LABELS = localizedLabels<RequestState>(
	{ pending: true, modified: true, failed: true, ok: true },
	(state) => i18n.t(`commandCenter:requestStates.${state}`),
);

export const APPLIED_TYPE_LABELS = localizedLabels<AppliedType>(
	{
		proxy: true,
		mock: true,
		transform: true,
		breakpoint: true,
		latency: true,
		block: true,
		requestModify: true,
		responseModify: true,
		requestBreakpoint: true,
		responseBreakpoint: true,
	},
	(type) => i18n.t(`commandCenter:appliedTypes.${type}`),
);
