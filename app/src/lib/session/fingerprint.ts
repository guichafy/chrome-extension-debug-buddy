import type { PageDetection } from './types';

function sameSet<T>(a: T[], b: T[], key: (item: T) => string): boolean {
	if (a.length !== b.length) return false;
	const ak = a.map(key).sort();
	const bk = b.map(key).sort();
	for (let i = 0; i < ak.length; i++) {
		if (ak[i] !== bk[i]) return false;
	}
	return true;
}

// Compara duas PageDetections pelo conjunto de techs detectadas (por nome).
// Duas detections com o mesmo conjunto de nomes são consideradas do mesmo
// ambiente — diferenças de version/confidence não abrem nova fase (evita
// flapping em re-detections leves). Ausência de techs em ambas → iguais.
export function pageDetectionsHaveSameTechs(a: PageDetection, b: PageDetection): boolean {
	const at = a.techs ?? [];
	const bt = b.techs ?? [];
	return sameSet(at, bt, (t) => t.name);
}

export function newPhaseId(): string {
	return `phase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
