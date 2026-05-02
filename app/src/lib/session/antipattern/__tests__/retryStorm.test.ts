import { describe, expect, it } from 'vitest';
import { detectRetryStorm } from '../detectors/retryStorm';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 500,
		...over,
	} as NetworkEvent;
}

describe('detectRetryStorm', () => {
	it('hit com 4 falhas em <2s', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 400, requestId: '2' }),
			n({ timestamp: 900, requestId: '3' }),
			n({ timestamp: 1500, requestId: '4' }),
		];
		const hit = detectRetryStorm(buf[3], buf);
		expect(hit).toBeTruthy();
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(4);
	});

	it('sem hit se evento atual é 200', () => {
		const buf = [
			n({ timestamp: 0, status: 500, requestId: '1' }),
			n({ timestamp: 400, status: 500, requestId: '2' }),
			n({ timestamp: 900, status: 500, requestId: '3' }),
			n({ timestamp: 1500, status: 200, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});

	it('sem hit se uma das tentativas teve sucesso', () => {
		const buf = [
			n({ timestamp: 0, status: 500, requestId: '1' }),
			n({ timestamp: 400, status: 200, requestId: '2' }),
			n({ timestamp: 900, status: 500, requestId: '3' }),
			n({ timestamp: 1500, status: 500, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});

	it('considera status=0 como falha', () => {
		const buf = [
			n({ timestamp: 0, status: 0, requestId: '1' }),
			n({ timestamp: 200, status: 0, requestId: '2' }),
			n({ timestamp: 400, status: 0, requestId: '3' }),
			n({ timestamp: 600, status: 0, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeTruthy();
	});

	it('sem hit fora da janela 2s', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 500, requestId: '2' }),
			n({ timestamp: 1000, requestId: '3' }),
			n({ timestamp: 2500, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});
});
