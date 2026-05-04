import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG, REDACTION_PLACEHOLDER } from '../defaults';

describe('DEFAULT_REDACTION_CONFIG', () => {
	it('habilitado por default', () => {
		expect(DEFAULT_REDACTION_CONFIG.enabled).toBe(true);
	});

	it('cobre headers de auth comuns', () => {
		expect(DEFAULT_REDACTION_CONFIG.headerKeys).toEqual(
			expect.arrayContaining(['authorization', 'cookie', 'set-cookie']),
		);
	});

	it('rrweb default não mascara todos os inputs (apenas password e cc-*)', () => {
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskAllInputs).toBe(false);
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('cc-');
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('password');
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('dbb-mask');
	});

	it('auto-purge desligado por default com retenção de 30 dias', () => {
		expect(DEFAULT_REDACTION_CONFIG.autoPurgeEnabled).toBe(false);
		expect(DEFAULT_REDACTION_CONFIG.autoPurgeRetentionDays).toBe(30);
	});

	it('regex defaults compilam (não lançam SyntaxError)', () => {
		for (const r of [
			...DEFAULT_REDACTION_CONFIG.headerRegex,
			...DEFAULT_REDACTION_CONFIG.bodyRegex,
			...DEFAULT_REDACTION_CONFIG.consoleRegex,
		]) {
			expect(() => new RegExp(r)).not.toThrow();
		}
	});

	it('placeholder é "[REDACTED]"', () => {
		expect(REDACTION_PLACEHOLDER).toBe('[REDACTED]');
	});
});
