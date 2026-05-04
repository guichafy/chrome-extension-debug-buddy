import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { applyImplications } from '@/lib/insights/implications';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech, TechHit } from '@/lib/insights/types';
import { evaluateDomRules } from './wappalyzer/domEval';
import { collectMainWorldSignals } from './wappalyzer/signals';

const EVIDENCE_CAP = 8;

export function detectTechs(win: Window, doc: Document): TechHit[] {
	const scorer = new Scorer(COMPILED_CATALOG);
	scorer.pushSignals(collectMainWorldSignals(COMPILED_CATALOG, win, doc));
	const sigHits = scorer.snapshot();

	const domHits = evaluateDomRules(COMPILED_CATALOG, doc);

	const map = new Map<string, TechHit>(sigHits.map((h) => [h.name, h]));
	for (const dh of domHits) {
		const existing = map.get(dh.name);
		if (!existing) {
			map.set(dh.name, dh);
			continue;
		}
		existing.confidence = Math.min(100, existing.confidence + dh.confidence);
		if (!existing.version && dh.version) existing.version = dh.version;
		for (const ev of dh.evidence) {
			if (existing.evidence.length >= EVIDENCE_CAP) break;
			existing.evidence.push(ev);
		}
	}

	// Re-aplica implications: DOM matches podem ter adicionado techs novos.
	const byName = new Map<string, CompiledTech>(COMPILED_CATALOG.map((t) => [t.name, t]));
	applyImplications(map, byName);
	return [...map.values()];
}
