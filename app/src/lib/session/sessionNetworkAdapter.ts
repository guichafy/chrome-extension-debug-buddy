// Adapter puro: traduz `SessionEvent` (variante network) em linhas para a tabela
// do Replay. Filtra por cutoffTimestamp inclusivo para sincronizar com o playhead
// do rrweb-player.
//
// Não fabricamos campos ausentes (transferSize, mimeType, isMocked, etc.) —
// SessionEvent não persiste essa informação. As colunas do Replay refletem
// honestamente o que está disponível: timestamp / método / URL / status /
// duração / client / callsite. Se quisermos paridade total com Command Center,
// precisamos primeiro estender SessionEvent com mais campos (follow-up).

import type { SessionEvent } from './types';

export interface ReplayRequestRow {
	id: string;
	timestamp: number;
	method: string;
	url: string;
	status: number;
	durationMs?: number;
	client?: string;
	callsiteFile?: string;
}

export function sessionEventsToReplayRows(
	events: SessionEvent[],
	cutoffTimestamp: number,
): ReplayRequestRow[] {
	const rows: ReplayRequestRow[] = [];
	for (const ev of events) {
		if (ev.type !== 'network') continue;
		if (ev.timestamp > cutoffTimestamp) continue;
		rows.push({
			id: ev.requestId,
			timestamp: ev.timestamp,
			method: ev.method,
			url: ev.url,
			status: ev.status,
			durationMs: ev.durationMs,
			client: ev.client,
			callsiteFile: ev.callsite?.file,
		});
	}
	return rows;
}
