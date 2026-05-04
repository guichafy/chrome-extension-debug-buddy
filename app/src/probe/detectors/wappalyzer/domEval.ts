import { expandVersion } from '@/lib/insights/pattern';
import type {
	CompiledDomRule,
	CompiledPattern,
	CompiledTech,
	MatchEvidence,
	TechHit,
} from '@/lib/insights/types';

interface ElementMatchResult {
	confidence: number;
	version?: string;
	matchedName?: string;
}

function tryMatch(value: string | null, pattern: CompiledPattern): ElementMatchResult | null {
	if (value === null) return null;
	const m = value.match(pattern.regex);
	if (!m) return null;
	return {
		confidence: pattern.confidence,
		version: expandVersion(pattern.versionTemplate, m),
	};
}

function readProperty(el: Element, prop: string): string | null {
	try {
		const v = (el as unknown as Record<string, unknown>)[prop];
		if (v === null || v === undefined) return null;
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		return null;
	} catch {
		// getter pode throw — não fabricamos
		return null;
	}
}

function matchDomRuleAgainstElement(rule: CompiledDomRule, el: Element): ElementMatchResult | null {
	let totalConfidence = 0;
	let version: string | undefined;
	let matchedName: string | undefined;
	let anyHit = false;

	if (rule.attributes) {
		for (const [attr, pattern] of Object.entries(rule.attributes)) {
			const r = tryMatch(el.getAttribute(attr), pattern);
			if (r) {
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
				if (!matchedName) matchedName = `attr:${attr}`;
				anyHit = true;
			}
		}
	}
	if (rule.properties) {
		for (const [prop, pattern] of Object.entries(rule.properties)) {
			const r = tryMatch(readProperty(el, prop), pattern);
			if (r) {
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
				if (!matchedName) matchedName = `prop:${prop}`;
				anyHit = true;
			}
		}
	}
	if (rule.text) {
		const r = tryMatch(el.textContent, rule.text);
		if (r) {
			totalConfidence += r.confidence;
			if (!version && r.version) version = r.version;
			if (!matchedName) matchedName = 'text';
			anyHit = true;
		}
	}

	if (!anyHit) return null;
	return { confidence: totalConfidence, version, matchedName };
}

export function evaluateDomRules(catalog: CompiledTech[], doc: Document): TechHit[] {
	const out: TechHit[] = [];
	for (const tech of catalog) {
		if (!tech.patterns.dom) continue;
		const evidence: MatchEvidence[] = [];
		let totalConfidence = 0;
		let version: string | undefined;

		for (const rule of tech.patterns.dom) {
			if (evidence.length >= 8) break; // cap por tech
			let els: NodeListOf<Element>;
			try {
				els = doc.querySelectorAll(rule.selector);
			} catch {
				// selector inválido — pula sem fabricar match
				continue;
			}
			if (els.length === 0) continue;
			if (!rule.attributes && !rule.properties && !rule.text) {
				evidence.push({ signal: 'dom', pattern: rule.selector });
				totalConfidence += 100;
				continue;
			}
			for (const el of Array.from(els)) {
				if (evidence.length >= 8) break;
				const r = matchDomRuleAgainstElement(rule, el);
				if (!r) continue;
				evidence.push({
					signal: 'dom',
					pattern: rule.selector,
					matchedName: r.matchedName,
				});
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
			}
		}

		if (evidence.length === 0) continue;
		out.push({
			name: tech.name,
			cats: tech.cats,
			confidence: Math.min(100, totalConfidence),
			version,
			icon: tech.icon,
			website: tech.website,
			description: tech.description,
			evidence,
		});
	}
	return out;
}
