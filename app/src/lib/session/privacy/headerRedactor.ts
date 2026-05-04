import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';
import { compileRegexList } from './regexCompiler';

export interface HeaderMap {
	[name: string]: string;
}

/**
 * Redige um mapa de headers conforme a config.
 * - Match em headerKeys é case-insensitive (HTTP headers são case-insensitive).
 * - Match em headerRegex é case-insensitive.
 * Headers redigidos têm valor substituído por '[REDACTED]'; nome preservado para auditoria.
 */
export function redactHeaders(headers: HeaderMap, config: RedactionConfig): HeaderMap {
	if (!config.enabled) return headers;

	const keySet = new Set(config.headerKeys.map((k) => k.toLowerCase()));
	const regexes = compileRegexList(config.headerRegex, 'i');
	const out: HeaderMap = {};

	for (const [name, value] of Object.entries(headers)) {
		const lower = name.toLowerCase();
		const matchKey = keySet.has(lower);
		const matchRegex = regexes.some((r) => r.test(lower));
		out[name] = matchKey || matchRegex ? REDACTION_PLACEHOLDER : value;
	}

	return out;
}
