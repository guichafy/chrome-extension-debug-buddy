// Engine streaming cronológico com janela móvel.
// Cada detector é uma função pura independente: recebe (newEvent, buffer) e
// devolve AntipatternHit | null. Engine aplica todos a cada novo evento e
// retorna lista de hits emergentes.
//
// Não silencia erros: se um detector lança, log + re-throw. Testes garantem
// que detectores nunca lançam para inputs válidos.

import type { AntipatternHit, SessionEvent } from '../types';
import { isNetworkEvent, type NetworkEvent } from './fingerprint';

import { detectDupReqBurst } from './detectors/dupReqBurst';
import { detectRetryStorm } from './detectors/retryStorm';
import { detectEffectFetchLoop } from './detectors/effectFetchLoop';
import { detectWaterfall } from './detectors/waterfall';
import { detectAuthRefreshStorm } from './detectors/authRefreshStorm';

export type Detector = (ev: NetworkEvent, buffer: NetworkEvent[]) => AntipatternHit | null;

const DEFAULT_DETECTORS: Detector[] = [
	detectDupReqBurst,
	detectRetryStorm,
	detectEffectFetchLoop,
	detectWaterfall,
	detectAuthRefreshStorm,
];

const WINDOW_MS = 5_000; // maior janela usada (effect-fetch-loop)
const MAX_BUFFER = 500; // teto de segurança

export class AntipatternEngine {
	private buffer: NetworkEvent[] = [];
	private emitted = new Set<string>(); // dedup: patternId|start|end|summary

	constructor(private readonly detectors: Detector[] = DEFAULT_DETECTORS) {}

	pushEvent(ev: SessionEvent): AntipatternHit[] {
		if (!isNetworkEvent(ev)) return [];

		// FIFO eviction baseado em janela + teto absoluto
		const cutoff = ev.timestamp - WINDOW_MS;
		while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
			this.buffer.shift();
		}
		while (this.buffer.length >= MAX_BUFFER) {
			this.buffer.shift();
		}

		this.buffer.push(ev);

		const hits: AntipatternHit[] = [];
		for (const detector of this.detectors) {
			const hit = detector(ev, this.buffer);
			if (!hit) continue;
			const key = `${hit.patternId}|${hit.startTimestamp}|${hit.endTimestamp}|${hit.context.summary}`;
			if (this.emitted.has(key)) continue;
			this.emitted.add(key);
			hits.push(hit);
		}
		return hits;
	}

	reset(): void {
		this.buffer = [];
		this.emitted.clear();
	}

	get bufferSize(): number {
		return this.buffer.length;
	}
}
