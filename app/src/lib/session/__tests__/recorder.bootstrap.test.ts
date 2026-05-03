import { recorder } from '../recorder';
import { sessionStore } from '../storage';

describe('recorder bootstrap phase', () => {
	beforeEach(async () => {
		recorder._resetLimitsForTests();
		await sessionStore.clear();
	});

	test('startSession cria DetectionPhase bootstrap imediatamente', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://example.com/',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const session = await sessionStore.get(id);
		expect(session).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: teste — already asserted not null
		expect(session!.detectionPhases).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: teste — already asserted not null
		const phase = session!.detectionPhases[0];
		expect(phase.kind).toBe('bootstrap');
		expect(phase.id).toBe(`bootstrap-${id}`);
		// biome-ignore lint/style/noNonNullAssertion: teste — already asserted not null
		expect(phase.startTimestamp).toBe(session!.startedAt);
		// biome-ignore lint/style/noNonNullAssertion: teste — already asserted not null
		expect(phase.endTimestamp).toBe(session!.startedAt);
		expect(phase.pages).toHaveLength(0);
	});

	test('addPage substitui bootstrap in-place na primeira detection real', async () => {
		const id = await recorder.startSession({
			tabId: 2,
			initialUrl: 'https://example.com/',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const t = Date.now() + 100;
		await recorder.addPage(id, {
			url: 'https://example.com/page',
			timestamp: t,
			fingerprint: {
				framework: { name: 'react', version: '18.0' },
				httpClients: [],
				dataFetching: [],
				stateManagers: [],
				detectedAt: t,
				isProductionBuild: false,
			},
			triggerType: 'initial',
		});
		const s = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(s!.detectionPhases).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		const phase = s!.detectionPhases[0];
		expect(phase.kind).toBe('detected');
		expect(phase.pages).toHaveLength(1);
		expect(phase.pages[0].url).toBe('https://example.com/page');
		expect(phase.fingerprint.framework.name).toBe('react');
		// Mantém o id bootstrap para que eventos já indexados pelo phaseId
		// continuem ligados à fase correta após a promoção.
		expect(phase.id).toBe(`bootstrap-${id}`);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(phase.startTimestamp).toBe(s!.startedAt);
		expect(phase.endTimestamp).toBe(t);
	});

	test('addPage adiciona nova phase quando atual já é detected', async () => {
		const id = await recorder.startSession({
			tabId: 3,
			initialUrl: 'https://example.com/',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const t1 = Date.now() + 100;
		const fp1 = {
			framework: { name: 'react' as const, version: '18.0' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: t1,
			isProductionBuild: false,
		};
		await recorder.addPage(id, {
			url: 'https://example.com/a',
			timestamp: t1,
			fingerprint: fp1,
			triggerType: 'initial',
		});
		const t2 = t1 + 1000;
		await recorder.addPage(id, {
			url: 'https://example.com/b',
			timestamp: t2,
			fingerprint: {
				framework: { name: 'angular', version: '17' },
				httpClients: [],
				dataFetching: [],
				stateManagers: [],
				detectedAt: t2,
				isProductionBuild: false,
			},
			triggerType: 'navigation',
		});
		const s = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(s!.detectionPhases).toHaveLength(2);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(s!.detectionPhases[0].kind).toBe('detected');
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(s!.detectionPhases[1].kind).toBe('detected');
	});
});
