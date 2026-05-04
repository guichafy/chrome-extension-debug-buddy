// Padrões para detectar e anonimizar usernames em paths absolutos.
// Cada padrão substitui o segmento do nome de usuário por `<u>` preservando o
// resto do path. Idempotente: aplicar duas vezes é seguro porque `<u>` não bate
// novamente nos padrões.
const PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
	// macOS: /Users/<name>/...
	{ regex: /\/Users\/[^/]+\//g, replacement: '/Users/<u>/' },
	// Linux: /home/<name>/...
	{ regex: /\/home\/[^/]+\//g, replacement: '/home/<u>/' },
	// Windows com backslashes: C:\Users\<name>\...
	{ regex: /([A-Za-z]:)\\Users\\[^\\]+\\/g, replacement: '$1\\Users\\<u>\\' },
	// Windows com forward slashes: C:/Users/<name>/...
	{ regex: /([A-Za-z]:)\/Users\/[^/]+\//g, replacement: '$1/Users/<u>/' },
];

/**
 * Trunca caminhos absolutos com nome de usuário em URLs / file paths.
 * Detecta `/Users/<u>/`, `/home/<u>/`, `C:\\Users\\<u>\\` e `C:/Users/<u>/`,
 * substituindo o segmento do usuário por `<u>`. Caminhos sem match são
 * retornados sem alteração. Idempotente.
 */
export function truncatePath(path: string): string {
	let out = path;
	for (const { regex, replacement } of PATTERNS) {
		out = out.replace(regex, replacement);
	}
	return out;
}
