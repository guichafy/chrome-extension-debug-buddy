import type { ConsoleArgPreview, RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

function compileRegexList(list: string[]): RegExp[] {
	// Lança SyntaxError em regex inválida — sem fallback (regra do projeto).
	return list.map((r) => new RegExp(r, 'g'));
}

/**
 * Sanitiza um array de ConsoleArgPreview substituindo matches em `description`
 * (e em `preview.properties[].value`, se presente) por REDACTION_PLACEHOLDER.
 */
export function redactConsoleArgs(
	args: ConsoleArgPreview[],
	config: RedactionConfig,
): ConsoleArgPreview[] {
	if (!config.enabled || !config.consoleEnabled) return args;
	const regexes = compileRegexList(config.consoleRegex);

	const sweep = (s: string): string => {
		let out = s;
		for (const r of regexes) {
			// reset lastIndex porque RegExp com flag g é stateful entre chamadas.
			r.lastIndex = 0;
			out = out.replace(r, REDACTION_PLACEHOLDER);
		}
		return out;
	};

	return args.map((arg) => ({
		...arg,
		description: sweep(arg.description),
		preview: arg.preview
			? {
					...arg.preview,
					properties: arg.preview.properties.map((p) => ({
						...p,
						value: p.value === undefined ? undefined : sweep(p.value),
					})),
				}
			: undefined,
	}));
}
