import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES — techs detectadas removem rivais.
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}

	// 2. REQUIRES — limpa órfãs (tech cujo dep não foi encontrado).
	const namesNow = new Set(hits.keys());
	const catsNow = new Set<number>();
	for (const h of hits.values()) for (const c of h.cats) catsNow.add(c);
	for (const hit of [...hits.values()]) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		const reqOk = tech.requires.every((r) => namesNow.has(r));
		const reqCatOk = tech.requiresCategory.every((c) => catsNow.has(c));
		if (!reqOk || !reqCatOk) hits.delete(hit.name);
	}
}
