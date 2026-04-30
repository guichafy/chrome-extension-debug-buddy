// Modelo de filtros aplicados sobre InterceptedResponse no Command Center.
//
// Combinador:
//   - Filtros de campos diferentes são combinados com AND.
//   - Filtros do mesmo campo são combinados com OR (ex: method:GET + method:POST).
//
// O campo `free` busca substring case-insensitive em todos os campos textuais
// (mantém o comportamento da busca livre anterior).

export type FilterField =
	| 'free'
	| 'url'
	| 'method'
	| 'status'
	| 'type'
	| 'mime'
	| 'state'
	| 'duration'
	| 'timestamp';

export type FilterOperator = 'is' | 'contains' | 'gte' | 'lte' | 'startsWith';

export type RequestState = 'pending' | 'mocked' | 'modified' | 'failed' | 'proxy';

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
	type: 'Tipo',
	mime: 'MIME',
	state: 'Estado',
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
	mocked: 'Mockado',
	modified: 'Modificado',
	failed: 'Falha',
	proxy: 'Proxy',
};
