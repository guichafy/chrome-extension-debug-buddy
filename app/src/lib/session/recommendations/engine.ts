import type { NetworkRuleEvent, Recommendation, RuleContext, RuleDescriptor } from './types';

const MAX_DEDUP = 1000;

export class RecommendationEngine {
	private dedup = new Set<string>();
	private dedupOrder: string[] = [];

	constructor(private readonly rules: RuleDescriptor[]) {}

	pushResponse(ev: NetworkRuleEvent, ctx: RuleContext): Recommendation[] {
		const out: Recommendation[] = [];
		for (const { rule } of this.rules) {
			const partial = rule(ev, ctx);
			if (!partial) continue;
			const key = this.dedupKey(partial.ruleId, partial.url, partial.host);
			if (this.dedup.has(key)) continue;
			this.dedup.add(key);
			this.dedupOrder.push(key);
			this.evictIfNeeded();
			out.push({ ...partial, id: crypto.randomUUID(), timestamp: Date.now() });
		}
		return out;
	}

	reset(): void {
		this.dedup.clear();
		this.dedupOrder = [];
	}

	private dedupKey(ruleId: string, url: string, host: string): string {
		let pathname: string;
		try {
			pathname = new URL(url).pathname;
		} catch {
			pathname = url;
		}
		return `${ruleId}|${host}|${pathname}`;
	}

	private evictIfNeeded(): void {
		while (this.dedupOrder.length > MAX_DEDUP) {
			const oldest = this.dedupOrder.shift();
			if (oldest !== undefined) this.dedup.delete(oldest);
		}
	}
}
