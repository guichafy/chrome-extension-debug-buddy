import { describe, expect, test } from 'vitest';
import { isSensitiveHeader, maskHeaderValue } from '../sensitiveHeaders';

describe('isSensitiveHeader', () => {
	test.each([
		['authorization', true],
		['Authorization', true],
		['cookie', true],
		['Set-Cookie', true],
		['x-api-key', true],
		['proxy-authorization', true],
		['content-type', false],
		['accept', false],
		['user-agent', false],
	])('%s -> %s', (name, expected) => {
		expect(isSensitiveHeader(name)).toBe(expected);
	});
});

describe('maskHeaderValue', () => {
	test('mascara valor de header sensível mantendo comprimento aproximado', () => {
		expect(maskHeaderValue('authorization', 'Bearer abc123def456')).toBe('•••••• (mascarado)');
	});
	test('retorna valor original quando o header não é sensível', () => {
		expect(maskHeaderValue('content-type', 'application/json')).toBe('application/json');
	});
	test('mascara mesmo se o valor for vazio (não fabrica conteúdo)', () => {
		expect(maskHeaderValue('cookie', '')).toBe('•••••• (mascarado)');
	});
});
