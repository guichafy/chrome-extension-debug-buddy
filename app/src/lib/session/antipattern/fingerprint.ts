// Helpers puros usados por múltiplos detectores.

import type { SessionEvent } from '../types';

export type NetworkEvent = Extract<SessionEvent, { type: 'network' }>;

export function isNetworkEvent(ev: SessionEvent): ev is NetworkEvent {
	return ev.type === 'network';
}

export function networkEventId(ev: NetworkEvent): string {
	return `${ev.requestId}@${ev.timestamp}`;
}

// Hash determinístico simples (DJB2). Suficiente para fingerprint de body
// idêntico em janela curta — não é crypto.
export function djb2(str: string): string {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = ((h << 5) + h + str.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(36);
}

// Fingerprint = método+URL+hash(body). Como NetworkEvent não tem body
// inline (só bodyRef), em Phase 3 usamos método+URL como aproximação;
// detectores que precisam de body checam bodyRef quando disponível.
export function reqFingerprint(ev: NetworkEvent): string {
	return `${ev.method} ${ev.url}${ev.bodyRef ? `#${djb2(ev.bodyRef)}` : ''}`;
}

const DEFAULT_REFRESH_PATTERNS: RegExp[] = [
	/\/refresh(\b|$|\?)/i,
	/\/oauth\/token(\b|$|\?)/i,
	/\/auth\/refresh(\b|$|\?)/i,
	/\/sessions\/refresh(\b|$|\?)/i,
	/\/token\/refresh(\b|$|\?)/i,
];

export function looksLikeRefreshUrl(url: string, patterns = DEFAULT_REFRESH_PATTERNS): boolean {
	return patterns.some((re) => re.test(url));
}

export function isFailureStatus(status: number): boolean {
	// 0 = network error / aborted; 4xx/5xx = falha aplicacional
	return status === 0 || status >= 400;
}
