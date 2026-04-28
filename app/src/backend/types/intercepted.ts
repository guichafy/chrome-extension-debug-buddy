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
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}
