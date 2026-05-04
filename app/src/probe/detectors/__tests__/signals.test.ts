import { beforeEach, describe, expect, test } from 'vitest';
import { parsePattern } from '@/lib/insights/pattern';
import type { CompiledTech } from '@/lib/insights/types';
import {
	CSS_CAP,
	HTML_CAP,
	INLINE_SCRIPT_CAP,
	TEXT_CAP,
	collectMainWorldSignals,
} from '../wappalyzer/signals';

function tech(name: string, overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name,
		cats: [12],
		website: 'https://example.com',
		patterns: {},
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
		...overrides,
	};
}

describe('collectMainWorldSignals — js paths', () => {
	beforeEach(() => {
		// limpa globais entre testes para evitar vazamento
		(window as unknown as Record<string, unknown>).jQuery = undefined;
		(window as unknown as Record<string, unknown>).Shopify = undefined;
	});

	test('reads only js paths that are in the catalog', () => {
		(window as unknown as Record<string, unknown>).jQuery = { fn: { jquery: '3.6.0' } };
		(window as unknown as Record<string, unknown>).Shopify = 'something'; // não no catálogo

		const cat = [
			tech('jQuery', { patterns: { js: { 'jQuery.fn.jquery': parsePattern('([0-9.]+)') } } }),
			// note: Shopify tech intencionalmente sem entry js
		];
		const sigs = collectMainWorldSignals(cat, window, document);
		const jsSigs = sigs.filter((s) => s.kind === 'js');
		expect(jsSigs).toHaveLength(1);
		expect(jsSigs[0]).toMatchObject({ name: 'jQuery.fn.jquery', value: '3.6.0' });
	});

	test('skips js path when value is undefined', () => {
		const cat = [tech('jQuery', { patterns: { js: { 'jQuery.fn.jquery': parsePattern('') } } })];
		const sigs = collectMainWorldSignals(cat, window, document);
		expect(sigs.filter((s) => s.kind === 'js')).toHaveLength(0);
	});
});

describe('collectMainWorldSignals — DOM signals', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
	});

	test('extracts meta tags by name and property', () => {
		document.head.innerHTML = `
			<meta name="generator" content="WordPress 6.4.2" />
			<meta property="og:type" content="website" />
		`;
		const sigs = collectMainWorldSignals([], window, document);
		const metaSigs = sigs.filter((s) => s.kind === 'meta');
		expect(metaSigs).toContainEqual({ kind: 'meta', name: 'generator', value: 'WordPress 6.4.2' });
		expect(metaSigs).toContainEqual({ kind: 'meta', name: 'og:type', value: 'website' });
	});

	test('skips meta tags without name+content', () => {
		document.head.innerHTML = `
			<meta name="just-a-name" />
			<meta content="no-name" />
		`;
		const sigs = collectMainWorldSignals([], window, document);
		expect(sigs.filter((s) => s.kind === 'meta')).toHaveLength(0);
	});

	test('extracts scriptSrc and inline script content', () => {
		document.body.innerHTML = `
			<script src="https://cdn.example.com/lib.min.js"></script>
			<script>window.foo = 1;</script>
		`;
		const sigs = collectMainWorldSignals([], window, document);
		expect(sigs).toContainEqual({ kind: 'scriptSrc', value: 'https://cdn.example.com/lib.min.js' });
		expect(sigs.some((s) => s.kind === 'script' && s.value.includes('window.foo'))).toBe(true);
	});

	test('caps inline script at INLINE_SCRIPT_CAP', () => {
		const big = 'x'.repeat(INLINE_SCRIPT_CAP * 2);
		const script = document.createElement('script');
		// type="text/plain" impede jsdom de executar o conteúdo como JS —
		// comportamento idêntico ao browser para scripts sem MIME executável.
		// querySelectorAll('script') ainda retorna o elemento; o cap continua testado.
		script.type = 'text/plain';
		script.textContent = big;
		document.body.appendChild(script);
		const sigs = collectMainWorldSignals([], window, document);
		const inline = sigs.find((s) => s.kind === 'script');
		expect(inline?.value.length).toBe(INLINE_SCRIPT_CAP);
	});

	test('caps html at HTML_CAP', () => {
		// gera body grande
		document.body.innerHTML = `<div>${'x'.repeat(HTML_CAP * 2)}</div>`;
		const sigs = collectMainWorldSignals([], window, document);
		const html = sigs.find((s) => s.kind === 'html');
		expect(html?.value.length).toBe(HTML_CAP);
	});

	test('caps text at TEXT_CAP', () => {
		document.body.textContent = 'a'.repeat(TEXT_CAP * 2);
		const sigs = collectMainWorldSignals([], window, document);
		const text = sigs.find((s) => s.kind === 'text');
		expect(text?.value.length).toBe(TEXT_CAP);
	});

	test('emits url signal as location.href', () => {
		const sigs = collectMainWorldSignals([], window, document);
		const url = sigs.find((s) => s.kind === 'url');
		expect(url?.value).toBe(window.location.href);
	});
});

describe('collectMainWorldSignals — cookies', () => {
	test('parses document.cookie into name/value pairs', () => {
		// jsdom permite setar document.cookie diretamente
		document.cookie = 'session=abc123';
		document.cookie = 'wordpress_test_cookie=WP%20Cookie%20check';
		const sigs = collectMainWorldSignals([], window, document);
		const cookieSigs = sigs.filter((s) => s.kind === 'cookie');
		expect(cookieSigs.find((c) => c.name === 'session')?.value).toBe('abc123');
		expect(cookieSigs.find((c) => c.name === 'wordpress_test_cookie')?.value).toBe(
			'WP%20Cookie%20check',
		);
	});
});

describe('collectMainWorldSignals — css', () => {
	test('aggregates cssText from accessible stylesheets', () => {
		const style = document.createElement('style');
		style.textContent = '.foo { color: red; }';
		document.head.appendChild(style);
		const sigs = collectMainWorldSignals([], window, document);
		const css = sigs.find((s) => s.kind === 'css');
		expect(css?.value).toContain('.foo');
	});

	test('caps css at CSS_CAP and respects cap mid-stylesheet', () => {
		const long = `.x { content: '${'a'.repeat(CSS_CAP)}'; }`;
		const style = document.createElement('style');
		style.textContent = long;
		document.head.appendChild(style);
		const sigs = collectMainWorldSignals([], window, document);
		const css = sigs.find((s) => s.kind === 'css');
		expect(css?.value.length).toBeLessThanOrEqual(CSS_CAP);
	});
});
