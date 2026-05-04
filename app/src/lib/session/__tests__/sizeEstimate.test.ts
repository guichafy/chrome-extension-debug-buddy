import { describe, expect, it } from 'vitest';
import { estimateEventBytes } from '../sizeEstimate';
import type { SessionEvent } from '../types';

describe('estimateEventBytes', () => {
	it('detection event tem tamanho pequeno', () => {
		const ev: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		expect(estimateEventBytes(ev)).toBeGreaterThan(0);
		expect(estimateEventBytes(ev)).toBeLessThan(200);
	});

	it('network event maior que detection (mais campos)', () => {
		const detection: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		const network: SessionEvent = {
			type: 'network',
			timestamp: 1,
			phaseId: 'p',
			requestId: 'r1',
			method: 'GET',
			url: 'https://example.com/api/users?id=42&format=json',
			status: 200,
			durationMs: 123,
			bodyRef: 'blob:abc',
		};
		expect(estimateEventBytes(network)).toBeGreaterThan(estimateEventBytes(detection));
	});

	it('console com payload longo aumenta tamanho', () => {
		const small: SessionEvent = {
			type: 'console',
			timestamp: 1,
			phaseId: 'p',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hi' }],
		};
		const big: SessionEvent = {
			type: 'console',
			timestamp: 1,
			phaseId: 'p',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'x'.repeat(5000) }],
		};
		expect(estimateEventBytes(big)).toBeGreaterThan(estimateEventBytes(small) + 4000);
	});
});
