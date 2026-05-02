import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../types';

describe('NetworkEvent.client (Phase 5)', () => {
	it('aceita campo client opcional como string', () => {
		const ev: SessionEvent = {
			type: 'network',
			timestamp: 1,
			phaseId: 'p',
			requestId: 'r',
			method: 'GET',
			url: '/api/x',
			status: 200,
			client: 'angular-http',
		};
		expect(ev.type).toBe('network');
		if (ev.type === 'network') {
			expect(ev.client).toBe('angular-http');
		}
	});

	it('aceita NetworkEvent sem campo client (backward compat)', () => {
		const ev: SessionEvent = {
			type: 'network',
			timestamp: 1,
			phaseId: 'p',
			requestId: 'r',
			method: 'GET',
			url: '/api/x',
			status: 200,
		};
		if (ev.type === 'network') {
			expect(ev.client).toBeUndefined();
		}
	});
});

describe('StateChangeEvent.storeKind (Phase 5)', () => {
	it('aceita storeKind angular-signal e ngrx', () => {
		const a: SessionEvent = {
			type: 'state',
			timestamp: 1,
			phaseId: 'p',
			storeId: 'sig:1',
			storeKind: 'angular-signal',
			diffCompressed: 'xxx',
			sequenceNum: 1,
		};
		const b: SessionEvent = {
			type: 'state',
			timestamp: 1,
			phaseId: 'p',
			storeId: 'ngrx:1',
			storeKind: 'ngrx',
			diffCompressed: 'yyy',
			sequenceNum: 1,
		};
		if (a.type === 'state') expect(a.storeKind).toBe('angular-signal');
		if (b.type === 'state') expect(b.storeKind).toBe('ngrx');
	});
});
