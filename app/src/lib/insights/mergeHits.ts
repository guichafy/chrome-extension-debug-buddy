import { applyImplications } from './implications';
import type { CompiledTech, TechHit } from './types';

const EVIDENCE_CAP = 8;

/**
 * Merge dois conjuntos de TechHit (existente + incoming) reaplicando
 * implications no resultado. Pure: não muta os arrays de entrada (clona
 * os hits existentes antes de mexer).
 */
export function mergeHits(
	existing: TechHit[],
	incoming: TechHit[],
	compiledByName: Map<string, CompiledTech>,
): TechHit[] {
	const map = new Map<string, TechHit>(
		existing.map((h) => [h.name, cloneHit(h)]),
	);
	for (const inc of incoming) {
		const ex = map.get(inc.name);
		if (!ex) {
			map.set(inc.name, cloneHit(inc));
			continue;
		}
		ex.confidence = Math.min(100, ex.confidence + inc.confidence);
		if (!ex.version && inc.version) ex.version = inc.version;
		if (!ex.icon && inc.icon) ex.icon = inc.icon;
		if ((!ex.website || ex.website === '') && inc.website) ex.website = inc.website;
		if (!ex.description && inc.description) ex.description = inc.description;
		for (const evi of inc.evidence) {
			if (ex.evidence.length >= EVIDENCE_CAP) break;
			ex.evidence.push(evi);
		}
	}
	applyImplications(map, compiledByName);
	return [...map.values()];
}

function cloneHit(h: TechHit): TechHit {
	return {
		name: h.name,
		cats: [...h.cats],
		confidence: h.confidence,
		version: h.version,
		icon: h.icon,
		website: h.website,
		description: h.description,
		evidence: [...h.evidence],
		implied: h.implied,
	};
}
