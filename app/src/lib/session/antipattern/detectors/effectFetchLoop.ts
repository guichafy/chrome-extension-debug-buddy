// ≥10 requests idênticas em <5s do mesmo callsite → severity error.

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 5_000;
const MIN_OCCURRENCES = 10;

function callsiteKey(ev: NetworkEvent): string | null {
	if (!ev.callsite) return null;
	return `${ev.callsite.file}:${ev.callsite.line}:${ev.callsite.column ?? '?'}`;
}

export function detectEffectFetchLoop(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	const key = callsiteKey(ev);
	if (!key) return null;
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const window = buffer.filter((b) => b.timestamp >= cutoff);
	const withoutCallsite = window.filter((b) => !b.callsite).length;
	if (withoutCallsite >= window.length / 2) return null;

	const matches = window.filter((b) => callsiteKey(b) === key && reqFingerprint(b) === fp);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'effect-fetch-loop',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			callsite: ev.callsite ? { raw: ev.callsite } : undefined,
			summary: `${matches.length}× ${ev.method} ${ev.url} do mesmo callsite em ${end - start}ms`,
		},
		suggestion:
			'Verifique dependências do useEffect/onChanges — provavelmente há objeto/array recriado a cada render disparando refetch.',
	};
}
