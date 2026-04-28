import { describe, expect, test } from 'vitest';
import {
	encodeBodyToBase64,
	getBodyUnavailableReason,
	getCaptureBodyUnavailableReason,
	getHttpStatusPhrase,
	getMimeTypeFromHeaders,
	getOptionalMimeTypeFromHeaders,
	headersArrayToRecord,
	headersRecordToArray,
	validateMockBody,
} from '../http';

describe('dominio HTTP', () => {
	test('identifica respostas que nao podem ter body', () => {
		expect(getBodyUnavailableReason('HEAD', 200)).toBe(
			'Requisicoes HEAD nao possuem corpo de resposta.',
		);
		expect(getBodyUnavailableReason('GET', 101)).toBe(
			'Respostas informativas 101 nao possuem corpo disponivel.',
		);
		expect(getBodyUnavailableReason('GET', 204)).toBe('Resposta 204 nao possui corpo disponivel.');
		expect(getBodyUnavailableReason('GET', 205)).toBe('Resposta 205 nao possui corpo disponivel.');
		expect(getBodyUnavailableReason('GET', 304)).toBe('Resposta 304 nao possui corpo disponivel.');
	});

	test('permite body em cenarios HTTP validos fora das proibicoes explicitas', () => {
		expect(getBodyUnavailableReason('OPTIONS', 200)).toBeUndefined();
		expect(getBodyUnavailableReason('GET', 201)).toBeUndefined();
		expect(getBodyUnavailableReason('GET', 301)).toBeUndefined();
		expect(getBodyUnavailableReason('POST', 404)).toBeUndefined();
	});

	test('trata redirects como corpo nao capturavel pelo CDP sem invalidar mock HTTP', () => {
		expect(getCaptureBodyUnavailableReason('GET', 301)).toBe(
			'Redirect 301 nao possui corpo capturavel via Fetch.getResponseBody.',
		);
		expect(getCaptureBodyUnavailableReason('GET', 302)).toBe(
			'Redirect 302 nao possui corpo capturavel via Fetch.getResponseBody.',
		);
		expect(validateMockBody('GET', 301, 'moved')).toEqual({
			shouldSendBody: true,
			body: 'moved',
		});
	});

	test('valida body de mock sem confundir ausencia com string vazia', () => {
		expect(validateMockBody('GET', 200, undefined)).toEqual({ shouldSendBody: false });
		expect(validateMockBody('GET', 200, '')).toEqual({ shouldSendBody: true, body: '' });
		expect(validateMockBody('OPTIONS', 201, '{"ok":true}')).toEqual({
			shouldSendBody: true,
			body: '{"ok":true}',
		});
	});

	test('bloqueia body de mock quando o metodo/status nao permite conteudo', () => {
		expect(() => validateMockBody('HEAD', 200, 'x')).toThrow('Mock HEAD 200 nao pode definir body');
		expect(() => validateMockBody('GET', 204, '')).toThrow('Mock GET 204 nao pode definir body');
		expect(() => validateMockBody('GET', 304, 'cached')).toThrow(
			'Mock GET 304 nao pode definir body',
		);
	});

	test('resolve status phrase conhecido ou phrase explicito sem usar Unknown', () => {
		expect(getHttpStatusPhrase(201)).toBe('Created');
		expect(getHttpStatusPhrase(299, 'Custom Done')).toBe('Custom Done');
		expect(() => getHttpStatusPhrase(299)).toThrow('Status phrase nao conhecido para 299');
	});

	test('converte headers entre formatos CDP e record sem fallback silencioso', () => {
		const array = [
			{ name: 'Content-Type', value: 'application/json; charset=utf-8' },
			{ name: 'X-Test', value: 'ok' },
		];
		expect(headersArrayToRecord(array)).toEqual({
			'Content-Type': 'application/json; charset=utf-8',
			'X-Test': 'ok',
		});
		expect(headersRecordToArray({ A: '1', B: '2' })).toEqual([
			{ name: 'A', value: '1' },
			{ name: 'B', value: '2' },
		]);
		expect(getMimeTypeFromHeaders(array)).toBe('application/json');
		expect(() => getMimeTypeFromHeaders([])).toThrow('Header Content-Type ausente');
		expect(getOptionalMimeTypeFromHeaders([])).toBeUndefined();
	});

	test('codifica body textual em base64 preservando unicode', () => {
		expect(encodeBodyToBase64('ola mundo')).toBe('b2xhIG11bmRv');
		expect(encodeBodyToBase64('acao')).toBe('YWNhbw==');
	});
});
