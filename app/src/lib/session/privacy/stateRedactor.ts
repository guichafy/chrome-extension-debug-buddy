import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

/**
 * Converte um glob simples ('auth.*.token') em regex que casa com paths JSON.
 * '*' = qualquer segmento; '**' = qualquer profundidade.
 */
function globToRegex(glob: string): RegExp {
	// 1) Escapa todos os meta-chars de regex (incluindo `*` para que o passo 2 case
	//    com `\*` literal). 2) `**` → `.+` (qualquer profundidade). 3) `*` → `[^.]+`
	//    (um único segmento, sem cruzar `.`).
	const escaped = glob
		.replace(/[-/\\^$+?.()|[\]{}*]/g, '\\$&')
		.replace(/\\\*\\\*/g, '.+')
		.replace(/\\\*/g, '[^.]+');
	return new RegExp(`^${escaped}$`);
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Walka um snapshot de state e aplica:
 * - whitelist (se preenchida): apenas paths que casam ficam preservados; resto vira REDACTED.
 * - blacklist: paths que casam viram REDACTED.
 * Whitelist tem precedência: se preenchida, blacklist é ignorada (evita ambiguidade).
 *
 * Retorna sempre uma cópia profunda — nunca muta o input.
 */
export function redactState(snapshot: unknown, config: RedactionConfig): unknown {
	if (!config.enabled) return snapshot;

	const useWhitelist = config.stateWhitelistPaths.length > 0;
	const whitelist = config.stateWhitelistPaths.map(globToRegex);
	const blacklist = config.stateBlacklistPaths.map(globToRegex);

	const matches = (path: string, list: RegExp[]) => list.some((r) => r.test(path));

	const walk = (value: unknown, path: string): unknown => {
		if (useWhitelist) {
			// Preserva apenas paths whitelisted. Em containers, recursivamente walka filhos.
			if (matches(path, whitelist)) return value; // path inteiro liberado
		} else if (matches(path, blacklist)) {
			return REDACTION_PLACEHOLDER;
		}

		if (Array.isArray(value)) {
			return value.map((item, i) => walk(item, path ? `${path}.${i}` : `${i}`));
		}
		if (isObject(value)) {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(value)) {
				const childPath = path ? `${path}.${k}` : k;
				out[k] = walk(v, childPath);
			}
			return out;
		}
		// Primitivo
		if (useWhitelist && !matches(path, whitelist)) {
			// Folha não whitelisted some
			return REDACTION_PLACEHOLDER;
		}
		return value;
	};

	return walk(snapshot, '');
}
