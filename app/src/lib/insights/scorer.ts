import { applyImplications } from './implications';
import { matchTechAgainstSignal } from './matcher';
import type { CompiledTech, MatchResult, Signal, TechHit } from './types';

const EVIDENCE_CAP = 8;

export class Scorer {
	private hits = new Map<string, TechHit>();
	private compiledByName: Map<string, CompiledTech>;

	constructor(private readonly catalog: CompiledTech[]) {
		this.compiledByName = new Map(catalog.map((t) => [t.name, t]));
	}

	pushSignals(batch: Signal[]): void {
		for (const signal of batch) {
			for (const tech of this.catalog) {
				const m = matchTechAgainstSignal(tech, signal);
				if (!m) continue;
				this.upsertHit(tech, m);
			}
		}
		applyImplications(this.hits, this.compiledByName);
	}

	snapshot(): TechHit[] {
		return [...this.hits.values()];
	}

	reset(): void {
		this.hits.clear();
	}

	private upsertHit(tech: CompiledTech, m: MatchResult): void {
		const existing = this.hits.get(tech.name);
		if (!existing) {
			this.hits.set(tech.name, {
				name: tech.name,
				cats: tech.cats,
				confidence: m.confidence,
				version: m.version,
				icon: tech.icon,
				website: tech.website,
				description: tech.description,
				evidence: [m.evidence],
			});
			return;
		}
		existing.confidence = Math.min(100, existing.confidence + m.confidence);
		if (!existing.version && m.version) existing.version = m.version;
		if (existing.evidence.length < EVIDENCE_CAP) existing.evidence.push(m.evidence);
	}
}
