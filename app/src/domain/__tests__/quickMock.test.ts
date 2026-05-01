import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { buildRuleDraftFromRequest, type BuildRuleDraftOptions } from '../quickMock';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users?page=1',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1_700_000_000_000,
	mimeType: 'application/json',
	body: '{"ok":true}',
	response: {
		headers: { 'content-type': 'application/json' },
		body: '{"ok":true}',
	},
	request: {
		headers: { authorization: 'Bearer secret', accept: 'application/json' },
	},
	...overrides,
});

const baseOptions = (overrides: Partial<BuildRuleDraftOptions> = {}): BuildRuleDraftOptions => ({
	type: 'mock',
	headerMatchers: [],
	includeQueryString: false,
	...overrides,
});

describe('buildRuleDraftFromRequest — matchers compartilhados', () => {
	test('gera matchers de URL (host+pathname) e método para todos os types', () => {
		for (const type of ['mock', 'breakpoint', 'transform', 'delay'] as const) {
			const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type }));
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.draft.matchers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'url',
						pattern: 'api.example.com/users',
						isRegex: false,
						enabled: true,
					}),
					expect.objectContaining({ type: 'method', method: 'GET', enabled: true }),
				]),
			);
		}
	});

	test('ignora query string por padrão', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').not.toContain('page=1');
	});

	test('inclui query string quando includeQueryString=true', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({ includeQueryString: true }),
		);
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').toContain('page=1');
	});

	test('inclui header matcher selecionado manualmente', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: 'application/json' }],
			}),
		);
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'header',
					headerType: 'request',
					name: 'accept',
					value: 'application/json',
					enabled: true,
				}),
			]),
		);
	});
});

describe('buildRuleDraftFromRequest — type=mock', () => {
	test('action mock reusa status, headers, body e mimeType reais', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 200,
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			contentType: 'application/json',
			statusPhrase: 'OK',
		});
	});

	test('nome derivado de host+pathname com prefixo "Mock para"', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.name).toBe('Mock para api.example.com/users');
	});

	test('aceita body undefined (não inclui campo body no action)', () => {
		const req = baseRequest({
			body: undefined,
			response: { headers: { 'content-type': 'text/plain' } },
		});
		const result = buildRuleDraftFromRequest(req, baseOptions({ type: 'mock' }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect('body' in result.draft.action).toBe(false);
	});

	test('preserva body vazio capturado', () => {
		const req = baseRequest({
			body: '',
			response: { headers: {}, body: '' },
		});
		const result = buildRuleDraftFromRequest(req, baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({ type: 'mock', body: '' });
	});
});

describe('buildRuleDraftFromRequest — type=breakpoint', () => {
	test('action breakpoint default sem descrição, prefixo de nome correto', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'breakpoint' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({ type: 'breakpoint', enabled: true, description: '' });
		expect(result.draft.name).toBe('Breakpoint para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — type=transform', () => {
	test('action transform default modo declarative com operations vazias', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'transform' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({
			type: 'transform',
			enabled: true,
			mode: 'declarative',
			operations: [],
		});
		expect(result.draft.name).toBe('Transform para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — type=delay', () => {
	test('action delay default 1000ms, prefixo de nome "Latência"', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'delay' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({ type: 'delay', enabled: true, timeMs: 1000 });
		expect(result.draft.name).toBe('Latência para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — erros', () => {
	test('falha quando captureError presente', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest({ captureError: 'Net::ERR_FAILED' }),
			baseOptions(),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('capture_error');
		expect(result.error.message).toContain('Net::ERR_FAILED');
	});

	test('falha quando método ausente (não fabrica ANY)', () => {
		const req = baseRequest();
		(req as { method?: string }).method = undefined;
		const result = buildRuleDraftFromRequest(req, baseOptions());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('method_missing');
	});

	test('falha quando header selecionado não tem valor', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: '' }],
			}),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('header_value_missing');
	});
});
