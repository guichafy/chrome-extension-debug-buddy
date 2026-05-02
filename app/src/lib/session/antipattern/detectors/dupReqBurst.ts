// Mesmo fingerprint (método+URL+hash body) ≥3x em <500ms → severity warn.

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 500;
const MIN_OCCURRENCES = 3;

export function detectDupReqBurst(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const matches = buffer.filter((b) => b.timestamp >= cutoff && reqFingerprint(b) === fp);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'dup-req-burst',
		severity: 'warn',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			summary: `${matches.length}× ${ev.method} ${ev.url} em ${end - start}ms`,
		},
		suggestion: 'Verifique deduplicação no client (debounce, cache, request coalescing).',
	};
}
