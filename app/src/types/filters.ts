// Modelo de filtros aplicados sobre InterceptedResponse no Command Center.
//
// Combinador:
//   - Filtros de campos diferentes são combinados com AND.
//   - Filtros do mesmo campo são combinados com OR (ex: method:GET + method:POST).
//
// O campo `free` busca substring case-insensitive em todos os campos textuais
// (mantém o comportamento da busca livre anterior).

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

export const FILTER_FIELD_LABELS: Record<FilterField, string> = {
	free: 'Texto livre',
	url: 'URL',
	method: 'Método',
	status: 'Status',
	type: 'Resource type',
	mime: 'MIME',
	state: 'Estado',
	tipo: 'Tipo',
	duration: 'Duração (ms)',
	timestamp: 'Janela de tempo',
};

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
	is: '=',
	contains: 'contém',
	gte: '≥',
	lte: '≤',
	startsWith: 'começa com',
};

export const REQUEST_STATE_LABELS: Record<RequestState, string> = {
	pending: 'Aguardando',
	modified: 'Modificado',
	failed: 'Falha',
	ok: 'OK',
};

export const APPLIED_TYPE_LABELS: Record<AppliedType, string> = {
	proxy: 'Proxy',
	mock: 'Mock',
	transform: 'Transform',
	breakpoint: 'Breakpoint',
	latency: 'Latência',
	block: 'Bloqueio',
	requestModify: 'Modificada (req)',
	responseModify: 'Modificada (res)',
	requestBreakpoint: 'Breakpoint req',
	responseBreakpoint: 'Breakpoint res',
};
