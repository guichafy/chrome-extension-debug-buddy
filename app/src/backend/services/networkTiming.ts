// Captura tempos de cada requisição via Network domain do Chrome DevTools Protocol
// e correlaciona com o `fetchRequestId` do Fetch.requestPaused.
//
// O `Fetch.requestPaused` (Response stage) chega antes do `Network.responseReceived`/
// `loadingFinished` na maioria dos casos — então não dá pra ler duration de forma
// síncrona. Esta classe acumula start/end conforme chegam, em qualquer ordem, e
// dispara `onDurationReady` assim que `start`, `end` e `fetchRequestId` estão
// disponíveis. Idempotente: cada requisição emite no máximo uma vez.

interface TimingEntry {
	start?: number;
	end?: number;
	fetchRequestId?: string;
}

const NETWORK_EVENTS = new Set([
	'Network.requestWillBeSent',
	'Network.responseReceived',
	'Network.loadingFinished',
	'Network.loadingFailed',
]);

// Cap defensivo: evita leak quando algumas requisições nunca recebem
// `loadingFinished`/`loadingFailed` (ex.: navegação cancelada antes do final).
// 2000 entradas cobre largamente uma página típica; ao estourar, descarta a mais
// antiga — quem perde duration apenas mostra "—" na UI.
const MAX_ENTRIES = 2000;

export class NetworkTimingTracker {
	private entries = new Map<string, TimingEntry>();
	private readonly onDurationReady: (fetchRequestId: string, durationMs: number) => void;

	constructor(onDurationReady: (fetchRequestId: string, durationMs: number) => void) {
		this.onDurationReady = onDurationReady;
	}

	handleNetworkEvent(message: string, params: { requestId?: string; timestamp?: number }): void {
		if (!NETWORK_EVENTS.has(message)) return;
		const networkId = params.requestId;
		if (!networkId) return;

		switch (message) {
			case 'Network.requestWillBeSent':
				this.recordStart(networkId, (params.timestamp ?? 0) * 1000);
				break;
			case 'Network.responseReceived':
				// Apenas marca end provisório (TTFB); loadingFinished sobrescreve depois.
				this.recordEnd(networkId, (params.timestamp ?? 0) * 1000, false);
				break;
			case 'Network.loadingFinished':
				this.recordEnd(networkId, (params.timestamp ?? 0) * 1000, true);
				break;
			case 'Network.loadingFailed':
				this.discardByNetworkId(networkId);
				break;
		}
	}

	linkFetchId(networkId: string | undefined, fetchRequestId: string): void {
		if (!networkId) return;
		const entry = this.entries.get(networkId) ?? {};
		entry.fetchRequestId = fetchRequestId;
		this.set(networkId, entry);
		this.tryEmit(networkId);
	}

	discardByNetworkId(networkId: string | undefined): void {
		if (!networkId) return;
		this.entries.delete(networkId);
	}

	reset(): void {
		this.entries.clear();
	}

	private recordStart(networkId: string, startMs: number): void {
		const entry = this.entries.get(networkId) ?? {};
		entry.start = startMs;
		this.set(networkId, entry);
		this.tryEmit(networkId);
	}

	private recordEnd(networkId: string, endMs: number, overwrite: boolean): void {
		const entry = this.entries.get(networkId);
		if (!entry) return;
		if (!overwrite && entry.end != null) return;
		entry.end = endMs;
		this.tryEmit(networkId);
	}

	private tryEmit(networkId: string): void {
		const entry = this.entries.get(networkId);
		if (!entry || entry.start == null || entry.end == null || !entry.fetchRequestId) return;
		const duration = Math.max(0, Math.round(entry.end - entry.start));
		this.entries.delete(networkId);
		this.onDurationReady(entry.fetchRequestId, duration);
	}

	private set(networkId: string, entry: TimingEntry): void {
		if (this.entries.size >= MAX_ENTRIES && !this.entries.has(networkId)) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(networkId, entry);
	}
}
