import type { RedactionConfig } from '../types';

function globToHostnameRegex(glob: string): RegExp {
	// '*.banco.com.br' → /^[^.]+\.banco\.com\.br$/i
	// 1) Escapa meta-chars (incluindo `*` para que `\*` exista no passo 2).
	// 2) `\*` → `[^.]+` (um único segmento, sem cruzar `.`).
	const escaped = glob
		.replace(/[-/\\^$+?.()|[\]{}*]/g, '\\$&')
		.replace(/\\\*/g, '[^.]+');
	return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Retorna true se a URL deve ser ignorada por todos os caminhos de captura
 * (network, console emitido na origin, rrweb se navegar pra ela).
 * Match em hostname (domínio), não em path.
 *
 * - Lista vazia → false (passthrough).
 * - `enabled=false` → false (passthrough — não ignora nada).
 * - URL malformada → false (caller decide).
 */
export function shouldIgnoreUrl(rawUrl: string, config: RedactionConfig): boolean {
	if (!config.enabled || config.urlBlacklist.length === 0) return false;
	let hostname: string;
	try {
		hostname = new URL(rawUrl).hostname;
	} catch {
		// URL inválida não é ignorada (cabe ao caller decidir o que fazer com ela).
		return false;
	}
	const regexes = config.urlBlacklist.map(globToHostnameRegex);
	return regexes.some((r) => r.test(hostname));
}
