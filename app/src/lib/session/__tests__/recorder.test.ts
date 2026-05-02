import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { sessionStore } from '../storage';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	httpClients: [{ name: 'fetch', confidence: 'high' }],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
	...overrides,
});

const page = (url: string, ts: number, fingerprint: EnvironmentFingerprint): PageDetection => ({
	url,
	timestamp: ts,
	fingerprint,
	triggerType: 'navigation',
});

beforeEach(async () => {
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('recorder', () => {
	it('startSession cria uma session ativa pra tab', async () => {
		const id = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://example/',
			userAgent: 'jsdom',
			viewportSize: { w: 1280, h: 720 },
			canvasCaptureEnabled: false,
		});
		const got = await sessionStore.get(id);
		expect(got?.tabId).toBe(7);
		expect(got?.endedAt).toBeNull();
		expect(got?.origin).toBe('recorded');
		expect(got?.detectionPhases).toEqual([]);
	});

	it('startSession recusa se já existe session ativa pra tab', async () => {
		await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await expect(
			recorder.startSession({
				tabId: 7,
				initialUrl: 'https://y/',
				userAgent: '',
				viewportSize: { w: 1, h: 1 },
				canvasCaptureEnabled: false,
			}),
		).rejects.toThrow(/já existe/i);
	});

	it('addPage agrupa em phase única quando fingerprint repete', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/a', 10, fp()));
		await recorder.addPage(id, page('https://x/b', 20, fp()));
		const got = await sessionStore.get(id);
		expect(got?.detectionPhases).toHaveLength(1);
		expect(got?.detectionPhases[0].pages).toHaveLength(2);
		expect(got?.detectionPhases[0].endTimestamp).toBe(20);
	});

	it('addPage abre nova phase quando fingerprint muda', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder.addPage(id, page('https://y/', 20, fp({ framework: { name: 'angular' } })));
		const got = await sessionStore.get(id);
		expect(got?.detectionPhases).toHaveLength(2);
		expect(got?.detectionPhases[1].fingerprint.framework.name).toBe('angular');
	});

	it('cada nova phase emite um SessionEvent type=detection com phaseId', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder.addPage(id, page('https://y/', 20, fp({ framework: { name: 'angular' } })));
		const got = await sessionStore.get(id);
		const detectionEvents = got?.events.filter((e) => e.type === 'detection') ?? [];
		expect(detectionEvents).toHaveLength(2);
		expect(detectionEvents[0].phaseId).toBe(got?.detectionPhases[0].id);
		expect(detectionEvents[1].phaseId).toBe(got?.detectionPhases[1].id);
	});

	it('stopSession marca endedAt e libera o slot da tab', async () => {
		const id = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.stopSession(id);
		const got = await sessionStore.get(id);
		expect(got?.endedAt).toBeGreaterThan(0);
		// Permite criar nova sessão na mesma tab
		const id2 = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		expect(id2).not.toBe(id);
	});
});
