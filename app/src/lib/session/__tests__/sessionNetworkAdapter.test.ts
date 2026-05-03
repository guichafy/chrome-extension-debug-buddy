import type { InterceptedResponse } from '@/types/intercepted';
import {
	applyBodyPolicy,
	REPLAY_BODY_CAP_BYTES,
	sessionEventsToRequestsRecord,
} from '../sessionNetworkAdapter';
import type { SessionEvent } from '../types';

describe('sessionEventsToRequestsRecord', () => {
	test('mapeia eventos network com request snapshot', () => {
		const sample: InterceptedResponse = {
			url: 'https://api.test/users',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'xhr',
			timestamp: 100,
		};
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://api.test/users',
				status: 200,
				request: sample,
			},
			{ type: 'detection', timestamp: 50, phaseId: 'p1' },
		];
		const out = sessionEventsToRequestsRecord(events, 200);
		expect(Object.keys(out)).toEqual(['r1']);
		expect(out.r1).toBe(sample);
	});

	test('filtra por cutoff inclusivo', () => {
		const make = (id: string, ts: number): SessionEvent => ({
			type: 'network',
			timestamp: ts,
			phaseId: 'p',
			requestId: id,
			method: 'GET',
			url: 'https://x',
			status: 200,
			request: {
				url: 'https://x',
				method: 'GET',
				status: 200,
				statusText: 'OK',
				headers: {},
				type: 'xhr',
				timestamp: ts,
			},
		});
		const events = [make('r1', 100), make('r2', 200), make('r3', 300)];
		const out = sessionEventsToRequestsRecord(events, 200);
		expect(Object.keys(out).sort()).toEqual(['r1', 'r2']);
	});

	test('omite eventos network sem request snapshot (sessoes antigas)', () => {
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p',
				requestId: 'r1',
				method: 'GET',
				url: 'https://x',
				status: 200,
				// sem request
			},
		];
		const out = sessionEventsToRequestsRecord(events, Number.MAX_SAFE_INTEGER);
		expect(Object.keys(out)).toEqual([]);
	});
});

describe('applyBodyPolicy', () => {
	const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
		url: 'https://api.test/x',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: { 'content-type': 'application/json' },
		mimeType: 'application/json',
		type: 'xhr',
		timestamp: 100,
		duration: 42,
		...overrides,
	});

	test('preserva body textual pequeno em response e request', () => {
		const r = baseRequest({
			body: '{"ok":true}',
			response: {
				headers: { 'content-type': 'application/json' },
				body: '{"ok":true}',
			},
			request: {
				headers: { 'content-type': 'application/json' },
				postData: '{"q":"a"}',
			},
		});
		const slim = applyBodyPolicy(r);
		expect(slim.response?.body).toBe('{"ok":true}');
		expect(slim.body).toBe('{"ok":true}');
		expect(slim.request?.postData).toBe('{"q":"a"}');
		expect(slim.bodyUnavailableReason).toBeUndefined();
	});

	test('descarta response body binário com nota explicativa', () => {
		const r = baseRequest({
			mimeType: 'image/png',
			headers: { 'content-type': 'image/png' },
			body: 'PNG\x00binary',
			response: {
				headers: { 'content-type': 'image/png' },
				body: 'PNG\x00binary',
			},
		});
		const slim = applyBodyPolicy(r);
		expect(slim.response?.body).toBeUndefined();
		expect(slim.body).toBeUndefined();
		expect(slim.bodyUnavailableReason).toMatch(/não é textual|nao e textual/);
		// Headers preservados mesmo sem body — útil pra debug.
		expect(slim.response?.headers['content-type']).toBe('image/png');
	});

	test('descarta response body textual maior que 64KB com nota de cap', () => {
		const big = 'a'.repeat(REPLAY_BODY_CAP_BYTES + 1);
		const r = baseRequest({
			body: big,
			response: {
				headers: { 'content-type': 'application/json' },
				body: big,
			},
		});
		const slim = applyBodyPolicy(r);
		expect(slim.response?.body).toBeUndefined();
		expect(slim.bodyUnavailableReason).toMatch(/excede cap|65537/);
	});

	test('descarta postData binário (multipart upload) mas mantem request headers', () => {
		const r = baseRequest({
			method: 'POST',
			request: {
				headers: { 'content-type': 'multipart/form-data; boundary=---' },
				postData: '---boundary\x00binary\x00data',
			},
		});
		const slim = applyBodyPolicy(r);
		expect(slim.request?.headers?.['content-type']).toMatch(/multipart\/form-data/);
		expect(slim.request?.postData).toBeUndefined();
	});

	test('preserva bodyUnavailableReason original quando capture já tinha falhado', () => {
		const r = baseRequest({
			bodyUnavailableReason: 'Falha na captura: connection reset',
			body: undefined,
		});
		const slim = applyBodyPolicy(r);
		expect(slim.bodyUnavailableReason).toBe('Falha na captura: connection reset');
	});

	test('idempotente em snapshot já slim', () => {
		const slim: InterceptedResponse = {
			url: 'https://x',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'xhr',
			timestamp: 100,
			mimeType: 'application/json',
			response: {
				headers: { 'content-type': 'application/json' },
				body: '{"ok":1}',
			},
			body: '{"ok":1}',
		};
		const again = applyBodyPolicy(slim);
		expect(again.response?.body).toBe('{"ok":1}');
		expect(again.body).toBe('{"ok":1}');
	});

	test('aceita variantes de mime textual: application/ld+json e application/vnd.api+json', () => {
		const ld = applyBodyPolicy(
			baseRequest({
				mimeType: 'application/ld+json',
				headers: { 'content-type': 'application/ld+json' },
				body: '{"@id":"x"}',
				response: {
					headers: { 'content-type': 'application/ld+json' },
					body: '{"@id":"x"}',
				},
			}),
		);
		expect(ld.response?.body).toBe('{"@id":"x"}');
		const vnd = applyBodyPolicy(
			baseRequest({
				mimeType: 'application/vnd.api+json',
				headers: { 'content-type': 'application/vnd.api+json' },
				body: '{"data":{}}',
				response: {
					headers: { 'content-type': 'application/vnd.api+json' },
					body: '{"data":{}}',
				},
			}),
		);
		expect(vnd.response?.body).toBe('{"data":{}}');
	});

});
