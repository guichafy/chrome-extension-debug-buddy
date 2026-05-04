import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { serializeSession } from '../exporter';
import type { Session } from '../types';

const baseSession = (): Session => ({
	id: 'sess_test',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [
		{
			type: 'console',
			timestamp: 1_500,
			phaseId: 'p1',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hello' }],
		},
	],
});

describe('serializeSession', () => {
	it('gera zip com manifest.json, session.json e viewer.html', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		expect(Object.keys(zip.files).sort()).toEqual([
			'manifest.json',
			'session.json',
			'viewer.html',
		]);
	});

	it('manifest.json tem formatVersion=1 e sessionId correto', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		const manifestText = await zip.file('manifest.json')!.async('text');
		const manifest = JSON.parse(manifestText);
		expect(manifest.formatVersion).toBe(1);
		expect(manifest.sessionId).toBe('sess_test');
		expect(manifest.sessionSchemaVersion).toBe(1);
		expect(manifest.exporterAgent).toBe('debug-buddy');
	});

	it('session.json round-trips o objeto Session', async () => {
		const original = baseSession();
		const buf = await serializeSession(original);
		const zip = await JSZip.loadAsync(buf);
		const text = await zip.file('session.json')!.async('text');
		expect(JSON.parse(text)).toEqual(original);
	});

	it('viewer.html embute o JSON da session', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		const html = await zip.file('viewer.html')!.async('text');
		expect(html).toContain('"sess_test"');
		expect(html).toContain('"hello"');
		expect(html).toContain('Debug Buddy');
		// Phase 2: banner agora marca replay visual via rrweb embutido.
		expect(html).toContain('replay visual via rrweb embutido');
	});
});
