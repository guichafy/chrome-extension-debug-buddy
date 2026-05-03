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
});
