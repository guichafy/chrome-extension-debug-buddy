import type { InterceptedResponse } from '@/types/intercepted';
import { buildSuggestions } from '../filterSuggestions';

function makeRequest(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api.example.com',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		mimeType: 'application/json',
		type: 'xhr',
		timestamp: 0,
		...overrides,
	};
}

describe('buildSuggestions', () => {
	test('input vazio retorna atalhos com pendentes em primeiro', () => {
		const suggestions = buildSuggestions('', []);
		expect(suggestions[0]?.apply.field).toBe('state');
		expect(suggestions[0]?.apply.value).toBe('pending');
		expect(suggestions.some((s) => s.display === 'method:')).toBe(true);
		expect(suggestions.some((s) => s.display === 'status:')).toBe(true);
	});

	test('prefixo method: lista métodos presentes', () => {
		const requests = [
			makeRequest({ method: 'GET' }),
			makeRequest({ method: 'POST' }),
			makeRequest({ method: 'GET' }),
		];
		const suggestions = buildSuggestions('method:', requests);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toContain('GET');
		expect(values).toContain('POST');
		expect(values).not.toContain('DELETE');
	});

	test('prefixo method: sem requisições usa fallback comum', () => {
		const suggestions = buildSuggestions('method:', []);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']));
	});

	test('prefixo status: inclui grupos 2xx-5xx', () => {
		const suggestions = buildSuggestions('status:', []);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toEqual(expect.arrayContaining(['2xx', '3xx', '4xx', '5xx']));
	});

	test('status:500 oferece operadores gte/lte', () => {
		const suggestions = buildSuggestions('status:500', []);
		const operators = suggestions.map((s) => s.apply.operator);
		expect(operators).toContain('gte');
		expect(operators).toContain('lte');
	});

	test('prefixo state: lista todos os estados (failed/pending/modified/ok)', () => {
		const suggestions = buildSuggestions('state:', []);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toEqual(expect.arrayContaining(['pending', 'failed', 'modified', 'ok']));
	});

	test('prefixo tipo: lista todos os tipos de regra aplicados', () => {
		const suggestions = buildSuggestions('tipo:', []);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toEqual(
			expect.arrayContaining(['proxy', 'mock', 'transform', 'breakpoint', 'latency']),
		);
	});

	test('texto livre vira sugestão free + matches parciais de prefixo', () => {
		const suggestions = buildSuggestions('met', []);
		expect(suggestions[0]?.apply.field).toBe('free');
		expect(suggestions[0]?.apply.value).toBe('met');
		expect(suggestions.some((s) => s.display === 'method:')).toBe(true);
	});

	test('url:foo cria sugestão url contains foo', () => {
		const suggestions = buildSuggestions('url:foo', []);
		expect(suggestions[0]?.apply).toEqual({ field: 'url', operator: 'contains', value: 'foo' });
	});

	test('mime: lista MIMEs presentes', () => {
		const requests = [
			makeRequest({ mimeType: 'application/json' }),
			makeRequest({ mimeType: 'text/html' }),
		];
		const suggestions = buildSuggestions('mime:', requests);
		const values = suggestions.map((s) => s.apply.value);
		expect(values).toEqual(expect.arrayContaining(['application/json', 'text/html']));
	});
});
