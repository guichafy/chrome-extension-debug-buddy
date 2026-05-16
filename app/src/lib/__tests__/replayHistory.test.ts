import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { buildReplayView } from '../replayHistory';

const captured: InterceptedResponse = {
	url: 'https://api.example.com/x',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"ok":true}',
	response: { headers: { 'content-type': 'application/json' }, body: '{"ok":true}' },
};

const rule: Rule = {
	id: 'r1',
	name: 'Mock para api.example.com/x',
	enabled: true,
	stage: 'response',
	matchers: [
		{ type: 'url', enabled: true, pattern: 'api.example.com/x', isRegex: false },
		{ type: 'method', enabled: true, method: 'GET' },
	],
	actions: [
		{
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
			headers: {},
			body: '{"error":"boom"}',
		},
	],
	createdAt: 1,
	updatedAt: 1,
};

describe('buildReplayView', () => {
	test('sem regra associada retorna apenas captured', () => {
		const view = buildReplayView(captured, []);
		expect(view.captured.status).toBe(200);
		expect(view.currentMock).toBeNull();
	});

	test('com regra mock match retorna currentMock', () => {
		const view = buildReplayView(captured, [rule]);
		expect(view.currentMock).not.toBeNull();
		expect(view.currentMock?.status).toBe(500);
		expect(view.currentMock?.body).toBe('{"error":"boom"}');
	});

	test('regra desabilitada não vira currentMock', () => {
		const view = buildReplayView(captured, [{ ...rule, enabled: false }]);
		expect(view.currentMock).toBeNull();
	});
});
