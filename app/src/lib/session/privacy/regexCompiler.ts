/**
 * Compila uma lista de strings em RegExp[] aplicando as flags fornecidas.
 * Lança SyntaxError em regex inválida — sem fallback silencioso (regra do projeto).
 */
export function compileRegexList(list: string[], flags: string): RegExp[] {
	return list.map((r) => new RegExp(r, flags));
}
