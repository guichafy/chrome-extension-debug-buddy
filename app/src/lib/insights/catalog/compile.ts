// Compilador compartilhado entre o catálogo full (catalog/index.ts) e o lean
// (catalog/lean/index.ts). Cada index só declara o shape Raw específico, faz o
// `import.meta.glob` da sua pasta (paths relativos não atravessam helpers) e
// chama `compileCatalogBase` passando os modules + um callback para os campos
// UI-only (icon, website, description) — lean omite website real porque o
// probe não precisa do dado.

import { parsePattern } from '../pattern';
import type {
	CompiledDomRule,
	CompiledPattern,
	CompiledTech,
	ImpliedRef,
} from '../types';

export interface RawTechBase {
	cats: number[];
	cookies?: Record<string, string>;
	dom?: string[] | string | Record<string, unknown>;
	js?: Record<string, string>;
	headers?: Record<string, string>;
	html?: string[];
	text?: string[];
	css?: string[];
	meta?: Record<string, string | string[]>;
	scriptSrc?: string[];
	scripts?: string[];
	url?: string[];
	xhr?: string[];
	implies?: string[];
	requires?: string[];
	requiresCategory?: number[];
	excludes?: string[];
}

type SafeParse = (raw: string) => CompiledPattern | null;

function makeSafeParse(logPrefix: string): SafeParse {
	return (raw) => {
		try {
			return parsePattern(raw);
		} catch (err) {
			console.warn(
				`${logPrefix} regex inválida descartada: '${raw}' — ${(err as Error).message}`,
			);
			return null;
		}
	};
}

function compileArray(
	raws: string[] | undefined,
	safeParse: SafeParse,
): CompiledPattern[] | undefined {
	if (!raws) return undefined;
	const out: CompiledPattern[] = [];
	for (const r of raws) {
		const p = safeParse(r);
		if (p) out.push(p);
	}
	return out.length > 0 ? out : undefined;
}

function compileRecord(
	raw: Record<string, string> | undefined,
	safeParse: SafeParse,
): Record<string, CompiledPattern> | undefined {
	if (!raw) return undefined;
	const out: Record<string, CompiledPattern> = {};
	for (const [k, v] of Object.entries(raw)) {
		const p = safeParse(v);
		if (p) out[k] = p;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function compileMeta(
	raw: Record<string, string | string[]> | undefined,
	safeParse: SafeParse,
): Record<string, CompiledPattern> | undefined {
	if (!raw) return undefined;
	const flat: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw)) {
		flat[k] = Array.isArray(v) ? v.join('|') : v;
	}
	return compileRecord(flat, safeParse);
}

function compileDom(
	raw: string[] | string | Record<string, unknown> | undefined,
	safeParse: SafeParse,
): CompiledDomRule[] | undefined {
	if (!raw) return undefined;
	const rules: CompiledDomRule[] = [];
	if (typeof raw === 'string') {
		rules.push({ selector: raw, exists: true });
	} else if (Array.isArray(raw)) {
		for (const sel of raw) rules.push({ selector: sel, exists: true });
	} else {
		for (const [selector, body] of Object.entries(raw)) {
			const rule: CompiledDomRule = { selector };
			if (typeof body === 'object' && body !== null) {
				const b = body as {
					exists?: string;
					attributes?: Record<string, string>;
					properties?: Record<string, string>;
					text?: string;
				};
				if (b.exists !== undefined) rule.exists = true;
				if (b.attributes) rule.attributes = compileRecord(b.attributes, safeParse);
				if (b.properties) rule.properties = compileRecord(b.properties, safeParse);
				if (b.text !== undefined) {
					const p = safeParse(b.text);
					if (p) rule.text = p;
				}
			}
			rules.push(rule);
		}
	}
	return rules.length > 0 ? rules : undefined;
}

function compileImplies(raws: string[] | undefined): ImpliedRef[] {
	if (!raws) return [];
	return raws
		.map((r) => {
			// formato `Name\;confidence:N`
			const parts = r.split('\\;');
			const name = parts[0];
			let confidence = 100;
			for (let i = 1; i < parts.length; i++) {
				const part = parts[i];
				if (part.startsWith('confidence:')) {
					const n = Number(part.slice('confidence:'.length));
					if (Number.isFinite(n)) confidence = Math.max(0, Math.min(100, n));
				}
			}
			return { name, confidence };
		})
		.filter((r) => r.name.length > 0);
}

type ExtraFields = Pick<CompiledTech, 'icon' | 'website' | 'description'>;

function compileTech<T extends RawTechBase>(
	name: string,
	raw: T,
	safeParse: SafeParse,
	logPrefix: string,
	extraFields: (raw: T) => ExtraFields,
): CompiledTech | null {
	const patterns: CompiledTech['patterns'] = {};
	const js = compileRecord(raw.js, safeParse);
	if (js) patterns.js = js;
	const dom = compileDom(raw.dom, safeParse);
	if (dom) patterns.dom = dom;
	const meta = compileMeta(raw.meta, safeParse);
	if (meta) patterns.meta = meta;
	const headers = compileRecord(raw.headers, safeParse);
	if (headers) patterns.headers = headers;
	const cookies = compileRecord(raw.cookies, safeParse);
	if (cookies) patterns.cookies = cookies;
	const scriptSrc = compileArray(raw.scriptSrc, safeParse);
	if (scriptSrc) patterns.scriptSrc = scriptSrc;
	const scripts = compileArray(raw.scripts, safeParse);
	if (scripts) patterns.scripts = scripts;
	const html = compileArray(raw.html, safeParse);
	if (html) patterns.html = html;
	const text = compileArray(raw.text, safeParse);
	if (text) patterns.text = text;
	const css = compileArray(raw.css, safeParse);
	if (css) patterns.css = css;
	const url = compileArray(raw.url, safeParse);
	if (url) patterns.url = url;
	const xhr = compileArray(raw.xhr, safeParse);
	if (xhr) patterns.xhr = xhr;

	const hasAny =
		patterns.js ||
		patterns.dom ||
		patterns.meta ||
		patterns.headers ||
		patterns.cookies ||
		patterns.scriptSrc ||
		patterns.scripts ||
		patterns.html ||
		patterns.text ||
		patterns.css ||
		patterns.url ||
		patterns.xhr;

	if (!hasAny) {
		console.warn(`${logPrefix} tech '${name}' sem pattern válida; descartado do catálogo`);
		return null;
	}

	return {
		name,
		cats: raw.cats,
		...extraFields(raw),
		patterns,
		implies: compileImplies(raw.implies),
		requires: raw.requires ?? [],
		requiresCategory: raw.requiresCategory ?? [],
		excludes: raw.excludes ?? [],
	};
}

export function compileCatalogBase<T extends RawTechBase>(
	letterModules: Record<string, Record<string, T>>,
	logPrefix: string,
	extraFields: (raw: T) => ExtraFields,
): CompiledTech[] {
	const safeParse = makeSafeParse(logPrefix);
	const out: CompiledTech[] = [];
	for (const mod of Object.values(letterModules)) {
		for (const [name, raw] of Object.entries(mod)) {
			const c = compileTech(name, raw, safeParse, logPrefix, extraFields);
			if (c) out.push(c);
		}
	}
	return out;
}
