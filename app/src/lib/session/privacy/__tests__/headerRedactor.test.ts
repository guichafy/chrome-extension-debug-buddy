import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { redactHeaders } from '../headerRedactor';

describe('redactHeaders', () => {
	it('redige headers default (authorization, cookie, set-cookie, x-api-key)', () => {
		const out = redactHeaders(
			{
				Authorization: 'Bearer xyz',
				Cookie: 'sid=abc',
				'Set-Cookie': 'sid=abc; HttpOnly',
				'X-API-Key': 'secret',
				'Content-Type': 'application/json',
			},
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out.Authorization).toBe('[REDACTED]');
		expect(out.Cookie).toBe('[REDACTED]');
		expect(out['Set-Cookie']).toBe('[REDACTED]');
		expect(out['X-API-Key']).toBe('[REDACTED]');
		expect(out['Content-Type']).toBe('application/json');
	});

	it('match é case-insensitive', () => {
		const out = redactHeaders(
			{ AUTHORIZATION: 'x', authorization: 'y' },
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out.AUTHORIZATION).toBe('[REDACTED]');
		expect(out.authorization).toBe('[REDACTED]');
	});

	it('regex match: x-trace-token redigido, x-request-id preservado', () => {
		const out = redactHeaders(
			{ 'X-Trace-Token': 'abc', 'X-Request-Id': 'keep' },
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out['X-Trace-Token']).toBe('[REDACTED]');
		expect(out['X-Request-Id']).toBe('keep');
	});

	it('respeita enabled=false (passthrough)', () => {
		const headers = { Authorization: 'Bearer xyz' };
		const out = redactHeaders(headers, { ...DEFAULT_REDACTION_CONFIG, enabled: false });
		expect(out.Authorization).toBe('Bearer xyz');
	});

	it('lança SyntaxError em regex inválida (no-fallback)', () => {
		expect(() =>
			redactHeaders({ a: 'b' }, { ...DEFAULT_REDACTION_CONFIG, headerRegex: ['(invalid'] }),
		).toThrow(SyntaxError);
	});
});
