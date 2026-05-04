import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { shouldIgnoreUrl } from '../urlGate';

describe('shouldIgnoreUrl', () => {
	it('match exato em domínio', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['banco.com.br'] };
		expect(shouldIgnoreUrl('https://banco.com.br/login', cfg)).toBe(true);
		// match exato — sem wildcard, subdomínio NÃO bate
		expect(shouldIgnoreUrl('https://api.banco.com.br/x', cfg)).toBe(false);
	});

	it('wildcard em subdomínio (*.banco.com.br)', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['*.banco.com.br'] };
		expect(shouldIgnoreUrl('https://api.banco.com.br/x', cfg)).toBe(true);
		expect(shouldIgnoreUrl('https://login.banco.com.br/y', cfg)).toBe(true);
		// `*` casa apenas um segmento — subdomínio aninhado não bate
		expect(shouldIgnoreUrl('https://app.dev.banco.com.br/x', cfg)).toBe(false);
	});

	it('lista vazia retorna false (passthrough)', () => {
		expect(shouldIgnoreUrl('https://example.com/foo', DEFAULT_REDACTION_CONFIG)).toBe(false);
	});

	it('respeita enabled=false (passthrough mesmo com blacklist)', () => {
		const cfg = {
			...DEFAULT_REDACTION_CONFIG,
			enabled: false,
			urlBlacklist: ['banco.com.br'],
		};
		expect(shouldIgnoreUrl('https://banco.com.br/', cfg)).toBe(false);
	});

	it('URL malformada retorna false sem lançar', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['x.com'] };
		expect(() => shouldIgnoreUrl('not-a-url', cfg)).not.toThrow();
		expect(shouldIgnoreUrl('not-a-url', cfg)).toBe(false);
	});
});
