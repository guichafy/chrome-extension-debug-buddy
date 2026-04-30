import type { Filter } from '@/types/filters';
import {
	decodeParamsToFilters,
	encodeFiltersToParams,
} from '../filterUrlSerialization';

describe('encodeFiltersToParams', () => {
	it('codifica lista vazia para URLSearchParams vazio', () => {
		const params = encodeFiltersToParams([]);
		expect(params.toString()).toBe('');
	});

	it('codifica um filtro como entry f=field:op:value', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'duration', operator: 'gte', value: '1000' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual(['duration:gte:1000']);
	});

	it('codifica múltiplos filtros como entries repetidas', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'timestamp', operator: 'gte', value: '1714425600000' },
			{ id: 'b', field: 'duration', operator: 'gte', value: '1000' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual([
			'timestamp:gte:1714425600000',
			'duration:gte:1000',
		]);
	});

	it('URL-encoda valores com caracteres especiais', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'url', operator: 'contains', value: 'a:b/c' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual(['url:contains:a%3Ab%2Fc']);
	});
});

describe('decodeParamsToFilters', () => {
	it('decodifica params vazio para lista vazia', () => {
		expect(decodeParamsToFilters(new URLSearchParams())).toEqual([]);
	});

	it('decodifica entry f=field:op:value para Filter', () => {
		const params = new URLSearchParams('f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]).toMatchObject({
			field: 'duration',
			operator: 'gte',
			value: '1000',
		});
		expect(typeof filters[0]?.id).toBe('string');
		expect(filters[0]?.id.length).toBeGreaterThan(0);
	});

	it('decodifica múltiplas entries preservando ordem', () => {
		const params = new URLSearchParams('f=timestamp:gte:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters.map((f) => f.field)).toEqual(['timestamp', 'duration']);
	});

	it('URL-decoda valores', () => {
		const params = new URLSearchParams('f=url:contains:a%3Ab%2Fc');
		const filters = decodeParamsToFilters(params);
		expect(filters[0]?.value).toBe('a:b/c');
	});

	it('ignora entries malformadas (sem dois `:`)', () => {
		const params = new URLSearchParams('f=invalid&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('duration');
	});

	it('ignora entries com field desconhecido', () => {
		const params = new URLSearchParams('f=foo:gte:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('duration');
	});

	it('ignora entries com operator desconhecido', () => {
		const params = new URLSearchParams('f=duration:bogus:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.operator).toBe('gte');
	});

	it('round-trip preserva field/operator/value', () => {
		const original: Filter[] = [
			{ id: 'a', field: 'timestamp', operator: 'gte', value: '1714425600000' },
			{ id: 'b', field: 'url', operator: 'contains', value: 'with space:' },
		];
		const decoded = decodeParamsToFilters(encodeFiltersToParams(original));
		expect(decoded).toHaveLength(2);
		expect(decoded[0]).toMatchObject({
			field: 'timestamp',
			operator: 'gte',
			value: '1714425600000',
		});
		expect(decoded[1]).toMatchObject({
			field: 'url',
			operator: 'contains',
			value: 'with space:',
		});
	});
});
