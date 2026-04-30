// Codifica/decodifica Filter[] como entries `f=<field>:<op>:<value>` em URLSearchParams.
// Decoder é tolerante: entries malformadas (sem dois `:`, field/op desconhecidos)
// são silenciosamente descartadas. URL é entrada não-confiável; o conjunto efetivo
// é o que sobrevive ao parse.
//
// IDs são gerados via crypto.randomUUID() no decoder — IDs só importam para
// remoção no front, e cada decode é uma nova vida.

import type { Filter, FilterField, FilterOperator } from '@/types/filters';

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

const VALID_OPERATORS: ReadonlySet<FilterOperator> = new Set([
	'is',
	'contains',
	'gte',
	'lte',
	'startsWith',
]);

export function encodeFiltersToParams(filters: Filter[]): URLSearchParams {
	const params = new URLSearchParams();
	for (const filter of filters) {
		const encodedValue = encodeURIComponent(filter.value);
		params.append('f', `${filter.field}:${filter.operator}:${encodedValue}`);
	}
	return params;
}

export function decodeParamsToFilters(params: URLSearchParams): Filter[] {
	const out: Filter[] = [];
	for (const raw of params.getAll('f')) {
		// Split em no máximo 3 partes: o value pode conter `:` literais (já encodados como %3A).
		const firstColon = raw.indexOf(':');
		if (firstColon < 0) continue;
		const secondColon = raw.indexOf(':', firstColon + 1);
		if (secondColon < 0) continue;

		const field = raw.slice(0, firstColon);
		const operator = raw.slice(firstColon + 1, secondColon);
		const encodedValue = raw.slice(secondColon + 1);

		if (!VALID_FIELDS.has(field as FilterField)) continue;
		if (!VALID_OPERATORS.has(operator as FilterOperator)) continue;

		let value: string;
		try {
			value = decodeURIComponent(encodedValue);
		} catch {
			continue; // valor mal-encodado, descarta
		}

		out.push({
			id: crypto.randomUUID(),
			field: field as FilterField,
			operator: operator as FilterOperator,
			value,
		});
	}
	return out;
}
