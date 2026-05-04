export type Confidence = number; // 0-100. Display: high>=75, mid 50-74, low<50.

export type SignalKind =
	| 'js'
	| 'dom'
	| 'meta'
	| 'header'
	| 'cookie'
	| 'scriptSrc'
	| 'script'
	| 'html'
	| 'text'
	| 'css'
	| 'url'
	| 'xhr'
	| 'implied'; // sentinel — evidence sintética para hits derivados via `implies`

export interface Signal {
	kind: SignalKind;
	name?: string; // preenchido em header/cookie/meta/js/dom-prop
	value: string;
}

export interface MatchEvidence {
	signal: SignalKind;
	pattern: string;
	matchedName?: string;
}

export interface MatchResult {
	confidence: Confidence;
	version?: string;
	evidence: MatchEvidence;
}

export interface TechHit {
	name: string;
	cats: number[];
	confidence: Confidence;
	version?: string;
	icon?: string;
	website?: string;
	description?: string;
	evidence: MatchEvidence[]; // cap em 8
	implied?: boolean;
}

export interface CompiledPattern {
	regex: RegExp;
	confidence: Confidence;
	versionTemplate?: string;
	raw: string;
}

export interface CompiledDomRule {
	selector: string;
	exists?: boolean;
	attributes?: Record<string, CompiledPattern>;
	properties?: Record<string, CompiledPattern>;
	text?: CompiledPattern;
}

export interface ImpliedRef {
	name: string;
	confidence: Confidence;
}

export interface CompiledTech {
	name: string;
	cats: number[];
	icon?: string;
	website: string;
	description?: string;
	patterns: {
		js?: Record<string, CompiledPattern>;
		dom?: CompiledDomRule[];
		meta?: Record<string, CompiledPattern>;
		headers?: Record<string, CompiledPattern>;
		cookies?: Record<string, CompiledPattern>;
		scriptSrc?: CompiledPattern[];
		scripts?: CompiledPattern[];
		html?: CompiledPattern[];
		text?: CompiledPattern[];
		css?: CompiledPattern[];
		url?: CompiledPattern[];
		xhr?: CompiledPattern[];
	};
	implies: ImpliedRef[];
	requires: string[];
	requiresCategory: number[];
	excludes: string[];
}

export interface CategoryMeta {
	name: string;
	priority: number;
	groups?: number[];
}
