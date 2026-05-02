import { describe, expect, it } from 'vitest';
import type { DetectionPhase, SessionEvent } from '../../types';
import { compressDiff, compressSnapshot, computeDiff } from '../diff';
import { reconstructStateAt } from '../replay';

function makePhase(): DetectionPhase {
	return {
		id: 'p1',
		startTimestamp: 0,
		endTimestamp: 1000,
		fingerprint: {
			framework: { name: 'react' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: 0,
			isProductionBuild: false,
		},
		pages: [],
		stateBaseline: {
			'redux:1': {
				storeId: 'redux:1',
				storeKind: 'redux',
				data: { count: 0 },
				timestamp: 100,
			},
		},
		stateKeyframes: [],
	};
}

function diffEvent(prev: unknown, next: unknown, t: number, seq: number): SessionEvent {
	return {
		type: 'state',
		timestamp: t,
		phaseId: 'p1',
		storeId: 'redux:1',
		storeKind: 'redux',
		diffCompressed: compressDiff(computeDiff(prev as object, next as object)),
		sequenceNum: seq,
	};
}

describe('reconstructStateAt', () => {
	it('retorna baseline quando playhead == baseline.timestamp', () => {
		const phase = makePhase();
		const out = reconstructStateAt(phase, 'redux:1', 100, []);
		expect(out).toEqual({ count: 0 });
	});

	it('aplica diffs sequenciais a partir do baseline até playhead', () => {
		const phase = makePhase();
		const events: SessionEvent[] = [
			diffEvent({ count: 0 }, { count: 1 }, 200, 1),
			diffEvent({ count: 1 }, { count: 2 }, 300, 2),
			diffEvent({ count: 2 }, { count: 3 }, 400, 3),
		];
		expect(reconstructStateAt(phase, 'redux:1', 250, events)).toEqual({ count: 1 });
		expect(reconstructStateAt(phase, 'redux:1', 350, events)).toEqual({ count: 2 });
		expect(reconstructStateAt(phase, 'redux:1', 1_000, events)).toEqual({ count: 3 });
	});

	it('usa keyframe mais próximo ≤ playhead', () => {
		const phase = makePhase();
		phase.stateKeyframes = [
			{
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: 500,
				phaseId: 'p1',
				snapshotCompressed: compressSnapshot({ count: 5 }),
			},
		];
		const events: SessionEvent[] = [diffEvent({ count: 5 }, { count: 6 }, 600, 6)];
		expect(reconstructStateAt(phase, 'redux:1', 550, events)).toEqual({ count: 5 });
		expect(reconstructStateAt(phase, 'redux:1', 650, events)).toEqual({ count: 6 });
	});

	it('retorna null quando não há baseline', () => {
		const phase = makePhase();
		expect(reconstructStateAt(phase, 'zustand:1', 100, [])).toBeNull();
	});

	it('binary search escolhe keyframe correto entre vários', () => {
		const phase = makePhase();
		phase.stateKeyframes = [
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 200, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'a' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 400, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'b' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 600, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'c' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 800, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'd' }) },
		];
		expect(reconstructStateAt(phase, 'redux:1', 500, [])).toEqual({ v: 'b' });
		expect(reconstructStateAt(phase, 'redux:1', 700, [])).toEqual({ v: 'c' });
		expect(reconstructStateAt(phase, 'redux:1', 900, [])).toEqual({ v: 'd' });
	});
});
