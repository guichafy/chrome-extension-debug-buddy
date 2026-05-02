import { describe, expect, it } from 'vitest';
import { detectAuthRefreshStorm } from '../detectors/authRefreshStorm';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'POST',
		url: 'http://x/api/auth/refresh',
		status: 200,
		durationMs: 800,
		...over,
	} as NetworkEvent;
}

describe('detectAuthRefreshStorm', () => {
	it('hit com 2 refreshes paralelos em <1s', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 800, requestId: '1' }),
			n({ timestamp: 200, durationMs: 800, requestId: '2' }),
		];
		const hit = detectAuthRefreshStorm(buf[1], buf);
		expect(hit).toBeTruthy();
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(2);
	});

	it('sem hit se URL não parece refresh', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/api/users', requestId: '1' }),
			n({ timestamp: 200, url: 'http://x/api/users', requestId: '2' }),
		];
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeNull();
	});

	it('sem hit se sequencial (não paralelo)', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 100, requestId: '1' }),
			n({ timestamp: 200, durationMs: 100, requestId: '2' }),
		];
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeNull();
	});

	it('aceita /oauth/token como refresh', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/oauth/token', durationMs: 800, requestId: '1' }),
			n({ timestamp: 100, url: 'http://x/oauth/token', durationMs: 800, requestId: '2' }),
		];
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeTruthy();
	});

	it('sem hit com apenas 1 ocorrência', () => {
		const buf = [n({ timestamp: 0, requestId: '1' })];
		expect(detectAuthRefreshStorm(buf[0], buf)).toBeNull();
	});
});
