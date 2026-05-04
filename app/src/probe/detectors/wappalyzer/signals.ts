import type { CompiledTech, Signal } from '@/lib/insights/types';
import { readDottedPath, serializeJsValue } from './jsPath';

export const HTML_CAP = 100_000;
export const TEXT_CAP = 50_000;
export const CSS_CAP = 50_000;
export const INLINE_SCRIPT_CAP = 20_000;

export function collectMainWorldSignals(
	catalog: CompiledTech[],
	win: Window,
	doc: Document,
): Signal[] {
	const out: Signal[] = [];

	// js — só lê paths que aparecem em algum tech do catálogo
	const jsKeys = new Set<string>();
	for (const t of catalog) {
		if (t.patterns.js) for (const k of Object.keys(t.patterns.js)) jsKeys.add(k);
	}
	for (const path of jsKeys) {
		const value = readDottedPath(win, path);
		if (value === undefined) continue;
		out.push({ kind: 'js', name: path, value: serializeJsValue(value) });
	}

	// meta — <meta name=X content=Y> e <meta property=X content=Y>
	const metas = doc.head?.querySelectorAll('meta') ?? [];
	for (const m of metas) {
		const name = m.getAttribute('name') ?? m.getAttribute('property');
		const content = m.getAttribute('content');
		if (name && content) out.push({ kind: 'meta', name, value: content });
	}

	// cookies — document.cookie (não-HttpOnly)
	for (const part of doc.cookie.split(';')) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf('=');
		const name = eq === -1 ? trimmed : trimmed.slice(0, eq);
		const value = eq === -1 ? '' : trimmed.slice(eq + 1);
		if (name) out.push({ kind: 'cookie', name, value });
	}

	// scriptSrc + scripts (inline) — DOM pass único
	for (const s of doc.querySelectorAll('script')) {
		const src = s.getAttribute('src');
		if (src) {
			out.push({ kind: 'scriptSrc', value: src });
		} else if (s.textContent) {
			out.push({ kind: 'script', value: s.textContent.slice(0, INLINE_SCRIPT_CAP) });
		}
	}

	// html — outerHTML capado
	const outer = doc.documentElement?.outerHTML;
	if (outer) out.push({ kind: 'html', value: outer.slice(0, HTML_CAP) });

	// text — body textContent capado
	const text = doc.body?.textContent;
	if (text) out.push({ kind: 'text', value: text.slice(0, TEXT_CAP) });

	// css — agrega cssText de stylesheets acessíveis
	let cssBuf = '';
	outer_loop: for (const ss of Array.from(doc.styleSheets)) {
		try {
			for (const rule of Array.from(ss.cssRules)) {
				cssBuf += rule.cssText;
				if (cssBuf.length >= CSS_CAP) break outer_loop;
			}
		} catch {
			// cross-origin stylesheet — sem acesso por design do browser, pulamos
			// sem fabricar valor
		}
	}
	if (cssBuf) out.push({ kind: 'css', value: cssBuf.slice(0, CSS_CAP) });

	// url — location.href
	out.push({ kind: 'url', value: win.location.href });

	return out;
}
