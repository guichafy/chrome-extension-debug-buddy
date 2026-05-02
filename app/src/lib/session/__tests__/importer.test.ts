import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { serializeSession } from '../exporter';
import { parseDbsession } from '../importer';
import type { Session } from '../types';

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess_orig',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

async function buildBufferWithRawSession(raw: unknown): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('session.json', JSON.stringify(raw));
	zip.file('manifest.json', '{}');
	return zip.generateAsync({ type: 'arraybuffer' });
}

describe('parseDbsession', () => {
	it('round-trips uma session, gera novo id e marca origin=imported', async () => {
		const buf = await serializeSession(baseSession());
		const imported = await parseDbsession(buf);
		expect(imported.id).toMatch(/^imported_sess_orig_/);
		expect(imported.origin).toBe('imported');
		expect(imported.startedAt).toBe(1_000);
		expect(imported.metadata.initialUrl).toBe('https://example/');
	});

	it('rejeita zip sem session.json', async () => {
		const zip = new JSZip();
		zip.file('outro.txt', 'nada');
		const buf = await zip.generateAsync({ type: 'arraybuffer' });
		await expect(parseDbsession(buf)).rejects.toThrow(/session\.json ausente/);
	});

	it('rejeita schemaVersion diferente de 1', async () => {
		const buf = await buildBufferWithRawSession({
			...baseSession(),
			schemaVersion: 99,
		});
		await expect(parseDbsession(buf)).rejects.toThrow(/schemaVersion inesperada/);
	});

	it('rejeita session.json com id ausente', async () => {
		const buf = await buildBufferWithRawSession({
			schemaVersion: 1,
			startedAt: 1,
			events: [],
			detectionPhases: [],
			metadata: {},
		});
		await expect(parseDbsession(buf)).rejects.toThrow(/id ausente/);
	});

	it('preserva campos opcionais desconhecidos (forward compat)', async () => {
		const buf = await buildBufferWithRawSession({
			...baseSession(),
			rrwebEvents: [{ foo: 'bar' }], // campo de Phase 2 que esta versão não conhece
		});
		const imported = await parseDbsession(buf);
		expect((imported as unknown as { rrwebEvents: unknown[] }).rrwebEvents).toEqual([
			{ foo: 'bar' },
		]);
	});
});
