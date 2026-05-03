import { sessionEventsToReplayRows } from '../sessionNetworkAdapter';
import type { SessionEvent } from '../types';

describe('sessionEventsToReplayRows', () => {
	const fp = {
		framework: { name: 'vanilla' as const },
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 0,
		isProductionBuild: false,
	};
	void fp;

	test('filtra apenas variantes network', () => {
		const events: SessionEvent[] = [
			{ type: 'detection', timestamp: 100, phaseId: 'p1' },
			{
				type: 'network',
				timestamp: 200,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://example.com/api',
				status: 200,
				durationMs: 50,
			},
			{
				type: 'console',
				timestamp: 300,
				phaseId: 'p1',
				source: 'app',
				level: 'log',
				args: [],
			},
		];
		const rows = sessionEventsToReplayRows(events, Number.MAX_SAFE_INTEGER);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe('r1');
		expect(rows[0].method).toBe('GET');
		expect(rows[0].status).toBe(200);
		expect(rows[0].durationMs).toBe(50);
	});

	test('filtra por cutoffTimestamp (inclusivo)', () => {
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://a',
				status: 200,
			},
			{
				type: 'network',
				timestamp: 200,
				phaseId: 'p1',
				requestId: 'r2',
				method: 'POST',
				url: 'https://b',
				status: 201,
			},
			{
				type: 'network',
				timestamp: 300,
				phaseId: 'p1',
				requestId: 'r3',
				method: 'GET',
				url: 'https://c',
				status: 200,
			},
		];
		const rows = sessionEventsToReplayRows(events, 200);
		expect(rows.map((r) => r.id)).toEqual(['r1', 'r2']);
	});

	test('preserva client e callsiteFile quando presentes', () => {
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://example.com',
				status: 200,
				client: 'fetch',
				callsite: { file: 'src/api.ts', line: 42, column: 5 },
			},
		];
		const rows = sessionEventsToReplayRows(events, Number.MAX_SAFE_INTEGER);
		expect(rows[0].client).toBe('fetch');
		expect(rows[0].callsiteFile).toBe('src/api.ts');
	});
});
