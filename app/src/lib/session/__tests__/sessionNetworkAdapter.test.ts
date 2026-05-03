import type { InterceptedResponse } from '@/types/intercepted';
import { sessionEventsToRequestsRecord, stripBodyFields } from '../sessionNetworkAdapter';
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

describe('stripBodyFields', () => {
	test('remove body, response.body, request.postData', () => {
		const full: InterceptedResponse = {
			url: 'https://x',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: { 'content-type': 'application/json' },
			type: 'xhr',
			timestamp: 100,
			body: 'large body content '.repeat(1000),
			response: {
				headers: { 'content-type': 'application/json' },
				body: 'response body '.repeat(1000),
			},
			request: {
				headers: { authorization: 'Bearer x' },
				postData: 'request body '.repeat(1000),
			},
			mimeType: 'application/json',
			duration: 42,
		};
		const slim = stripBodyFields(full);
		expect(slim.body).toBeUndefined();
		expect(slim.response).toBeUndefined();
		expect(slim.request).toBeUndefined();
		// Metadata preservados:
		expect(slim.url).toBe('https://x');
		expect(slim.status).toBe(200);
		expect(slim.mimeType).toBe('application/json');
		expect(slim.duration).toBe(42);
		expect(slim.headers['content-type']).toBe('application/json');
	});

	test('idempotente em request slim', () => {
		const slim: InterceptedResponse = {
			url: 'https://x',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'xhr',
			timestamp: 100,
		};
		const again = stripBodyFields(slim);
		expect(again).toEqual(slim);
	});
});
