import JSZip from 'jszip';
import type { Session } from './types';

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateRawSession(raw: unknown): asserts raw is Session {
	if (!isObject(raw)) throw new Error('session.json não é um objeto');
	if (raw.schemaVersion !== 1) {
		throw new Error(`schemaVersion inesperada: ${String(raw.schemaVersion)} (esperado: 1)`);
	}
	if (typeof raw.id !== 'string') throw new Error('session.id ausente ou inválido');
	if (typeof raw.startedAt !== 'number') throw new Error('session.startedAt ausente');
	if (!Array.isArray(raw.events)) throw new Error('session.events deve ser array');
	if (!Array.isArray(raw.detectionPhases)) throw new Error('session.detectionPhases deve ser array');
	if (!isObject(raw.metadata)) throw new Error('session.metadata ausente');
}

function newImportedId(originalId: string): string {
	return `imported_${originalId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function parseDbsession(buf: ArrayBuffer): Promise<Session> {
	const zip = await JSZip.loadAsync(buf);
	const sessionFile = zip.file('session.json');
	if (!sessionFile) throw new Error('arquivo session.json ausente no .dbsession');
	const text = await sessionFile.async('text');
	const raw = JSON.parse(text);
	validateRawSession(raw);
	// Reescreve id pra evitar colisão com sessions locais; marca origin=imported.
	const imported: Session = {
		...raw,
		id: newImportedId(raw.id),
		origin: 'imported',
	};
	return imported;
}
