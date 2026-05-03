import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}

	// 2. REQUIRES
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

	// 3. IMPLIES — loop com depth guard contra ciclos.
	let changed = true;
	let guard = MAX_IMPLIES_DEPTH;
	while (changed && guard-- > 0) {
		changed = false;
		for (const hit of [...hits.values()]) {
			const tech = catalog.get(hit.name);
			if (!tech) continue;
			for (const imp of tech.implies) {
				if (hits.has(imp.name)) continue;
				const implied = catalog.get(imp.name);
				if (!implied) continue;
				hits.set(imp.name, {
					name: implied.name,
					cats: implied.cats,
					confidence: imp.confidence,
					icon: implied.icon,
					website: implied.website,
					description: implied.description,
					evidence: [{ signal: 'implied', pattern: `implied by ${hit.name}` }],
					implied: true,
				});
				changed = true;
			}
		}
	}
	if (changed && guard <= 0) {
		// Ciclo / cadeia mais profunda do que MAX_IMPLIES_DEPTH. Para sem alterar
		// estado adicional. UI reflete o que já foi inferido até aqui.
		console.warn(
			`[insights] applyImplications atingiu depth máximo (${MAX_IMPLIES_DEPTH}); possível ciclo no catálogo`,
		);
	}
}
