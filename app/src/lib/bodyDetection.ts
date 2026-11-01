// Limita parsing e destaque síncronos no inspector; bodies maiores usam blocos de texto.
export const BODY_FORMAT_LIMIT = 32 * 1024;

export type BodyKind =
	| { kind: 'empty'; reason?: string }
	| { kind: 'image'; mimeType: string }
	| { kind: 'json' }
	| { kind: 'html' }
	| { kind: 'xml' }
	| { kind: 'css' }
	| { kind: 'javascript' }
	| { kind: 'binary'; sampleHex: string; totalBytes: number }
	| { kind: 'plain'; mimeType?: string };

const IMAGE_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'image/x-icon',
]);

const JSON_TYPES = new Set([
	'application/json',
	'application/ld+json',
	'application/manifest+json',
	'application/vnd.api+json',
]);

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const XML_TYPES = new Set(['application/xml', 'text/xml']);
const CSS_TYPES = new Set(['text/css']);
const JS_TYPES = new Set([
	'application/javascript',
	'application/x-javascript',
	'text/javascript',
]);

function looksBinary(body: string): boolean {
	const sampleSize = Math.min(body.length, 1024);
	let nonPrintable = 0;
	for (let i = 0; i < sampleSize; i++) {
		const code = body.charCodeAt(i);
		if (code === 9 || code === 10 || code === 13) continue; // tab, LF, CR
		if (code < 32 || code > 126) nonPrintable++;
	}
	return sampleSize > 0 && nonPrintable / sampleSize > 0.15;
}

function toHexDump(body: string, maxBytes = 256): string {
	const len = Math.min(body.length, maxBytes);
	const lines: string[] = [];
	for (let offset = 0; offset < len; offset += 16) {
		const chunkBytes: number[] = [];
		for (let j = 0; j < 16 && offset + j < len; j++) {
			chunkBytes.push(body.charCodeAt(offset + j) & 0xff);
		}
		const hex = chunkBytes
			.map((b) => b.toString(16).padStart(2, '0'))
			.join(' ')
			.padEnd(48, ' ');
		const ascii = chunkBytes
			.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
			.join('');
		lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  ${ascii}`);
	}
	return lines.join('\n');
}

export function detectBodyKind(
	body: string | undefined,
	mimeType: string | undefined,
	bodyUnavailableReason?: string,
): BodyKind {
	if (body === undefined) {
		return { kind: 'empty', reason: bodyUnavailableReason };
	}
	if (body === '') {
		return { kind: 'empty' };
	}

	const normalizedMime = mimeType?.toLowerCase().split(';')[0]?.trim();

	if (normalizedMime && IMAGE_TYPES.has(normalizedMime)) {
		return { kind: 'image', mimeType: normalizedMime };
	}
	if (normalizedMime && HTML_TYPES.has(normalizedMime)) {
		return { kind: 'html' };
	}
	if (normalizedMime && XML_TYPES.has(normalizedMime)) {
		return { kind: 'xml' };
	}
	if (normalizedMime && CSS_TYPES.has(normalizedMime)) {
		return { kind: 'css' };
	}
	if (normalizedMime && JS_TYPES.has(normalizedMime)) {
		return { kind: 'javascript' };
	}
	if (normalizedMime && (JSON_TYPES.has(normalizedMime) || normalizedMime.endsWith('+json'))) {
		return { kind: 'json' };
	}
	if (normalizedMime?.startsWith('text/')) {
		return { kind: 'plain', mimeType: normalizedMime };
	}

	// Sem MIME explícito: detecta JSON por heurística
	const trimmed = body.length <= BODY_FORMAT_LIMIT ? body.trim() : undefined;
	// Sem MIME, não afirmamos validade de JSON grande nem executamos o parse
	// completo. Preservamos a representação textual (inclusive Unicode).
	if (trimmed === undefined) {
		const beginning = body.trimStart();
		if (beginning.startsWith('{') || beginning.startsWith('[')) {
			return { kind: 'plain', mimeType: normalizedMime };
		}
	}
	if (trimmed !== undefined && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
		try {
			JSON.parse(trimmed);
			return { kind: 'json' };
		} catch {
			// não é JSON válido — segue heurística
		}
	}

	if (looksBinary(body)) {
		return {
			kind: 'binary',
			sampleHex: toHexDump(body, 256),
			totalBytes: body.length,
		};
	}

	return { kind: 'plain', mimeType: normalizedMime };
}

export function formatByteSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
