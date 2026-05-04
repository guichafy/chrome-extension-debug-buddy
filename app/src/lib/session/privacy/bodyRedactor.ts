import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';
import { compileRegexList } from './regexCompiler';

/**
 * Aplica a lista de regex de body em uma string.
 * Cada match é substituído por REDACTION_PLACEHOLDER.
 * Para conteúdo binário/non-string, o caller decide se chama ou não.
 */
export function redactBody(text: string, config: RedactionConfig): string {
	if (!config.enabled) return text;
	// Flag g obrigatória para varredura (replace global).
	const regexes = compileRegexList(config.bodyRegex, 'g');
	let out = text;
	for (const r of regexes) {
		out = out.replace(r, REDACTION_PLACEHOLDER);
	}
	return out;
}
