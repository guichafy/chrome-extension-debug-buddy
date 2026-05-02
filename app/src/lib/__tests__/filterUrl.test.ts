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

	test('aceita state:modified / state:failed / state:ok', () => {
		for (const v of ['modified', 'failed', 'ok']) {
			expect(parseFilterToken(`state:${v}`)).toEqual({
				field: 'state',
				operator: 'is',
				value: v,
			});
		}
	});

	test('descarta state:* com valor desconhecido (sem fallback silencioso)', () => {
		expect(parseFilterToken('state:foo')).toBeNull();
		// state:mocked e state:proxy migraram para o novo campo `tipo:` —
		// agora não devem ser aceitos como valores válidos de Estado.
		expect(parseFilterToken('state:mocked')).toBeNull();
		expect(parseFilterToken('state:proxy')).toBeNull();
		expect(parseFilterToken('state:')).toBeNull();
		expect(parseFilterToken('state:PENDING')).toBeNull(); // case-sensitive
	});
});

describe('parseFilterToken — tipo (novo campo de tipos de regra aplicados)', () => {
	test('aceita tipo:proxy / tipo:mock / tipo:transform / tipo:breakpoint / tipo:latency', () => {
		for (const v of ['proxy', 'mock', 'transform', 'breakpoint', 'latency']) {
			expect(parseFilterToken(`tipo:${v}`)).toEqual({
				field: 'tipo',
				operator: 'is',
				value: v,
			});
		}
	});

	test('descarta tipo:* com valor desconhecido', () => {
		expect(parseFilterToken('tipo:foo')).toBeNull();
		expect(parseFilterToken('tipo:')).toBeNull();
		expect(parseFilterToken('tipo:MOCK')).toBeNull(); // case-sensitive
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
