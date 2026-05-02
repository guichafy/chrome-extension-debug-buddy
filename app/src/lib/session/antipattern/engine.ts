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
const MAX_EMITTED = 500; // FIFO cap de chaves de dedup; sessões longas não vazam memória

export class AntipatternEngine {
	private buffer: NetworkEvent[] = [];
	// Dedup: chave `patternId|start|end|summary`. Mantida como Set + queue
	// paralela para FIFO eviction quando exceder MAX_EMITTED. Set sem cap
	// crescia indefinidamente em sessões com muitos hits únicos.
	private emitted = new Set<string>();
	private emittedOrder: string[] = [];

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
			this.emittedOrder.push(key);
			if (this.emittedOrder.length > MAX_EMITTED) {
				const oldest = this.emittedOrder.shift();
				if (oldest !== undefined) this.emitted.delete(oldest);
			}
			hits.push(hit);
		}
		return hits;
	}

	reset(): void {
		this.buffer = [];
		this.emitted.clear();
		this.emittedOrder = [];
	}

	get bufferSize(): number {
		return this.buffer.length;
	}

	get emittedSize(): number {
		return this.emitted.size;
	}
}
