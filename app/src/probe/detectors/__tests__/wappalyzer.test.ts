import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { detectTechs } from '../wappalyzer';

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	// limpa globais comuns
	for (const k of ['jQuery', '$', '__NEXT_DATA__', 'Shopify', 'wp']) {
		(window as unknown as Record<string, unknown>)[k] = undefined;
	}
});

afterEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

describe('detectTechs — empty page', () => {
	test('returns empty array on a blank document', () => {
		const techs = detectTechs(window, document);
		expect(techs).toEqual([]);
	});
});

describe('detectTechs — WordPress page', () => {
	test('detects WordPress and implies PHP', () => {
		document.head.innerHTML = `
			<meta name="generator" content="WordPress 6.4.2" />
			<link rel="stylesheet" href="/wp-content/themes/twentytwentyfour/style.css" />
			<link rel="stylesheet" href="/wp-includes/css/dist/block-library/style.min.css" />
		`;
		document.body.innerHTML = `
			<script src="/wp-content/plugins/jetpack/jet.js"></script>
			<script src="/wp-includes/js/wp-emoji.js"></script>
		`;

		const techs = detectTechs(window, document);
		const names = techs.map((t) => t.name);
		expect(names).toContain('WordPress');
		expect(names).toContain('PHP'); // implies
	});

	test('captures WordPress version from meta generator', () => {
		document.head.innerHTML = `<meta name="generator" content="WordPress 6.4.2" />`;
		document.body.innerHTML = `<script src="/wp-content/x.js"></script>`;
		const techs = detectTechs(window, document);
		const wp = techs.find((t) => t.name === 'WordPress');
		expect(wp?.version).toBe('6.4.2');
	});
});

describe('detectTechs — Shopify page', () => {
	test('detects Shopify from CDN scripts', () => {
		document.body.innerHTML = `
			<script src="https://cdn.shopify.com/s/files/1/0001/0001/t/2/assets/theme.js"></script>
		`;
		const techs = detectTechs(window, document);
		expect(techs.map((t) => t.name)).toContain('Shopify');
	});
});

describe('detectTechs — Next.js page', () => {
	test('detects Next.js via __NEXT_DATA__ global and implies React', () => {
		(window as unknown as Record<string, unknown>).__NEXT_DATA__ = { props: {} };
		const techs = detectTechs(window, document);
		const names = techs.map((t) => t.name);
		expect(names).toContain('Next.js');
		expect(names).toContain('React');
	});
});

describe('detectTechs — jQuery via window global', () => {
	test('detects jQuery and captures version', () => {
		const fn = function jQueryStub() {};
		(fn as unknown as { fn: { jquery: string } }).fn = { jquery: '3.6.0' };
		(window as unknown as Record<string, unknown>).jQuery = fn;
		const techs = detectTechs(window, document);
		const jq = techs.find((t) => t.name === 'jQuery');
		expect(jq).toBeDefined();
		expect(jq?.version).toBe('3.6.0');
	});
});
