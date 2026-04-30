// Serialização de filtros do Command Center na URL.
//
// Formato: cada filtro é codificado num parâmetro `filter` repetido como
//   `filter=<field>:<value>`                  → operador padrão do campo
//   `filter=<field>:<operator>:<value>`       → operador explícito
//
// Exemplos:
//   ?filter=state:pending                       (atalho "Ver pausadas")
//   ?filter=state:pending&filter=method:GET     (combinação por AND/OR)
//   ?filter=status:gte:400                      (operador explícito)
//   ?filter=url:https://api.example.com/users   (operador padrão `contains`)
//
// Operadores padrão por campo:
//   state, method, type, mime, status, duration → `is`
//   url, free                                   → `contains`
//   timestamp                                   → `gte`

import type { Filter, FilterField, FilterOperator, RequestState } from '@/types/filters';

const VALID_FIELDS: ReadonlySet<FilterField> = new Set([
	'free',
	'url',
	'method',
	'status',
	'type',
	'mime',
	'state',
	'duration',
	'timestamp',
]);

const VALID_STATE_VALUES: ReadonlySet<RequestState> = new Set([
	'pending',
	'mocked',
	'modified',
	'failed',
	'proxy',
]);

const VALID_OPERATORS: ReadonlySet<FilterOperator> = new Set([
	'is',
	'contains',
	'gte',
	'lte',
	'startsWith',
]);

const DEFAULT_OPERATOR_BY_FIELD: Record<FilterField, FilterOperator> = {
	free: 'contains',
	url: 'contains',
	method: 'is',
	status: 'is',
	type: 'is',
	mime: 'is',
	state: 'is',
	duration: 'is',
	timestamp: 'gte',
};

function isFilterField(value: string): value is FilterField {
	return VALID_FIELDS.has(value as FilterField);
}

function isFilterOperator(value: string): value is FilterOperator {
	return VALID_OPERATORS.has(value as FilterOperator);
}

function isValidStateValue(value: string): value is RequestState {
	return VALID_STATE_VALUES.has(value as RequestState);
}

// Parser tolerante: descarta tokens malformados em vez de lançar — o que vier na
// URL pode ter sido editado à mão pelo usuário, e quebrar a tela toda por causa
// de um filtro inválido seria pior do que ignorá-lo.
//
// Para `state:*` validamos explicitamente o valor contra a lista canônica de
// RequestState (pending/mocked/modified/failed/proxy). Sem isso, um valor
// desconhecido (ex.: `state:foo`) silenciosamente filtraria tudo (porque
// nenhuma request casa com um estado inexistente) — comportamento que viola a
// regra "no fallbacks" do projeto e esconderia o erro.
export function parseFilterToken(raw: string): Omit<Filter, 'id'> | null {
	const token = raw.trim();
	if (!token) return null;

	const firstColon = token.indexOf(':');
	if (firstColon === -1) return null;

	const field = token.slice(0, firstColon);
	if (!isFilterField(field)) return null;

	const rest = token.slice(firstColon + 1);
	const secondColon = rest.indexOf(':');

	let operator: FilterOperator;
	let value: string;

	if (secondColon !== -1) {
		const maybeOperator = rest.slice(0, secondColon);
		if (isFilterOperator(maybeOperator)) {
			operator = maybeOperator;
			value = rest.slice(secondColon + 1);
		} else {
			operator = DEFAULT_OPERATOR_BY_FIELD[field];
			value = rest;
		}
	} else {
		operator = DEFAULT_OPERATOR_BY_FIELD[field];
		value = rest;
	}

	if (field === 'state' && !isValidStateValue(value)) return null;

	return { field, operator, value };
}

export function serializeFilterToken(filter: Filter | Omit<Filter, 'id'>): string {
	const defaultOperator = DEFAULT_OPERATOR_BY_FIELD[filter.field];
	if (filter.operator === defaultOperator) {
		return `${filter.field}:${filter.value}`;
	}
	return `${filter.field}:${filter.operator}:${filter.value}`;
}

export function parseFiltersFromUrl(params: URLSearchParams): Filter[] {
	const filters: Filter[] = [];
	for (const raw of params.getAll('filter')) {
		const parsed = parseFilterToken(raw);
		if (parsed) {
			filters.push({ id: crypto.randomUUID(), ...parsed });
		}
	}
	return filters;
}

export function serializeFiltersToUrl(filters: Filter[]): string[] {
	return filters.map(serializeFilterToken);
}

// Compara a lista atual do parâmetro `filter` com a desejada — usado pelo
// CommandCenter para evitar `setSearchParams` redundante (que dispararia
// re-render mesmo sem mudança visível).
export function filtersEqualUrl(desired: string[], current: string[]): boolean {
	if (desired.length !== current.length) return false;
	for (let i = 0; i < desired.length; i += 1) {
		if (desired[i] !== current[i]) return false;
	}
	return true;
}
