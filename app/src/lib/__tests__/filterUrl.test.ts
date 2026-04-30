import { describe, expect, test } from 'vitest';
import type { Filter } from '@/types/filters';
import {
	filtersEqualUrl,
	parseFilterToken,
	parseFiltersFromUrl,
	serializeFilterToken,
	serializeFiltersToUrl,
} from '../filterUrl';

describe('parseFilterToken — state', () => {
	test('aceita state:pending com operador padrão `is`', () => {
		expect(parseFilterToken('state:pending')).toEqual({
			field: 'state',
			operator: 'is',
			value: 'pending',
		});
	});

	test('aceita state:mocked / state:modified / state:failed / state:proxy', () => {
		for (const v of ['mocked', 'modified', 'failed', 'proxy']) {
			expect(parseFilterToken(`state:${v}`)).toEqual({
				field: 'state',
				operator: 'is',
				value: v,
			});
		}
	});

	test('descarta state:* com valor desconhecido (sem fallback silencioso)', () => {
		expect(parseFilterToken('state:foo')).toBeNull();
		expect(parseFilterToken('state:')).toBeNull();
		expect(parseFilterToken('state:PENDING')).toBeNull(); // case-sensitive
	});
});

describe('parseFiltersFromUrl', () => {
	test('?filter=state:pending produz um filtro com isWaiting=true semantics', () => {
		const params = new URLSearchParams('filter=state:pending');
		const filters = parseFiltersFromUrl(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]).toMatchObject({
			field: 'state',
			operator: 'is',
			value: 'pending',
		});
	});

	test('mistura state:pending válido com state:foo inválido — só o válido sobrevive', () => {
		const params = new URLSearchParams('filter=state:pending&filter=state:foo&filter=method:GET');
		const filters = parseFiltersFromUrl(params);
		expect(filters).toHaveLength(2);
		expect(filters.map((f) => `${f.field}:${f.value}`)).toEqual(['state:pending', 'method:GET']);
	});
});

describe('serialize ↔ parse — state:pending round-trip', () => {
	test('serializeFilterToken(state:pending) usa formato curto', () => {
		const filter: Filter = {
			id: 'x',
			field: 'state',
			operator: 'is',
			value: 'pending',
		};
		expect(serializeFilterToken(filter)).toBe('state:pending');
	});

	test('serializeFiltersToUrl + parse mantém estrutura', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'state', operator: 'is', value: 'pending' },
			{ id: 'b', field: 'method', operator: 'is', value: 'GET' },
		];
		const tokens = serializeFiltersToUrl(filters);
		expect(tokens).toEqual(['state:pending', 'method:GET']);

		const params = new URLSearchParams();
		for (const t of tokens) params.append('filter', t);
		const reparsed = parseFiltersFromUrl(params);
		expect(reparsed.map((f) => `${f.field}:${f.operator}:${f.value}`)).toEqual([
			'state:is:pending',
			'method:is:GET',
		]);
	});
});

describe('filtersEqualUrl', () => {
	test('detecta listas idênticas', () => {
		expect(filtersEqualUrl(['state:pending'], ['state:pending'])).toBe(true);
	});

	test('detecta diferença em comprimento', () => {
		expect(filtersEqualUrl(['state:pending'], ['state:pending', 'method:GET'])).toBe(false);
	});

	test('detecta diferença na ordem', () => {
		expect(
			filtersEqualUrl(['state:pending', 'method:GET'], ['method:GET', 'state:pending']),
		).toBe(false);
	});
});
