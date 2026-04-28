import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '../../types/intercepted';
import { normalizeInterceptedResponse } from '../intercepted';

describe('normalizeInterceptedResponse', () => {
	test('adapta registro antigo com headers/body no topo para response', () => {
		const legacy: InterceptedResponse = {
			url: 'https://example.test/users',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: { 'Content-Type': 'application/json' },
			mimeType: 'application/json',
			type: 'xhr',
			timestamp: 1,
			body: '{"ok":true}',
		};

		expect(normalizeInterceptedResponse(legacy)).toEqual({
			...legacy,
			response: {
				headers: { 'Content-Type': 'application/json' },
				body: '{"ok":true}',
			},
		});
	});

	test('preserva request headers existentes sem criar request headers ausentes', () => {
		const request: InterceptedResponse = {
			url: 'https://example.test/users',
			method: 'POST',
			status: 201,
			statusText: 'Created',
			headers: { Location: '/users/1' },
			mimeType: 'application/json',
			type: 'fetch',
			timestamp: 1,
			request: {
				headers: { Authorization: 'Bearer token' },
				postData: '{"name":"Ada"}',
			},
		};

		const normalized = normalizeInterceptedResponse(request);
		expect(normalized.request).toEqual(request.request);
		expect(normalized.response).toEqual({ headers: { Location: '/users/1' } });
	});

	test('nao sobrescreve response ja persistido', () => {
		const current: InterceptedResponse = {
			url: 'https://example.test/no-content',
			method: 'HEAD',
			status: 200,
			statusText: 'OK',
			headers: {},
			response: { headers: { 'X-Response': '1' } },
			mimeType: 'text/plain',
			type: 'fetch',
			timestamp: 1,
		};

		expect(normalizeInterceptedResponse(current).response).toEqual({
			headers: { 'X-Response': '1' },
		});
	});
});
