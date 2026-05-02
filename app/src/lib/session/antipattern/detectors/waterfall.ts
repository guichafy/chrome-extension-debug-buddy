// ≥3 requests sequenciais (sem overlap, gap < 200ms) para mesmo host,
// duração total > 1s → severity info.

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId } from '../fingerprint';

const MIN_CHAIN = 3;
const MAX_GAP_MS = 200;
const MIN_TOTAL_DURATION_MS = 1_000;

function host(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return '';
	}
}

function endOf(ev: NetworkEvent): number {
	return ev.timestamp + (ev.durationMs ?? 0);
}

export function detectWaterfall(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (ev.durationMs === undefined) return null;
	const targetHost = host(ev.url);
	if (!targetHost) return null;

	const chain: NetworkEvent[] = [ev];
	for (let i = buffer.length - 2; i >= 0; i--) {
		const prev = buffer[i];
		if (prev.durationMs === undefined) break;
		if (host(prev.url) !== targetHost) break;
		const next = chain[chain.length - 1];
		const gap = next.timestamp - endOf(prev);
		if (gap < 0 || gap > MAX_GAP_MS) break;
		chain.push(prev);
	}
	if (chain.length < MIN_CHAIN) return null;
	chain.reverse();
	const start = chain[0].timestamp;
	const end = endOf(chain[chain.length - 1]);
	if (end - start < MIN_TOTAL_DURATION_MS) return null;

	return {
		patternId: 'waterfall',
		severity: 'info',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: chain.map(networkEventId),
		context: {
			summary: `${chain.length} requests sequenciais para ${targetHost} em ${end - start}ms`,
		},
		suggestion:
			'Avalie paralelização (Promise.all, prefetch) ou bundling no backend (BFF / GraphQL).',
	};
}
