import { detectBodyKind, formatByteSize } from '../bodyDetection';

describe('detectBodyKind', () => {
	test('retorna empty quando body é undefined', () => {
		expect(detectBodyKind(undefined, undefined)).toEqual({ kind: 'empty', reason: undefined });
	});

	test('retorna empty com reason quando body é undefined e há reason', () => {
		expect(detectBodyKind(undefined, undefined, 'Body too large')).toEqual({
			kind: 'empty',
			reason: 'Body too large',
		});
	});

	test('retorna empty quando body é string vazia', () => {
		expect(detectBodyKind('', undefined)).toEqual({ kind: 'empty' });
	});

	test('retorna image para MIME image/png', () => {
		expect(detectBodyKind('\x89PNG\r\n', 'image/png')).toEqual({
			kind: 'image',
			mimeType: 'image/png',
		});
	});

	test('retorna image para MIME image/jpeg', () => {
		expect(detectBodyKind('\xff\xd8\xff', 'image/jpeg')).toEqual({
			kind: 'image',
			mimeType: 'image/jpeg',
		});
	});

	test('retorna image para MIME image/webp', () => {
		expect(detectBodyKind('RIFF', 'image/webp')).toEqual({ kind: 'image', mimeType: 'image/webp' });
	});

	test('retorna image para MIME image/svg+xml', () => {
		expect(detectBodyKind('<svg/>', 'image/svg+xml')).toEqual({
			kind: 'image',
			mimeType: 'image/svg+xml',
		});
	});

	test('retorna json para MIME application/json', () => {
		expect(detectBodyKind('{"id":1}', 'application/json')).toEqual({ kind: 'json' });
	});

	test('retorna json para MIME application/ld+json', () => {
		expect(detectBodyKind('{"@context":"http://schema.org"}', 'application/ld+json')).toEqual({
			kind: 'json',
		});
	});

	test('retorna json por heurística quando body começa com {', () => {
		expect(detectBodyKind('{"foo":"bar"}', undefined)).toEqual({ kind: 'json' });
	});

	test('retorna json por heurística quando body começa com [', () => {
		expect(detectBodyKind('[1,2,3]', undefined)).toEqual({ kind: 'json' });
	});

	test('não retorna json por heurística quando JSON é inválido', () => {
		const result = detectBodyKind('{invalid json', undefined);
		expect(result.kind).not.toBe('json');
	});

	test('retorna html para MIME text/html', () => {
		expect(detectBodyKind('<html></html>', 'text/html')).toEqual({ kind: 'html' });
	});

	test('retorna html para MIME application/xhtml+xml', () => {
		expect(detectBodyKind('<html/>', 'application/xhtml+xml')).toEqual({ kind: 'html' });
	});

	test('retorna xml para MIME application/xml', () => {
		expect(detectBodyKind('<?xml version="1.0"?>', 'application/xml')).toEqual({ kind: 'xml' });
	});

	test('retorna xml para MIME text/xml', () => {
		expect(detectBodyKind('<root/>', 'text/xml')).toEqual({ kind: 'xml' });
	});

	test('retorna css para MIME text/css', () => {
		expect(detectBodyKind('body { color: red; }', 'text/css')).toEqual({ kind: 'css' });
	});

	test('retorna javascript para MIME application/javascript', () => {
		expect(detectBodyKind('console.log(1)', 'application/javascript')).toEqual({
			kind: 'javascript',
		});
	});

	test('retorna javascript para MIME text/javascript', () => {
		expect(detectBodyKind('function f(){}', 'text/javascript')).toEqual({ kind: 'javascript' });
	});

	test('retorna plain para texto simples sem MIME', () => {
		expect(detectBodyKind('hello world', undefined)).toEqual({ kind: 'plain', mimeType: undefined });
	});

	test('retorna plain para text/plain', () => {
		expect(detectBodyKind('hello world', 'text/plain')).toEqual({
			kind: 'plain',
			mimeType: 'text/plain',
		});
	});

	test('normaliza MIME com charset (application/json; charset=utf-8)', () => {
		expect(detectBodyKind('{"x":1}', 'application/json; charset=utf-8')).toEqual({ kind: 'json' });
	});

	test('retorna binary quando body tem muitos caracteres não-imprimíveis', () => {
		// Gera string com 50% de caracteres fora do range imprimível
		const binaryBody = Array.from({ length: 100 }, (_, i) =>
			i % 2 === 0 ? '\x00' : 'a',
		).join('');
		const result = detectBodyKind(binaryBody, undefined);
		expect(result.kind).toBe('binary');
		if (result.kind === 'binary') {
			expect(result.totalBytes).toBe(100);
			expect(result.sampleHex).toBeTruthy();
		}
	});

	test('hex dump tem formato correto', () => {
		const result = detectBodyKind(
			Array.from({ length: 100 }, () => '\x00').join(''),
			undefined,
		);
		if (result.kind === 'binary') {
			// Deve iniciar com offset 00000000
			expect(result.sampleHex).toMatch(/^00000000/);
		}
	});
});

describe('formatByteSize', () => {
	test('formata bytes (< 1024)', () => {
		expect(formatByteSize(0)).toBe('0 B');
		expect(formatByteSize(512)).toBe('512 B');
		expect(formatByteSize(1023)).toBe('1023 B');
	});

	test('formata KB (1024 a 1MB)', () => {
		expect(formatByteSize(1024)).toBe('1.0 KB');
		expect(formatByteSize(12700)).toBe('12.4 KB');
		expect(formatByteSize(1024 * 1024 - 1)).toBe('1024.0 KB');
	});

	test('formata MB (>= 1MB)', () => {
		expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatByteSize(2 * 1024 * 1024)).toBe('2.0 MB');
	});
});
