import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import {
	getPrivacyConfig,
	setPrivacyConfig,
	toRedactionApplied,
	validateRedactionConfig,
} from '../config';

describe('validateRedactionConfig', () => {
	it('aceita config default', () => {
		expect(() => validateRedactionConfig(DEFAULT_REDACTION_CONFIG)).not.toThrow();
	});

	it('lança em headerRegex inválido', () => {
		expect(() =>
			validateRedactionConfig({ ...DEFAULT_REDACTION_CONFIG, headerRegex: ['(broken'] }),
		).toThrow(SyntaxError);
	});

	it('lança em retentionDays < 1', () => {
		expect(() =>
			validateRedactionConfig({ ...DEFAULT_REDACTION_CONFIG, autoPurgeRetentionDays: 0 }),
		).toThrow(RangeError);
	});
});

describe('getPrivacyConfig / setPrivacyConfig', () => {
	beforeEach(() => {
		const store = new Map<string, unknown>();
		(globalThis as unknown as { chrome: typeof chrome }).chrome = {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome,
			storage: {
				...(globalThis as unknown as { chrome: typeof chrome }).chrome.storage,
				local: {
					get: vi.fn(async (keys: string | string[]) => {
						const keyArr = Array.isArray(keys) ? keys : [keys];
						const result: Record<string, unknown> = {};
						for (const k of keyArr) {
							if (store.has(k)) result[k] = store.get(k);
						}
						return result;
					}),
					set: vi.fn(async (kv: Record<string, unknown>) => {
						for (const [k, v] of Object.entries(kv)) store.set(k, v);
					}),
				} as unknown as typeof chrome.storage.local,
			} as typeof chrome.storage,
		};
	});

	it('retorna defaults quando storage vazio', async () => {
		const cfg = await getPrivacyConfig();
		expect(cfg.enabled).toBe(true);
		expect(cfg.headerKeys).toContain('authorization');
	});

	it('round-trips uma config válida', async () => {
		const custom = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['banco.com.br'] };
		await setPrivacyConfig(custom);
		const cfg = await getPrivacyConfig();
		expect(cfg.urlBlacklist).toEqual(['banco.com.br']);
	});

	it('rejeita set com regex inválida', async () => {
		await expect(
			setPrivacyConfig({ ...DEFAULT_REDACTION_CONFIG, bodyRegex: ['(unbalanced'] }),
		).rejects.toThrow(SyntaxError);
	});
});

describe('toRedactionApplied', () => {
	it('redacted regex contagem ao invés de pattern', () => {
		const applied = toRedactionApplied(DEFAULT_REDACTION_CONFIG);
		expect(applied.headerRegex.length).toBeGreaterThan(0);
		expect(applied.headerRegex[0]).toMatch(/^<\d+ regex/);
		expect(applied.bodyRegex[0]).toMatch(/^<\d+ regex/);
		expect(applied.headerKeys).toEqual(DEFAULT_REDACTION_CONFIG.headerKeys);
	});
});
