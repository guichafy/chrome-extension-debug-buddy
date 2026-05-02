// Forma canônica das requisições interceptadas. Compartilhada entre
// background.ts (writer) e useResponses.ts (reader).

// Tipos de regra/efeito aplicados a uma requisição. Uma request pode ter mais
// de um tipo (ex.: `['mock', 'latency']` quando MockAction tem `latency`, ou
// `['transform', 'latency']` no futuro). `proxy` significa que nenhuma regra
// casou — é mutuamente exclusivo com os demais.
export type AppliedType = 'proxy' | 'mock' | 'transform' | 'breakpoint' | 'latency';

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
	/**
	 * Marca respostas alteradas em runtime por uma regra de Transform (declarativo
	 * ou advanced). Diferente de `isMocked` (mock substitui body inteiro sem
	 * chamar a rede) — transform passa pela rede, captura o body original e
	 * reescreve antes de devolver ao cliente.
	 */
	isTransformed?: boolean;
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
	/**
	 * Marca uma resposta que foi editada one-shot via `EditResponseSheet` antes
	 * de ser aprovada. Diferente de `isMocked` (regra persistente) — esta edição
	 * ocorreu apenas na requisição em questão. Usada pelo histórico para mostrar
	 * um badge "editada" distinguindo edição manual de modificações via mock.
	 */
	editedAtRuntime?: boolean;
	/**
	 * Tipos de regra efetivamente aplicados pela engine de interceptação.
	 * Populado pelo background em todos os pontos de persistência (mock,
	 * transform, breakpoint, delay, pass-through e captures que falharam).
	 * Quando ausente, a UI assume `['proxy']` (passou sem regra) — não
	 * tentamos reconstruir tipos a partir de flags antigas.
	 */
	appliedTypes?: AppliedType[];
	/**
	 * Latência standalone aplicada por uma regra do tipo Delay (em ms). Diferente
	 * de `mockLatencyMs` (delay embutido no Mock). Permite à UI exibir quanto
	 * tempo a request foi atrasada sem confundir com mock.
	 */
	delayMs?: number;
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}
