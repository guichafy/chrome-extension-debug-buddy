import { describe, expect, it } from 'vitest';
import { detectDupReqBurst } from '../detectors/dupReqBurst';
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
		...over,
	} as NetworkEvent;
}

describe('detectDupReqBurst', () => {
	it('hit quando ≥3 mesma URL em <500ms', () => {
		const buf = [
			n({ timestamp: 100, requestId: '1' }),
			n({ timestamp: 200, requestId: '2' }),
			n({ timestamp: 350, requestId: '3' }),
		];
		const hit = detectDupReqBurst(buf[2], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('dup-req-burst');
		expect(hit!.severity).toBe('warn');
		expect(hit!.evidenceEventIds).toHaveLength(3);
		expect(hit!.context.summary).toContain('3×');
	});

	it('sem hit com 2 ocorrências', () => {
		const buf = [n({ timestamp: 100, requestId: '1' }), n({ timestamp: 200, requestId: '2' })];
		expect(detectDupReqBurst(buf[1], buf)).toBeNull();
	});

	it('sem hit quando janela > 500ms', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 200, requestId: '2' }),
			n({ timestamp: 600, requestId: '3' }),
		];
		expect(detectDupReqBurst(buf[2], buf)).toBeNull();
	});

	it('separa por método', () => {
		const buf = [
			n({ timestamp: 0, method: 'GET', requestId: '1' }),
			n({ timestamp: 100, method: 'POST', requestId: '2' }),
			n({ timestamp: 200, method: 'POST', requestId: '3' }),
			n({ timestamp: 300, method: 'POST', requestId: '4' }),
		];
		const hit = detectDupReqBurst(buf[3], buf);
		expect(hit).toBeTruthy();
		expect(hit!.evidenceEventIds).toHaveLength(3);
	});

	it('separa por URL', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/a', requestId: '1' }),
			n({ timestamp: 100, url: 'http://x/b', requestId: '2' }),
			n({ timestamp: 200, url: 'http://x/a', requestId: '3' }),
		];
		expect(detectDupReqBurst(buf[2], buf)).toBeNull();
	});
});
