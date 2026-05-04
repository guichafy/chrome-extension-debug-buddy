// Adapter puro: traduz `SessionEvent` (variante network) em estruturas
// consumíveis pelo Replay. O cutoffTimestamp é inclusivo para sincronizar com o
// playhead do rrweb-player.

import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionEvent } from './types';

// Cap por body (request OU response): 64KB. Em sessão típica com ~120 requests
// pesadas isso ainda fica em ~7.5MB de bodies, deixando margem grande dentro
// do hard limit de 50MB. Bodies maiores são descartados com nota — quem precisa
// inspecionar um JSON de 1MB abre DevTools no momento da gravação.
const MAX_BODY_BYTES = 64 * 1024;

// MIME types persistidos em sessão. Tudo que não casar é descartado: imagens,
// fontes, vídeos, octet-stream, multipart/form-data (uploads de arquivo
// binário) etc não fazem sentido como string em replay e ainda podem inflar
// muito a sessão. application/*+json (ex.: application/ld+json) é texto.
const TEXT_MIME_RE =
	/^(text\/|application\/(json|javascript|xml|x-www-form-urlencoded|graphql|ld\+json)|application\/.*\+json|application\/.*\+xml)/;

function getContentType(headers: Record<string, string> | undefined): string | undefined {
	if (!headers) return undefined;
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === 'content-type') {
			return headers[key]?.split(';')[0]?.trim().toLowerCase();
		}
	}
	return undefined;
}

function isTextLike(mime: string | undefined): boolean {
	return mime !== undefined && TEXT_MIME_RE.test(mime);
}

/**
 * Constrói o snapshot de InterceptedResponse que vai dentro de um SessionEvent
 * network. Mantém todos os metadados (url/method/status/timing/headers) e
 * preserva bodies pequenos e textuais (≤ 64KB). Bodies grandes ou binários
 * são descartados com `bodyUnavailableReason` explicando a política — UI
 * mostra a explicação no drawer de Replay ao invés de fingir vazio.
 *
 * Idempotente: aplicar em snapshot já slim retorna outra cópia sem perda.
 *
 * Privacidade já foi aplicada upstream em persistRequest via
 * applyPrivacyToInterceptedResponse, então `r` aqui já passou pela máscara
 * configurada (Authorization, Cookie, Set-Cookie, etc.).
 */
export function applyBodyPolicy(r: InterceptedResponse): InterceptedResponse {
	const slim: InterceptedResponse = {
		url: r.url,
		method: r.method,
		status: r.status,
		statusText: r.statusText,
		headers: r.headers,
		mimeType: r.mimeType,
		type: r.type,
		timestamp: r.timestamp,
		isWaiting: r.isWaiting,
		isMocked: r.isMocked,
		isTransformed: r.isTransformed,
		captureError: r.captureError,
		bodyUnavailableReason: r.bodyUnavailableReason,
		duration: r.duration,
		durationSource: r.durationSource,
		mockLatencyMs: r.mockLatencyMs,
		networkTiming: r.networkTiming,
		generatedRuleId: r.generatedRuleId,
		editedAtRuntime: r.editedAtRuntime,
		appliedTypes: r.appliedTypes,
		delayMs: r.delayMs,
	};

	// Response body
	const responseHeaders = r.response?.headers ?? r.headers;
	const responseBody = r.response?.body ?? r.body;
	const responseMime = r.mimeType ?? getContentType(responseHeaders);
	if (responseBody !== undefined) {
		if (isTextLike(responseMime) && responseBody.length <= MAX_BODY_BYTES) {
			slim.response = { headers: responseHeaders ?? {}, body: responseBody };
			// Mantém alias top-level pra leitores legados (BodyViewer cai no
			// response.body primeiro, depois body — espelhar evita drift).
			slim.body = responseBody;
		} else {
			// Sobrescreve apenas se não havia razão prévia (capture failure tem prioridade).
			if (!r.bodyUnavailableReason) {
				slim.bodyUnavailableReason = !isTextLike(responseMime)
					? `Body de response omitido: tipo ${responseMime ?? 'desconhecido'} não é textual.`
					: `Body de response omitido: ${responseBody.length} bytes excede cap de replay (${MAX_BODY_BYTES} bytes).`;
			}
			// Preserva headers de response mesmo sem body — útil pra debug.
			if (responseHeaders) {
				slim.response = { headers: responseHeaders };
			}
		}
	} else if (r.response) {
		// Sem body originalmente, mas response existe (só headers). Preserva.
		slim.response = { headers: r.response.headers };
	}

	// Request side
	const requestHeaders = r.request?.headers;
	const requestPostData = r.request?.postData;
	const requestMime = getContentType(requestHeaders);
	if (requestHeaders) {
		if (
			requestPostData !== undefined &&
			isTextLike(requestMime) &&
			requestPostData.length <= MAX_BODY_BYTES
		) {
			slim.request = { headers: requestHeaders, postData: requestPostData };
		} else {
			// Headers sempre preservados (úteis sem o body); postData fica de fora.
			slim.request = { headers: requestHeaders };
		}
	}

	return slim;
}

/**
 * Mapeia eventos network → Record<id, InterceptedResponse> esperado pelo
 * RequestTimeline do Command Center. Filtra por cutoff inclusivo. Eventos
 * sem `request` snapshot (sessões pré-Fase 7) são omitidos — não fabricamos.
 */
export function sessionEventsToRequestsRecord(
	events: SessionEvent[],
	cutoffTimestamp: number,
): Record<string, InterceptedResponse> {
	const out: Record<string, InterceptedResponse> = {};
	for (const ev of events) {
		if (ev.type !== 'network') continue;
		if (ev.timestamp > cutoffTimestamp) continue;
		if (!ev.request) continue;
		out[ev.requestId] = ev.request;
	}
	return out;
}
