import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { redactState } from '../stateRedactor';

describe('redactState — blacklist', () => {
	it('redige glob auth.*.token (qualquer key intermediária)', () => {
		const out = redactState(
			{ auth: { google: { token: 's1' }, github: { token: 's2', user: 'u' } } },
			{ ...DEFAULT_REDACTION_CONFIG, stateBlacklistPaths: ['auth.*.token'] },
		) as Record<string, Record<string, Record<string, string>>>;
		expect(out.auth.google.token).toBe('[REDACTED]');
		expect(out.auth.github.token).toBe('[REDACTED]');
		expect(out.auth.github.user).toBe('u');
	});

	it('redige path exato user.password', () => {
		const out = redactState(
			{ user: { name: 'alice', password: 'hunter2' } },
			DEFAULT_REDACTION_CONFIG,
		) as Record<string, Record<string, string>>;
		expect(out.user.password).toBe('[REDACTED]');
		expect(out.user.name).toBe('alice');
	});

	it('glob de single-segment "*" casa com qualquer key top-level', () => {
		const out = redactState(
			{ a: 1, b: 2 },
			{
				...DEFAULT_REDACTION_CONFIG,
				stateBlacklistPaths: ['*'],
			},
		) as Record<string, unknown>;
		expect(out.a).toBe('[REDACTED]');
		expect(out.b).toBe('[REDACTED]');
	});
});

describe('redactState — whitelist', () => {
	it('whitelist exclusivo: só paths listados ficam, resto vira REDACTED', () => {
		const out = redactState(
			{ a: 1, b: 2, c: { d: 3, e: 4 } },
			{
				...DEFAULT_REDACTION_CONFIG,
				stateBlacklistPaths: [],
				stateWhitelistPaths: ['a', 'c.d'],
			},
		) as Record<string, unknown>;
		expect(out.a).toBe(1);
		expect(out.b).toBe('[REDACTED]');
		expect((out.c as Record<string, unknown>).d).toBe(3);
		expect((out.c as Record<string, unknown>).e).toBe('[REDACTED]');
	});
});

describe('redactState — passthrough e imutabilidade', () => {
	it('enabled=false retorna snapshot inalterado', () => {
		const snap = { auth: { token: 'secret' } };
		expect(redactState(snap, { ...DEFAULT_REDACTION_CONFIG, enabled: false })).toEqual(snap);
	});

	it('deep clone não muta o input', () => {
		const input = { user: { name: 'alice', password: 'hunter2' } };
		const before = JSON.stringify(input);
		const out = redactState(input, DEFAULT_REDACTION_CONFIG) as Record<
			string,
			Record<string, string>
		>;
		// Input intacto
		expect(JSON.stringify(input)).toBe(before);
		expect(input.user.password).toBe('hunter2');
		// Output mascarado
		expect(out.user.password).toBe('[REDACTED]');
		// Identidade diferente (cópia, não a mesma referência)
		expect(out).not.toBe(input);
		expect(out.user).not.toBe(input.user);
	});

	it('arrays preservam shape mas filhos são walkados', () => {
		const out = redactState(
			{ items: [{ pwd: 'x' }, { pwd: 'y' }] },
			{ ...DEFAULT_REDACTION_CONFIG, stateBlacklistPaths: ['items.*.pwd'] },
		) as { items: Array<{ pwd: string }> };
		expect(out.items[0].pwd).toBe('[REDACTED]');
		expect(out.items[1].pwd).toBe('[REDACTED]');
	});
});
