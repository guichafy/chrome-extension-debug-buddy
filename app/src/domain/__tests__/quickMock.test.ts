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
