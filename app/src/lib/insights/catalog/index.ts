import { parsePattern } from '../pattern';
import type {
	CategoryMeta,
	CompiledDomRule,
	CompiledPattern,
	CompiledTech,
	ImpliedRef,
} from '../types';
import categoriesData from './categories.json';

// Vite eager glob: importa todos os JSONs de letra no boot.
// O padrão [a-z_].json cobre apenas arquivos de 1 letra + underscore —
// categories.json e groups.json têm nomes mais longos e não são incluídos.
const letterModules = import.meta.glob<Record<string, RawTech>>('./[a-z_].json', {
	eager: true,
	import: 'default',
});

interface RawTech {
	cats: number[];
	website: string;
	icon?: string;
	description?: string;
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

function safeParse(raw: string): CompiledPattern | null {
	try {
		return parsePattern(raw);
	} catch (err) {
		console.warn(`[insights] regex inválida descartada: '${raw}' — ${(err as Error).message}`);
		return null;
	}
}

function compileArray(raws: string[] | undefined): CompiledPattern[] | undefined {
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
): Record<string, CompiledPattern> | undefined {
	if (!raw) return undefined;
	const flat: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw)) {
		flat[k] = Array.isArray(v) ? v.join('|') : v;
	}
	return compileRecord(flat);
}

function compileDom(
	raw: string[] | string | Record<string, unknown> | undefined,
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
				if (b.attributes) rule.attributes = compileRecord(b.attributes);
				if (b.properties) rule.properties = compileRecord(b.properties);
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

function compileTech(name: string, raw: RawTech): CompiledTech | null {
	const patterns: CompiledTech['patterns'] = {};
	const js = compileRecord(raw.js);
	if (js) patterns.js = js;
	const dom = compileDom(raw.dom);
	if (dom) patterns.dom = dom;
	const meta = compileMeta(raw.meta);
	if (meta) patterns.meta = meta;
	const headers = compileRecord(raw.headers);
	if (headers) patterns.headers = headers;
	const cookies = compileRecord(raw.cookies);
	if (cookies) patterns.cookies = cookies;
	const scriptSrc = compileArray(raw.scriptSrc);
	if (scriptSrc) patterns.scriptSrc = scriptSrc;
	const scripts = compileArray(raw.scripts);
	if (scripts) patterns.scripts = scripts;
	const html = compileArray(raw.html);
	if (html) patterns.html = html;
	const text = compileArray(raw.text);
	if (text) patterns.text = text;
	const css = compileArray(raw.css);
	if (css) patterns.css = css;
	const url = compileArray(raw.url);
	if (url) patterns.url = url;
	const xhr = compileArray(raw.xhr);
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
		console.warn(`[insights] tech '${name}' sem pattern válida; descartado do catálogo`);
		return null;
	}

	return {
		name,
		cats: raw.cats,
		icon: raw.icon,
		website: raw.website,
		description: raw.description,
		patterns,
		implies: compileImplies(raw.implies),
		requires: raw.requires ?? [],
		requiresCategory: raw.requiresCategory ?? [],
		excludes: raw.excludes ?? [],
	};
}

function compileAll(): CompiledTech[] {
	const out: CompiledTech[] = [];
	for (const mod of Object.values(letterModules)) {
		for (const [name, raw] of Object.entries(mod)) {
			const c = compileTech(name, raw);
			if (c) out.push(c);
		}
	}
	return out;
}

export const COMPILED_CATALOG: CompiledTech[] = compileAll();
export const CATEGORIES: Record<string, CategoryMeta> = categoriesData as Record<
	string,
	CategoryMeta
>;
