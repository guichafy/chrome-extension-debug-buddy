// Captura tempos de cada requisição via Network domain do Chrome DevTools Protocol
// e correlaciona com o `fetchRequestId` do Fetch.requestPaused.
//
// O `Fetch.requestPaused` (Response stage) chega antes do `Network.responseReceived`/
// `loadingFinished` na maioria dos casos — então não dá pra ler duration de forma
// síncrona. Esta classe acumula start/end conforme chegam, em qualquer ordem, e
// dispara `onDurationReady` assim que `start`, `end` e `fetchRequestId` estão
// disponíveis. Idempotente: cada requisição emite no máximo uma vez.
//
// O segundo callback opcional, `onMetricsReady`, recebe métricas granulares Google
// (TTFB/DNS/TCP/TLS/transferSize/cache) derivadas de `Network.responseReceived.timing`
// e `Network.loadingFinished.encodedDataLength`. Também idempotente, também 1× por request.

// Forma compacta retornada por `deriveNetworkTiming`. Todos os campos opcionais
// — só vão no objeto quando o dado existe de fato. Regra do projeto: ausência ≠ 0.
export interface NetworkTiming {
	ttfbMs?: number;
	dnsMs?: number;
	tcpMs?: number;
	tlsMs?: number;
	transferSize?: number;
	encodedDataLength?: number;
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

// Subset do `Network.ResponseReceived.response` que importa para timing.
export interface ResponseTimingRaw {
	dnsStart?: number;
	dnsEnd?: number;
	connectStart?: number;
	connectEnd?: number;
	sslStart?: number;
	sslEnd?: number;
	receiveHeadersEnd?: number;
}

export interface ResponseFlagsRaw {
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

// Diferença "segura" — retorna o intervalo apenas quando ambos os tempos existem
// e são >= 0. CDP usa -1 para indicar "não houve esta fase" (ex.: sslStart = -1
// em http puro). Fora desse caso, undefined deixa o helper omitir o campo.
function safeDelta(start: number | undefined, end: number | undefined): number | undefined {
	if (start == null || end == null) return undefined;
	if (start < 0 || end < 0) return undefined;
	const delta = Math.round(end - start);
	if (delta < 0) return undefined;
	return delta;
}

export function deriveNetworkTiming(
	timing: ResponseTimingRaw | undefined,
	encodedDataLength: number | undefined,
	flags: ResponseFlagsRaw,
): NetworkTiming | undefined {
	const result: NetworkTiming = {};

	if (timing) {
		const ttfbMs = safeDelta(timing.dnsStart, timing.receiveHeadersEnd);
		if (ttfbMs !== undefined) result.ttfbMs = ttfbMs;
		const dnsMs = safeDelta(timing.dnsStart, timing.dnsEnd);
		if (dnsMs !== undefined) result.dnsMs = dnsMs;
		const tcpMs = safeDelta(timing.connectStart, timing.connectEnd);
		if (tcpMs !== undefined) result.tcpMs = tcpMs;
		const tlsMs = safeDelta(timing.sslStart, timing.sslEnd);
		if (tlsMs !== undefined) result.tlsMs = tlsMs;
	}

	if (encodedDataLength !== undefined) {
		result.transferSize = encodedDataLength;
		result.encodedDataLength = encodedDataLength;
	}

	if (flags.fromDiskCache === true) result.fromDiskCache = true;
	if (flags.fromServiceWorker === true) result.fromServiceWorker = true;

	// Retorna undefined apenas quando NENHUM input chegou. Se `timing` foi passado
	// (mesmo que produza zero campos por -1s), entendemos que houve uma resposta
	// real e devolvemos {}.
	const hasInput =
		timing != null ||
		encodedDataLength !== undefined ||
		flags.fromDiskCache === true ||
		flags.fromServiceWorker === true;
	if (!hasInput) return undefined;
	return result;
}

interface TimingEntry {
	start?: number;
	end?: number;
	fetchRequestId?: string;
	durationEmitted?: boolean;
	metricsEmitted?: boolean;
	loadingFinishedFlag?: boolean;
	responseReceivedFlag?: boolean;
	responseTiming?: ResponseTimingRaw;
	encodedDataLength?: number;
	flags?: ResponseFlagsRaw;
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
	private readonly onMetricsReady?: (fetchRequestId: string, timing: NetworkTiming) => void;

	constructor(
		onDurationReady: (fetchRequestId: string, durationMs: number) => void,
		onMetricsReady?: (fetchRequestId: string, timing: NetworkTiming) => void,
	) {
		this.onDurationReady = onDurationReady;
		this.onMetricsReady = onMetricsReady;
	}

	handleNetworkEvent(
		message: string,
		params: {
			requestId?: string;
			timestamp?: number;
			redirectResponse?: unknown;
			response?: {
				timing?: ResponseTimingRaw;
				fromDiskCache?: boolean;
				fromServiceWorker?: boolean;
			};
			encodedDataLength?: number;
		},
	): void {
		if (!NETWORK_EVENTS.has(message)) return;
		const networkId = params.requestId;
		if (!networkId) return;
		const ts = (params.timestamp ?? 0) * 1000;

		switch (message) {
			case 'Network.requestWillBeSent':
				// Para redirects (3xx), o Chrome reusa o mesmo networkId e dispara
				// `requestWillBeSent` novamente com `redirectResponse` preenchido.
				// O timestamp deste evento é, simultaneamente, o fim do hop anterior
				// (ex.: 301) e o início do próximo hop (ex.: 200 do destino do redirect).
				// Sem este tratamento, recordStart sobrescreveria o start original e
				// o 301 nunca teria duration emitida.
				if (params.redirectResponse) {
					this.handleRedirect(networkId, ts);
				} else {
					this.recordStart(networkId, ts);
				}
				break;
			case 'Network.responseReceived': {
				// Apenas marca end provisório (TTFB); loadingFinished sobrescreve depois.
				this.recordEnd(networkId, ts, false);
				const entry = this.entries.get(networkId);
				if (entry) {
					entry.responseReceivedFlag = true;
					if (params.response?.timing) entry.responseTiming = params.response.timing;
					entry.flags = {
						fromDiskCache: params.response?.fromDiskCache,
						fromServiceWorker: params.response?.fromServiceWorker,
					};
					this.tryEmit(networkId);
				}
				break;
			}
			case 'Network.loadingFinished': {
				this.recordEnd(networkId, ts, true);
				const entry = this.entries.get(networkId);
				if (entry) {
					entry.loadingFinishedFlag = true;
					if (params.encodedDataLength !== undefined) {
						entry.encodedDataLength = params.encodedDataLength;
					}
					this.tryEmit(networkId);
				}
				break;
			}
			case 'Network.loadingFailed':
				this.discardByNetworkId(networkId);
				break;
		}
	}

	private handleRedirect(networkId: string, redirectTs: number): void {
		const entry = this.entries.get(networkId);
		if (entry?.start != null && entry.fetchRequestId && !entry.durationEmitted) {
			const duration = Math.max(0, Math.round(redirectTs - entry.start));
			this.onDurationReady(entry.fetchRequestId, duration);
		}
		// Reseta a entrada para o próximo hop: novo start = momento do redirect, sem
		// fetchRequestId nem end (serão preenchidos pelo próximo Fetch.requestPaused
		// e pelo loadingFinished/responseReceived seguinte).
		this.set(networkId, { start: redirectTs });
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
	}

	private tryEmit(networkId: string): void {
		const entry = this.entries.get(networkId);
		if (!entry) return;

		// Duration: precisa de start + end + fetchId
		if (
			!entry.durationEmitted &&
			entry.start != null &&
			entry.end != null &&
			entry.fetchRequestId
		) {
			const duration = Math.max(0, Math.round(entry.end - entry.start));
			entry.durationEmitted = true;
			this.onDurationReady(entry.fetchRequestId, duration);
		}

		// Métricas: emitidas após responseReceived + loadingFinished + fetchId.
		// Exigir responseReceivedFlag previne dispatching em entradas re-criadas
		// post-discard (ex.: linkFetchId após loadingFailed cria entrada vazia).
		if (
			this.onMetricsReady &&
			!entry.metricsEmitted &&
			entry.responseReceivedFlag &&
			entry.loadingFinishedFlag &&
			entry.fetchRequestId
		) {
			const timing = deriveNetworkTiming(
				entry.responseTiming,
				entry.encodedDataLength,
				entry.flags ?? {},
			);
			entry.metricsEmitted = true;
			if (timing) this.onMetricsReady(entry.fetchRequestId, timing);
		}

		// Limpa quando ambos os ciclos foram concluídos (ou quando metrics não está em uso)
		const metricsDone = !this.onMetricsReady || entry.metricsEmitted;
		if (entry.durationEmitted && metricsDone) {
			this.entries.delete(networkId);
		}
	}

	private set(networkId: string, entry: TimingEntry): void {
		if (this.entries.size >= MAX_ENTRIES && !this.entries.has(networkId)) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(networkId, entry);
	}
}
