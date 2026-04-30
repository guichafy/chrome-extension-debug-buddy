import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter, FilterField, RequestState } from '@/types/filters';
import { getRequestState } from './requestState';

export { getRequestState };

// Gera um texto agregado para busca livre. Inclui campos textuais relevantes;
// status é incluído como string para casar buscas como "404".
function buildFreeTextHaystack(request: InterceptedResponse): string {
	return [
		request.url,
		request.method ?? '',
		String(request.status ?? ''),
		request.statusText ?? '',
		request.type ?? '',
		request.mimeType ?? '',
	]
		.join(' ')
		.toLowerCase();
}

function evaluateNumericFilter(
	value: string,
	requestStatus: number,
	operator: Filter['operator'],
): boolean {
	const trimmed = value.trim().toLowerCase();
	if (trimmed === '') return true;

	// Suporte a grupos como 2xx/3xx/4xx/5xx (apenas com operador "is").
	const groupMatch = trimmed.match(/^([1-5])xx$/);
	if (groupMatch) {
		if (operator !== 'is') return false;
		const decade = Number(groupMatch[1]) * 100;
		return requestStatus >= decade && requestStatus < decade + 100;
	}

	const numericValue = Number(trimmed);
	if (Number.isNaN(numericValue)) return false;

	switch (operator) {
		case 'is':
			return requestStatus === numericValue;
		case 'gte':
			return requestStatus >= numericValue;
		case 'lte':
			return requestStatus <= numericValue;
		default:
			return false;
	}
}

function evaluateStringFilter(
	value: string,
	target: string | undefined,
	operator: Filter['operator'],
): boolean {
	if (target === undefined || target === null) return false;
	const needle = value.toLowerCase();
	const haystack = target.toLowerCase();
	switch (operator) {
		case 'is':
			return haystack === needle;
		case 'contains':
			return haystack.includes(needle);
		case 'startsWith':
			return haystack.startsWith(needle);
		default:
			return false;
	}
}

// Avalia um único filtro contra uma requisição.
export function matchesFilter(request: InterceptedResponse, filter: Filter): boolean {
	const value = filter.value;
	if (value === '' && filter.field !== 'free') return true;

	switch (filter.field) {
		case 'free': {
			if (value === '') return true;
			return buildFreeTextHaystack(request).includes(value.toLowerCase());
		}
		case 'url':
			return evaluateStringFilter(value, request.url, filter.operator);
		case 'method':
			return evaluateStringFilter(value, request.method, filter.operator);
		case 'type':
			return evaluateStringFilter(value, request.type, filter.operator);
		case 'mime':
			return evaluateStringFilter(value, request.mimeType, filter.operator);
		case 'status':
			return evaluateNumericFilter(value, request.status, filter.operator);
		case 'state': {
			const state = getRequestState(request);
			return state === (value as RequestState);
		}
		case 'duration': {
			if (typeof request.duration !== 'number') return false;
			const trimmed = filter.value.trim();
			if (trimmed === '') return true;
			const numericValue = Number(trimmed);
			if (Number.isNaN(numericValue)) return false;
			switch (filter.operator) {
				case 'is':
					return request.duration === numericValue;
				case 'gte':
					return request.duration >= numericValue;
				case 'lte':
					return request.duration <= numericValue;
				default:
					return false;
			}
		}
		case 'timestamp': {
			const trimmed = filter.value.trim();
			if (trimmed === '') return true;
			const numericValue = Number(trimmed);
			if (Number.isNaN(numericValue)) return false;
			switch (filter.operator) {
				case 'gte':
					return request.timestamp >= numericValue;
				case 'lte':
					return request.timestamp <= numericValue;
				default:
					return false;
			}
		}
	}
}

export type FilterGroups = Map<FilterField, Filter[]>;

// Agrupa filtros por campo uma única vez para reuso entre N requisições. Útil
// quando matchesFilters é chamado em loop (ex.: filtragem de allRequests).
export function buildFilterGroups(filters: Filter[]): FilterGroups {
	const groups: FilterGroups = new Map();
	for (const filter of filters) {
		const list = groups.get(filter.field);
		if (list) list.push(filter);
		else groups.set(filter.field, [filter]);
	}
	return groups;
}

export function matchesFilterGroups(request: InterceptedResponse, groups: FilterGroups): boolean {
	for (const groupFilters of groups.values()) {
		const groupMatch = groupFilters.some((filter) => matchesFilter(request, filter));
		if (!groupMatch) return false;
	}
	return true;
}

// Atalho para uso pontual: agrupa e avalia. Para loops grandes prefira
// buildFilterGroups + matchesFilterGroups (evita rebuild do Map por iteração).
export function matchesFilters(request: InterceptedResponse, filters: Filter[]): boolean {
	if (filters.length === 0) return true;
	return matchesFilterGroups(request, buildFilterGroups(filters));
}
