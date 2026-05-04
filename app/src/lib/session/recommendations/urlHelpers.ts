/**
 * Tenta parsear `url` para `URL`. Retorna null se a string for inválida —
 * cada regra decide explicitamente que URL malformada → não se aplica.
 * Não é fallback silencioso: o caller TEM que tratar o null com `if (!u) return null;`.
 */
export function safeParseUrl(url: string): URL | null {
	try {
		return new URL(url);
	} catch {
		return null;
	}
}
