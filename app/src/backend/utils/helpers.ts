/**
 * Utilitários e funções auxiliares para o interceptor
 */

/**
 * Converte texto de headers em um objeto
 */
export function parseHeaders(headersText: string): Record<string, string> {
	const headers: Record<string, string> = {};
	const lines = headersText.split('\n');

	lines.forEach((rawLine) => {
		const line = rawLine.trim();
		if (!line) return;

		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
			const key = line.substring(0, colonIndex).trim();
			const value = line.substring(colonIndex + 1).trim();
			headers[key] = value;
		}
	});

	return headers;
}

/**
 * Detecta o tipo de conteúdo com base no texto
 */
export function detectContentType(rawContent: string): 'json' | 'html' | 'text' {
	const content = rawContent.trim();

	// Tentar detectar JSON
	if (
		(content.startsWith('{') && content.endsWith('}')) ||
		(content.startsWith('[') && content.endsWith(']'))
	) {
		try {
			JSON.parse(content);
			return 'json';
		} catch (e) {
			// Não é JSON válido
		}
	}

	// Tentar detectar HTML
	if (
		(content.startsWith('<') && content.endsWith('>')) ||
		content.includes('<!DOCTYPE html>') ||
		content.includes('<html') ||
		content.includes('<body') ||
		content.includes('<div')
	) {
		return 'html';
	}

	// Padrão para texto
	return 'text';
}

/**
 * Obtém o modo correto para o CodeMirror
 */
export function getCodeMirrorMode(type: string): string | { name: string; json: boolean } {
	switch (type) {
		case 'json':
			return { name: 'javascript', json: true };
		case 'html':
			return 'htmlmixed';
		default:
			return 'text';
	}
}
