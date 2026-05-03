import { afterEach, beforeEach, describe, expect, it, test } from 'vitest';
import { recorder } from '../recorder';
import { sessionStore } from '../storage';
import type { EnvironmentFingerprint, PageDetection, Recommendation } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	libraries: [],
	httpClients: [{ name: 'fetch', confidence: 'high' }],
	dataFetching: [],
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
	recorder._resetLimitsForTests();
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
		// startSession agora cria uma DetectionPhase bootstrap sincronamente
		// (Bug 2 fix). A fase será promovida in-place quando a primeira
		// pageDetected real chegar via addPage.
		expect(got?.detectionPhases).toHaveLength(1);
		expect(got?.detectionPhases[0].kind).toBe('bootstrap');
		expect(got?.detectionPhases[0].id).toBe(`bootstrap-${id}`);
		expect(got?.detectionPhases[0].pages).toEqual([]);
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
		await recorder._flushForTests(id);
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
		await recorder._flushForTests(id);
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
		await recorder._flushForTests(id);
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

	it('stopSession lança erro quando session não existe', async () => {
		await expect(recorder.stopSession('inexistente')).rejects.toThrow(/não encontrada/i);
	});

	it('addPage lança erro quando session não existe', async () => {
		await expect(
			recorder.addPage('inexistente', page('https://x/', 1, fp())),
		).rejects.toThrow(/não encontrada/i);
	});

	it('addEvent persiste evento e atualiza session.events', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder._flushForTests(id);
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		await recorder.addEvent(id, {
			type: 'network',
			timestamp: 11,
			phaseId,
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		});
		await recorder._flushForTests(id);
		const got = await sessionStore.get(id);
		const networkEvents = got!.events.filter((e) => e.type === 'network');
		expect(networkEvents).toHaveLength(1);
	});

	it('addEvent coalesce 2 console idênticos consecutivos em 1 entrada com count=2', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder._flushForTests(id);
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		const baseConsole = {
			type: 'console' as const,
			phaseId,
			source: 'app' as const,
			level: 'log' as const,
			args: [{ type: 'string' as const, description: 'rendered' }],
		};
		await recorder.addEvent(id, { ...baseConsole, timestamp: 11 });
		await recorder.addEvent(id, { ...baseConsole, timestamp: 12 });
		await recorder._flushForTests(id);
		const got = await sessionStore.get(id);
		const consoleEvents = got!.events.filter((e) => e.type === 'console');
		expect(consoleEvents).toHaveLength(1);
		const first = consoleEvents[0];
		if (first.type !== 'console') throw new Error('expected console');
		expect(first.coalesceCount).toBe(2);
	});

	it('addEvent dispara auto-stop quando ultrapassa SIZE_LIMIT_BYTES', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder._flushForTests(id);
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		recorder._setLimitsForTests({ sizeBytes: 500, durationMs: 60_000 });
		try {
			for (let i = 0; i < 100; i++) {
				await recorder.addEvent(id, {
					type: 'console',
					timestamp: 11 + i,
					phaseId,
					source: 'app',
					level: 'log',
					args: [{ type: 'string', description: `n${i}` }],
				});
			}
		} catch {
			// Auto-stop pode rejeitar adicionais posteriores; ignorar nesse loop.
		}
		const got = await sessionStore.get(id);
		expect(got!.endedAt).not.toBeNull();
		expect(got!.telemetry?.hitHardLimit).toBe(true);
		expect(got!.telemetry?.hardLimitReason).toBe('size');
	});

	it('addEvent dispara auto-stop quando ultrapassa DURATION_LIMIT_MS', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder._flushForTests(id);
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		recorder._setLimitsForTests({ sizeBytes: 50_000_000, durationMs: 1 });
		await new Promise((r) => setTimeout(r, 10));
		await recorder.addEvent(id, {
			type: 'console',
			timestamp: 100,
			phaseId,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'late' }],
		});
		const got = await sessionStore.get(id);
		expect(got!.endedAt).not.toBeNull();
		expect(got!.telemetry?.hardLimitReason).toBe('time');
	});

	it('getRuntimeStatus retorna null quando sessão não está no runtime cache', () => {
		expect(recorder.getRuntimeStatus('inexistente')).toBeNull();
	});

	it('getRuntimeStatus retorna sizeBytes e durationMs após addEvent', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder._flushForTests(id);
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		await recorder.addEvent(id, {
			type: 'network',
			timestamp: 11,
			phaseId,
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		});
		const status = recorder.getRuntimeStatus(id);
		expect(status).not.toBeNull();
		expect(status!.sizeBytes).toBeGreaterThan(0);
		expect(status!.durationMs).toBeGreaterThanOrEqual(0);
	});
});

test('addRecommendation persiste em session.recommendations', async () => {
	const id = await recorder.startSession({
		tabId: 1,
		initialUrl: 'https://example.com',
		userAgent: 'test-ua',
		viewportSize: { w: 1024, h: 768 },
		canvasCaptureEnabled: false,
	});

	const rec: Recommendation = {
		id: 'rec-1',
		ruleId: 'compression-missing',
		severity: 'warn',
		timestamp: 100,
		url: 'https://example.com/api',
		host: 'example.com',
		summary: 'sem gzip',
		evidence: { 'content-encoding': 'absent' },
	};
	await recorder.addRecommendation(id, rec);
	await recorder._flushForTests(id);

	const session = await recorder.getActiveByTab(1);
	expect(session?.recommendations).toEqual([rec]);
});

test('addRecommendation lança quando session encerrada', async () => {
	const id = await recorder.startSession({
		tabId: 2,
		initialUrl: 'https://example.com',
		userAgent: 'test-ua',
		viewportSize: { w: 1024, h: 768 },
		canvasCaptureEnabled: false,
	});
	await recorder.stopSession(id);

	const rec: Recommendation = {
		id: 'rec-2',
		ruleId: 'csp-missing',
		severity: 'error',
		timestamp: 100,
		url: 'https://example.com',
		host: 'example.com',
		summary: 'csp ausente',
		evidence: {},
	};
	await expect(recorder.addRecommendation(id, rec)).rejects.toThrow(/já encerrada/);
});
