// Forma canônica das requisições interceptadas. Compartilhada entre
// background.ts (writer) e useResponses.ts (reader).

export interface InterceptedResponse {
	url: string;
	method?: string;
	/** Dados enviados na requisição original. */
	request?: {
		headers?: Record<string, string>;
		postData?: string;
	};
	response?: {
		headers: Record<string, string>;
		body?: string;
	};
	status: number;
	statusText: string;
	/** Alias legado de response.headers, mantido para leitura de registros antigos. */
	headers: Record<string, string>;
	mimeType?: string;
	type: string;
	timestamp: number;
	/** Alias legado de response.body, mantido para leitura de registros antigos. */
	body?: string;
	isWaiting?: boolean;
	isMocked?: boolean;
	captureError?: string;
	bodyUnavailableReason?: string;
	/** Tempo total da requisição em milissegundos (capturado via Network domain do CDP). */
	duration?: number;
	durationSource?: 'network' | 'mock';
	mockLatencyMs?: number;
	/**
	 * Métricas granulares Google de rede capturadas via CDP `Network.responseReceived` +
	 * `Network.loadingFinished`. Ausente para mocks (não passou pela rede), requests
	 * legadas no IndexedDB, e casos onde o evento não chegou. Campos individuais
	 * também podem ser omitidos quando o dado correspondente não existe (ex.: `tlsMs`
	 * em http puro). Regra do projeto: nada de defaults fictícios — ausência é `undefined`.
	 */
	networkTiming?: {
		ttfbMs?: number;
		dnsMs?: number;
		tcpMs?: number;
		tlsMs?: number;
		transferSize?: number;
		encodedDataLength?: number;
		fromDiskCache?: boolean;
		fromServiceWorker?: boolean;
	};
	/** ID da regra gerada via Quick Mock a partir desta request, quando aplicável. */
	generatedRuleId?: string;
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}
