// ≥4 tentativas da mesma request em <2s, todas com status de falha → severity error.

import type { AntipatternHit } from '../../types';
import { isFailureStatus, type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 2_000;
const MIN_OCCURRENCES = 4;

export function detectRetryStorm(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (!isFailureStatus(ev.status)) return null;
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const matches = buffer.filter(
		(b) => b.timestamp >= cutoff && reqFingerprint(b) === fp && isFailureStatus(b.status),
	);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'retry-storm',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			summary: `${matches.length}× ${ev.method} ${ev.url} falhando em ${end - start}ms (status ${ev.status})`,
		},
		suggestion: 'Aplique backoff exponencial e teto de retries; verifique se erro é retriável.',
	};
}
