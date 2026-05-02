// ≥2 refreshes paralelos em <1s → severity error.

import type { AntipatternHit } from '../../types';
import { looksLikeRefreshUrl, type NetworkEvent, networkEventId } from '../fingerprint';

const WINDOW_MS = 1_000;
const MIN_OCCURRENCES = 2;

function endOf(ev: NetworkEvent): number {
	return ev.timestamp + (ev.durationMs ?? WINDOW_MS);
}

export function detectAuthRefreshStorm(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (!looksLikeRefreshUrl(ev.url)) return null;
	const cutoff = ev.timestamp - WINDOW_MS;
	const candidates = buffer.filter((b) => b.timestamp >= cutoff && looksLikeRefreshUrl(b.url));
	if (candidates.length < MIN_OCCURRENCES) return null;

	const overlaps = candidates.filter((b) => b !== ev && endOf(b) > ev.timestamp);
	if (overlaps.length < MIN_OCCURRENCES - 1) return null;

	const evidence = [...overlaps, ev];
	const start = Math.min(...evidence.map((e) => e.timestamp));
	const end = Math.max(...evidence.map(endOf));
	return {
		patternId: 'auth-refresh-storm',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: evidence.map(networkEventId),
		context: {
			summary: `${evidence.length}× refresh paralelo em ${end - start}ms (${ev.url})`,
		},
		suggestion:
			'Coalesce refreshes: única chamada compartilhada via promise/mutex. Múltiplas em paralelo invalidam tokens entre si.',
	};
}
