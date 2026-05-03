import { expandVersion } from './pattern';
import type {
	CompiledPattern,
	CompiledTech,
	MatchResult,
	Signal,
	SignalKind,
} from './types';

function buildResult(
	signal: SignalKind,
	pattern: CompiledPattern,
	groups: RegExpMatchArray,
	matchedName?: string,
): MatchResult {
	return {
		confidence: pattern.confidence,
		version: expandVersion(pattern.versionTemplate, groups),
		evidence: { signal, pattern: pattern.raw, matchedName },
	};
}

function matchString(
	value: string,
	patterns: CompiledPattern[] | undefined,
): { pattern: CompiledPattern; groups: RegExpMatchArray } | null {
	if (!patterns) return null;
	for (const p of patterns) {
		const m = value.match(p.regex);
		if (m) return { pattern: p, groups: m };
	}
	return null;
}

function matchKeyValue(
	signalName: string | undefined,
	signalValue: string,
	patternsByKey: Record<string, CompiledPattern> | undefined,
): { pattern: CompiledPattern; groups: RegExpMatchArray; key: string } | null {
	if (!patternsByKey || signalName === undefined) return null;
	for (const [key, p] of Object.entries(patternsByKey)) {
		// Schema upstream usa o nome como regex case-insensitive.
		const keyRegex = new RegExp(`^${key}$`, 'i');
		if (!keyRegex.test(signalName)) continue;
		// Pattern com source vazio = "qualquer valor". Match force-true.
		const m = p.regex.source === '(?:)' ? ['' as string] : signalValue.match(p.regex);
		if (m) return { pattern: p, groups: m as RegExpMatchArray, key };
	}
	return null;
}

export function matchTechAgainstSignal(
	tech: CompiledTech,
	signal: Signal,
): MatchResult | null {
	const pat = tech.patterns;
	switch (signal.kind) {
		case 'header': {
			const r = matchKeyValue(signal.name, signal.value, pat.headers);
			return r ? buildResult('header', r.pattern, r.groups, signal.name) : null;
		}
		case 'cookie': {
			const r = matchKeyValue(signal.name, signal.value, pat.cookies);
			return r ? buildResult('cookie', r.pattern, r.groups, signal.name) : null;
		}
		case 'meta': {
			const r = matchKeyValue(signal.name, signal.value, pat.meta);
			return r ? buildResult('meta', r.pattern, r.groups, signal.name) : null;
		}
		case 'js': {
			const r = matchKeyValue(signal.name, signal.value, pat.js);
			return r ? buildResult('js', r.pattern, r.groups, signal.name) : null;
		}
		case 'scriptSrc': {
			const r = matchString(signal.value, pat.scriptSrc);
			return r ? buildResult('scriptSrc', r.pattern, r.groups) : null;
		}
		case 'script': {
			const r = matchString(signal.value, pat.scripts);
			return r ? buildResult('script', r.pattern, r.groups) : null;
		}
		case 'html': {
			const r = matchString(signal.value, pat.html);
			return r ? buildResult('html', r.pattern, r.groups) : null;
		}
		case 'text': {
			const r = matchString(signal.value, pat.text);
			return r ? buildResult('text', r.pattern, r.groups) : null;
		}
		case 'css': {
			const r = matchString(signal.value, pat.css);
			return r ? buildResult('css', r.pattern, r.groups) : null;
		}
		case 'url': {
			const r = matchString(signal.value, pat.url);
			return r ? buildResult('url', r.pattern, r.groups) : null;
		}
		case 'xhr': {
			const r = matchString(signal.value, pat.xhr);
			return r ? buildResult('xhr', r.pattern, r.groups) : null;
		}
		case 'dom':
			// dom é tratado pelo detector do probe (Sub-projeto 2). Matcher genérico
			// não recebe Signal{kind:'dom'} desta fase em diante.
			return null;
		case 'implied':
			// 'implied' é evidence sintética emitida por applyImplications,
			// não um signal de match real.
			return null;
	}
}
