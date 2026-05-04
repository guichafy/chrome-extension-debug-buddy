import { beforeEach, describe, expect, test } from 'vitest';
import { parsePattern } from '@/lib/insights/pattern';
import type { CompiledDomRule, CompiledTech } from '@/lib/insights/types';
import { evaluateDomRules } from '../wappalyzer/domEval';

function tech(name: string, dom: CompiledDomRule[]): CompiledTech {
	return {
		name,
		cats: [12],
		website: 'https://example.com',
		patterns: { dom },
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
	};
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('evaluateDomRules', () => {
	test('matches exists-only rule when selector finds elements', () => {
		document.body.innerHTML = '<div class="wp-block-group"></div>';
		const cat = [tech('WP', [{ selector: 'div.wp-block-group', exists: true }])];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
		expect(hits[0].name).toBe('WP');
		expect(hits[0].confidence).toBe(100);
		expect(hits[0].evidence[0].signal).toBe('dom');
	});

	test('returns empty hit list when no rule matches', () => {
		document.body.innerHTML = '<p>nothing</p>';
		const cat = [tech('WP', [{ selector: 'div.wp-block-group', exists: true }])];
		expect(evaluateDomRules(cat, document)).toEqual([]);
	});

	test('matches attribute regex', () => {
		document.body.innerHTML = '<link rel="stylesheet" href="cdn.shopify.com/x.css" />';
		const cat = [
			tech('Shopify', [
				{
					selector: 'link[href]',
					attributes: { href: parsePattern('cdn\\.shopify\\.com\\;confidence:50') },
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
		expect(hits[0].confidence).toBe(50);
	});

	test('captures version from attribute regex group', () => {
		document.body.innerHTML = '<div data-react-version="18.2.0"></div>';
		const cat = [
			tech('React', [
				{
					selector: 'div[data-react-version]',
					attributes: {
						'data-react-version': parsePattern('([0-9.]+)\\;version:\\1'),
					},
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].version).toBe('18.2.0');
	});

	test('matches text content regex', () => {
		document.body.innerHTML = '<p class="footer">Powered by Magento</p>';
		const cat = [
			tech('Magento', [{ selector: 'p.footer', text: parsePattern('Powered by Magento') }]),
		];
		expect(evaluateDomRules(cat, document)).toHaveLength(1);
	});

	test('skips rule with invalid CSS selector without throwing', () => {
		const cat = [tech('Bad', [{ selector: 'this is :: not valid', exists: true }])];
		expect(() => evaluateDomRules(cat, document)).not.toThrow();
		expect(evaluateDomRules(cat, document)).toEqual([]);
	});

	test('caps evidence at 8 even with many matching elements', () => {
		const html = Array.from({ length: 20 }, (_, i) => `<div class="x" id="i${i}"></div>`).join('');
		document.body.innerHTML = html;
		const cat = [tech('T', [{ selector: 'div.x', exists: true }])];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].evidence.length).toBeLessThanOrEqual(8);
	});

	test('multiple rules contribute confidence per tech, capped at 100', () => {
		document.body.innerHTML = `
			<link rel="stylesheet" href="/wp-content/x.css" />
			<link rel="stylesheet" href="/wp-includes/y.css" />
		`;
		const cat = [
			tech('WP', [
				{
					selector: 'link[href*="/wp-content/"]',
					exists: true,
				},
				{
					selector: 'link[href*="/wp-includes/"]',
					exists: true,
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].confidence).toBe(100); // 100+100 capa em 100
	});

	test('reads property via element subscript', () => {
		document.body.innerHTML = '<input id="x" />';
		const el = document.getElementById('x') as HTMLInputElement;
		(el as unknown as Record<string, unknown>).customProp = 'custom-value';
		const cat = [
			tech('PropTech', [
				{
					selector: '#x',
					properties: { customProp: parsePattern('custom-value') },
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
	});
});
