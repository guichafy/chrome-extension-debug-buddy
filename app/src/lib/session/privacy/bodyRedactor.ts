import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

function compileRegexList(list: string[]): RegExp[] {
	// Flag g obrigatório para varredura (replaceAll). Lança SyntaxError em regex inválida — sem fallback.
	return list.map((r) => new RegExp(r, 'g'));
}

/**
 * Aplica a lista de regex de body em uma string.
 * Cada match é substituído por REDACTION_PLACEHOLDER.
 * Para conteúdo binário/non-string, o caller decide se chama ou não.
 */
export function redactBody(text: string, config: RedactionConfig): string {
	if (!config.enabled) return text;
	const regexes = compileRegexList(config.bodyRegex);
	let out = text;
	for (const r of regexes) {
		out = out.replace(r, REDACTION_PLACEHOLDER);
	}
	return out;
}
