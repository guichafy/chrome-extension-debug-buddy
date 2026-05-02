import { describe, expect, it } from 'vitest';
import { redactBody } from '../bodyRedactor';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';

describe('redactBody', () => {
	it('redige JWT', () => {
		const jwt =
			'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
		const out = redactBody(`token=${jwt}&user=foo`, DEFAULT_REDACTION_CONFIG);
		expect(out).toContain('[REDACTED]');
		expect(out).not.toContain(jwt);
		expect(out).toContain('user=foo');
	});

	it('redige card PAN', () => {
		const out = redactBody('pan=4111 1111 1111 1111', DEFAULT_REDACTION_CONFIG);
		expect(out).toContain('[REDACTED]');
		expect(out).not.toMatch(/4111 1111/);
	});

	it('redige "password":"..." em JSON', () => {
		const out = redactBody(
			'{"username":"alice","password":"hunter2","keep":"yes"}',
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out).toContain('[REDACTED]');
		expect(out).toContain('alice');
		expect(out).toContain('keep');
		expect(out).not.toContain('hunter2');
	});

	it('redige múltiplas ocorrências (flag g)', () => {
		const jwt = 'eyJabc.eyJdef.signed1234567890_abcdefghij';
		const text = `${jwt} pediu, ${jwt} retornou`;
		const out = redactBody(text, {
			...DEFAULT_REDACTION_CONFIG,
			bodyRegex: ['eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]{10,}'],
		});
		expect(out.match(/\[REDACTED\]/g)?.length).toBe(2);
	});

	it('respeita enabled=false', () => {
		const text = '{"password":"hunter2"}';
		const out = redactBody(text, { ...DEFAULT_REDACTION_CONFIG, enabled: false });
		expect(out).toBe(text);
	});

	it('lança SyntaxError em regex inválida', () => {
		expect(() =>
			redactBody('foo', { ...DEFAULT_REDACTION_CONFIG, bodyRegex: ['(broken'] }),
		).toThrow(SyntaxError);
	});
});
