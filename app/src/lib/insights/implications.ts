import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES — techs detectadas removem rivais antes de qualquer derivação.
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}
}
