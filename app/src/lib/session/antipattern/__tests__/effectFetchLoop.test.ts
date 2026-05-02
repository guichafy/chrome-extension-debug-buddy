import { describe, expect, it } from 'vitest';
import { detectEffectFetchLoop } from '../detectors/effectFetchLoop';
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
		callsite: { file: 'http://x/app.js', line: 10, column: 5 },
		...over,
	} as NetworkEvent;
}

describe('detectEffectFetchLoop', () => {
	it('silencia sem callsite no evento atual', () => {
		const buf = [n({ timestamp: 0, callsite: undefined, requestId: '1' })];
		expect(detectEffectFetchLoop(buf[0], buf)).toBeNull();
	});

	it('silencia se ≥metade da janela não tem callsite', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 6; i++) {
			buf.push(n({ timestamp: i * 100, requestId: `s${i}`, callsite: undefined }));
		}
		for (let i = 0; i < 5; i++) {
			buf.push(n({ timestamp: 600 + i * 100, requestId: `c${i}` }));
		}
		expect(detectEffectFetchLoop(buf[buf.length - 1], buf)).toBeNull();
	});

	it('hit com 10 do mesmo callsite em <5s', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 10; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `r${i}` }));
		}
		const hit = detectEffectFetchLoop(buf[9], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('effect-fetch-loop');
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(10);
		expect(hit!.context.callsite?.raw.file).toBe('http://x/app.js');
	});

	it('separa por callsite', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 5; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `a${i}` }));
		}
		for (let i = 0; i < 5; i++) {
			buf.push(
				n({
					timestamp: 1000 + i * 200,
					requestId: `b${i}`,
					callsite: { file: 'http://x/app.js', line: 50, column: 1 },
				}),
			);
		}
		expect(detectEffectFetchLoop(buf[buf.length - 1], buf)).toBeNull();
	});

	it('sem hit com 9 ocorrências', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 9; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `r${i}` }));
		}
		expect(detectEffectFetchLoop(buf[8], buf)).toBeNull();
	});
});
