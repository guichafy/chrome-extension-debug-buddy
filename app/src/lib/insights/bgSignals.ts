import type { InterceptedResponse } from '@/types/intercepted';
import type { Signal } from './types';

interface ParsedCookie {
	name: string;
	value: string;
}

export function parseSetCookieHeader(raw: string): ParsedCookie[] {
	if (!raw) return [];
	// CDP entrega Set-Cookie de várias formas: única string com '\n', ou
	// uma única linha. Tratamos ambos.
	const lines = raw.includes('\n') ? raw.split('\n') : [raw];
	const out: ParsedCookie[] = [];
	for (const line of lines) {
		const first = line.split(';')[0]?.trim();
		if (!first) continue;
		const eq = first.indexOf('=');
		if (eq === -1) continue;
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		if (name) out.push({ name, value });
	}
	return out;
}

export function extractBackgroundSignals(
	intercepted: InterceptedResponse,
): Signal[] {
	const out: Signal[] = [];

	// 1. URL — diferencia top-frame document, scriptSrc, xhr/fetch.
	// Outros resourceTypes (image/stylesheet/font/media/other) não geram signal —
	// catalog patterns desses kinds não casam URLs assim por design.
	const rt = (intercepted.type ?? '').toLowerCase();
	if (rt === 'script') {
		out.push({ kind: 'scriptSrc', value: intercepted.url });
	} else if (rt === 'xhr' || rt === 'fetch') {
		out.push({ kind: 'xhr', value: intercepted.url });
	} else if (rt === 'document') {
		out.push({ kind: 'url', value: intercepted.url });
	}

	// 2. Response headers — keys lowercased
	// Prefere response.headers (canônico) sobre headers (alias legado para
	// registros antigos) — InterceptedResponse mantém ambos.
	const headers = intercepted.response?.headers ?? intercepted.headers;
	if (headers) {
		for (const [k, v] of Object.entries(headers)) {
			out.push({ kind: 'header', name: k.toLowerCase(), value: v });
		}
	}

	// 3. Set-Cookie parsing — tenta variantes de casing.
	const setCookieRaw =
		headers?.['set-cookie'] ?? headers?.['Set-Cookie'] ?? headers?.['SET-COOKIE'];
	if (setCookieRaw) {
		for (const cookie of parseSetCookieHeader(setCookieRaw)) {
			out.push({ kind: 'cookie', name: cookie.name, value: cookie.value });
		}
	}

	return out;
}
