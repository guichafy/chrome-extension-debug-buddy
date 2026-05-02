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

export function fingerprintsEqual(
	a: EnvironmentFingerprint,
	b: EnvironmentFingerprint,
): boolean {
	if (a.framework.name !== b.framework.name) return false;
	if (a.framework.version !== b.framework.version) return false;
	if (!sameSet(a.httpClients, b.httpClients, (c) => `${c.name}:${c.confidence}`)) {
		return false;
	}
	if (
		!sameSet(
			a.dataFetching,
			b.dataFetching,
			(d) => `${d.name}:${d.version ?? ''}:${d.treatment}`,
		)
	) {
		return false;
	}
	if (
		!sameSet(
			a.stateManagers,
			b.stateManagers,
			(s) => `${s.name}:${s.storesDetected}:${s.treatment}`,
		)
	) {
		return false;
	}
	return true;
}

function newPhaseId(): string {
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
		if (fingerprintsEqual(current.fingerprint, d.fingerprint)) {
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
