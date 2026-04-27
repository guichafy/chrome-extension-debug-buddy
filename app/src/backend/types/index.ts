// Tipos para padrões de URL
export interface UrlPattern {
	url: string;
	method: string;
	headerType?: string;
	headerName?: string;
	headerValue?: string;
	enabled?: boolean;
	isRegex?: boolean;
}

// Tipos para respostas interceptadas
export interface InterceptedResponse {
	url: string;
	/** Dados enviados no corpo da requisição original */
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
	/** Tempo total da requisição em milissegundos (capturado via Network domain do CDP) */
	duration?: number;
}

// Tipos para modificações de resposta
export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}

// Tipos para mocks
export interface MockConfig {
	urlPattern: string;
	method: string;
	status: number;
	headers: Record<string, string>;
	body: string;
	createdAt: number;
	enabled: boolean;
}

// Tipos para mensagens entre scripts
export type MessageAction =
	| 'getMocks'
	| 'startDebugging'
	| 'stopDebugging'
	| 'getDebuggingStatus'
	| 'getPendingResponses'
	| 'getResponseDetails'
	| 'approveResponse'
	| 'newPendingResponse'
	| 'responseBodyReady'
	| 'newRequest'
	| 'requestUpdated';

export interface Message {
	action: MessageAction;
	tabId?: number;
	requestId?: string;
	url?: string;
	status?: number;
	statusText?: string;
	type?: string;
	mimeType?: string;
	body?: string;
	modifications?: ResponseModifications;
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
	response?: InterceptedResponse;
	mocks?: MockConfig[];
}
