import { describe, expect, it } from 'vitest';
import { detectWaterfall } from '../detectors/waterfall';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 200,
		durationMs: 400,
		...over,
	} as NetworkEvent;
}

describe('detectWaterfall', () => {
	it('hit com 3 sequenciais > 1s total', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, requestId: '1', url: 'http://x/a' }),
			n({ timestamp: 450, durationMs: 400, requestId: '2', url: 'http://x/b' }),
			n({ timestamp: 900, durationMs: 400, requestId: '3', url: 'http://x/c' }),
		];
		const hit = detectWaterfall(buf[2], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('waterfall');
		expect(hit!.severity).toBe('info');
		expect(hit!.evidenceEventIds).toHaveLength(3);
	});

	it('sem hit se duração total < 1s', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 100, requestId: '1' }),
			n({ timestamp: 110, durationMs: 100, requestId: '2' }),
			n({ timestamp: 220, durationMs: 100, requestId: '3' }),
		];
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('quebra se gap > 200ms', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, requestId: '1' }),
			n({ timestamp: 700, durationMs: 400, requestId: '2' }),
			n({ timestamp: 1200, durationMs: 400, requestId: '3' }),
		];
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('quebra ao mudar de host', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, url: 'http://a.test/' }),
			n({ timestamp: 450, durationMs: 400, url: 'http://b.test/' }),
			n({ timestamp: 900, durationMs: 400, url: 'http://b.test/' }),
		];
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('silencia se duração ausente', () => {
		const buf = [n({ timestamp: 0, durationMs: undefined, requestId: '1' })];
		expect(detectWaterfall(buf[0], buf)).toBeNull();
	});
});
