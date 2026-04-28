import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { buildQuickMockDraft, type QuickMockOptions } from '../quickMock';

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

const baseOptions = (overrides: Partial<QuickMockOptions> = {}): QuickMockOptions => ({
	headerMatchers: [],
	includeQueryString: false,
	...overrides,
});

describe('buildQuickMockDraft — defaults', () => {
	test('gera matchers de URL (host+pathname) e método obrigatório', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const draft = result.draft;
		expect(draft.matchers).toEqual(
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
	});

	test('ignora query string por padrão', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').not.toContain('page=1');
	});

	test('action mock reusa status, headers, body e mimeType reais', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
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

	test('nome da regra é derivado de host+pathname', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.name).toBe('Mock para api.example.com/users');
	});
});

describe('buildQuickMockDraft — header matchers', () => {
	test('inclui header matcher selecionado manualmente', () => {
		const result = buildQuickMockDraft(
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

	test('falha tipada quando header selecionado não tem valor', () => {
		const result = buildQuickMockDraft(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: '' }],
			}),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('header_value_missing');
	});

	test('aceita matcher de response header', () => {
		const result = buildQuickMockDraft(
			baseRequest(),
			baseOptions({
				headerMatchers: [
					{ headerType: 'response', name: 'content-type', value: 'application/json' },
				],
			}),
		);
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'header',
					headerType: 'response',
					name: 'content-type',
				}),
			]),
		);
	});
});

describe('buildQuickMockDraft — erros', () => {
	test('falha quando captureError presente', () => {
		const result = buildQuickMockDraft(
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
		const result = buildQuickMockDraft(req, baseOptions());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('method_missing');
	});

	test('aceita body undefined quando body realmente não foi capturado mas response existe vazio', () => {
		const req = baseRequest({
			body: undefined,
			response: { headers: { 'content-type': 'text/plain' } },
		});
		const result = buildQuickMockDraft(req, baseOptions());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect('body' in result.draft.action).toBe(false);
	});

	test('preserva body vazio capturado (resposta realmente vazia)', () => {
		const req = baseRequest({
			body: '',
			response: { headers: {}, body: '' },
		});
		const result = buildQuickMockDraft(req, baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({ type: 'mock', body: '' });
	});
});
