import type { DetectionPhase, SessionEvent } from '../types';
import { applyDiff, decompressDiff, decompressSnapshot } from './diff';

/**
 * Reconstrói o estado de um store no instante `playheadTimestamp` (timestamp absoluto).
 * Estratégia: encontra o keyframe mais próximo `≤ playheadTimestamp` (ou cai no baseline)
 * e aplica todos os diffs subsequentes desse store até `playheadTimestamp`.
 *
 * Retorna `null` se não há baseline (nenhuma mudança observada antes do playhead).
 */
export function reconstructStateAt(
	phase: DetectionPhase,
	storeId: string,
	playheadTimestamp: number,
	stateEvents: SessionEvent[],
): unknown {
	const baseline = phase.stateBaseline?.[storeId];
	if (!baseline) return null;

	const keyframes = (phase.stateKeyframes ?? []).filter((k) => k.storeId === storeId);
	let anchor: { state: unknown; timestamp: number };
	if (keyframes.length === 0 || keyframes[0].timestamp > playheadTimestamp) {
		anchor = { state: baseline.data, timestamp: baseline.timestamp };
	} else {
		const idx = binarySearchLE(keyframes, playheadTimestamp, (k) => k.timestamp);
		const kf = keyframes[idx];
		anchor = { state: decompressSnapshot(kf.snapshotCompressed), timestamp: kf.timestamp };
	}

	let cur = anchor.state;
	for (const ev of stateEvents) {
		if (ev.type !== 'state') continue;
		if (ev.storeId !== storeId) continue;
		if (ev.timestamp <= anchor.timestamp) continue;
		if (ev.timestamp > playheadTimestamp) break;
		const ops = decompressDiff(ev.diffCompressed);
		cur = applyDiff(cur, ops);
	}
	return cur;
}

function binarySearchLE<T>(arr: T[], target: number, key: (x: T) => number): number {
	let lo = 0;
	let hi = arr.length - 1;
	let best = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (key(arr[mid]) <= target) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return best;
}
