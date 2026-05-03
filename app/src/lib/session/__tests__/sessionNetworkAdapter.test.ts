import type { InterceptedResponse } from '@/types/intercepted';
import { sessionEventsToRequestsRecord } from '../sessionNetworkAdapter';
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
