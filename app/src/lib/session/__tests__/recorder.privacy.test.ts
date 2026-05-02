import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../privacy/defaults';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';

describe('recorder + privacy.toRedactionApplied', () => {
	let chromeStore: Map<string, unknown>;

	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
		chromeStore = new Map<string, unknown>([['privacyConfig', DEFAULT_REDACTION_CONFIG]]);
		(globalThis as unknown as { chrome: typeof chrome }).chrome = {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome,
			storage: {
				...(globalThis as unknown as { chrome: typeof chrome }).chrome?.storage,
				local: {
					get: vi.fn(async (k: string | string[]) => {
						const keys = Array.isArray(k) ? k : [k];
						const result: Record<string, unknown> = {};
						for (const key of keys) {
							if (chromeStore.has(key)) result[key] = chromeStore.get(key);
						}
						return result;
					}),
					set: vi.fn(async (kv: Record<string, unknown>) => {
						for (const [key, val] of Object.entries(kv)) chromeStore.set(key, val);
					}),
				} as unknown as typeof chrome.storage.local,
			} as typeof chrome.storage,
		};
	});

	afterEach(() => {
		recorder._resetLimitsForTests();
	});

	it('stopSession preenche session.redactionApplied com subset sanitizado', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'http://e/',
			userAgent: 'jsdom',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.stopSession(id);
		const saved = await sessionStore.get(id);
		expect(saved?.redactionApplied).toBeDefined();
		expect(saved?.redactionApplied?.headerKeys).toContain('authorization');
		// regex específicas NÃO devem vazar
		expect(saved?.redactionApplied?.headerRegex[0]).toMatch(/^<\d+ regex/);
	});

	it('redactionApplied ausente em sessões pré-Phase 6 (forward compat)', async () => {
		// Cria session direto no store sem passar por stopSession
		const id = 'sess_legacy';
		await sessionStore.put({
			id,
			schemaVersion: 1,
			startedAt: 1,
			endedAt: 2,
			origin: 'recorded',
			tabId: 1,
			metadata: {
				initialUrl: 'http://e/',
				userAgent: '',
				viewportSize: { w: 1, h: 1 },
				canvasCaptureEnabled: false,
			},
			detectionPhases: [],
			events: [],
		});
		const saved = await sessionStore.get(id);
		expect(saved?.redactionApplied).toBeUndefined();
	});
});
