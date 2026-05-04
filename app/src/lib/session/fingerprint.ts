import type {
	DetectionPhase,
	EnvironmentFingerprint,
	PageDetection,
} from './types';

export function sameSet<T>(a: T[], b: T[], key: (item: T) => string): boolean {
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

// Mantido como alias interno para comparação de fingerprints de metadata.
// Agora é no-op: fingerprint só carrega {detectedAt, isProductionBuild} e
// esses campos não determinam mudança de fase — techs determinam.
export function fingerprintsEqual(
	_a: EnvironmentFingerprint,
	_b: EnvironmentFingerprint,
): boolean {
	return true;
}

export function newPhaseId(): string {
	return `phase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function groupConsecutiveDetections(
	detections: PageDetection[],
): DetectionPhase[] {
	if (detections.length === 0) return [];
	const phases: DetectionPhase[] = [];
	let current: DetectionPhase = {
		id: newPhaseId(),
		startTimestamp: detections[0].timestamp,
		endTimestamp: detections[0].timestamp,
		fingerprint: detections[0].fingerprint,
		pages: [detections[0]],
	};
	for (let i = 1; i < detections.length; i++) {
		const d = detections[i];
		if (pageDetectionsHaveSameTechs(current.pages[current.pages.length - 1], d)) {
			current.pages.push(d);
			current.endTimestamp = d.timestamp;
		} else {
			phases.push(current);
			current = {
				id: newPhaseId(),
				startTimestamp: d.timestamp,
				endTimestamp: d.timestamp,
				fingerprint: d.fingerprint,
				pages: [d],
			};
		}
	}
	phases.push(current);
	return phases;
}
