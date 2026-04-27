// Forma canônica das requisições interceptadas. Compartilhada entre
// background.ts (writer) e useResponses.ts (reader).
//
// Notas (issue #19): atualmente `headers` carrega APENAS os response
// headers — request headers não são armazenados separadamente. Qualquer
// UI que se refira a "request headers" está exibindo response headers.

export interface InterceptedResponse {
	url: string;
	method?: string;
	/** Dados enviados no corpo da requisição original (commit 0bb0778). */
	request?: {
		postData?: string;
	};
	status: number;
	statusText: string;
	headers: Record<string, string>;
	mimeType: string;
	type: string;
	timestamp: number;
	body?: string;
	isWaiting?: boolean;
	isMocked?: boolean;
	captureError?: string;
	bodyUnavailableReason?: string;
	/** Tempo total da requisição em milissegundos (capturado via Network domain do CDP). */
	duration?: number;
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}
