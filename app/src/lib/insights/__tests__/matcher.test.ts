import { describe, expect, test } from 'vitest';
import { parsePattern } from '../pattern';
import { matchTechAgainstSignal } from '../matcher';
import type { CompiledTech, Signal } from '../types';

function makeTech(overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name: 'TestTech',
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

describe('matchTechAgainstSignal — header', () => {
	test('matches header by name + value', () => {
		const tech = makeTech({
			patterns: {
				headers: { 'X-Powered-By': parsePattern('Express') },
			},
		});
		const sig: Signal = { kind: 'header', name: 'x-powered-by', value: 'Express/4.18.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r).not.toBeNull();
		expect(r?.evidence.signal).toBe('header');
		expect(r?.evidence.matchedName).toBe('x-powered-by');
	});

	test('returns null when header name does not match', () => {
		const tech = makeTech({
			patterns: { headers: { 'X-Powered-By': parsePattern('Express') } },
		});
		const sig: Signal = { kind: 'header', name: 'server', value: 'Express' };
		expect(matchTechAgainstSignal(tech, sig)).toBeNull();
	});

	test('captures version from header value', () => {
		const tech = makeTech({
			patterns: {
				headers: {
					'X-Powered-By': parsePattern('Express/([0-9.]+)\\;version:\\1'),
				},
			},
		});
		const sig: Signal = { kind: 'header', name: 'x-powered-by', value: 'Express/4.18.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r?.version).toBe('4.18.0');
	});
});

describe('matchTechAgainstSignal — string-typed signals', () => {
	test('matches scriptSrc', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('jquery\\.min\\.js')] },
		});
		const sig: Signal = { kind: 'scriptSrc', value: 'https://cdn.example.com/jquery.min.js' };
		expect(matchTechAgainstSignal(tech, sig)?.evidence.signal).toBe('scriptSrc');
	});

	test('matches url', () => {
		const tech = makeTech({
			patterns: { url: [parsePattern('shopify\\.com')] },
		});
		expect(
			matchTechAgainstSignal(tech, { kind: 'url', value: 'https://my-store.shopify.com/' }),
		).not.toBeNull();
	});

	test('returns null when none of multiple patterns match', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('foo'), parsePattern('bar')] },
		});
		expect(
			matchTechAgainstSignal(tech, { kind: 'scriptSrc', value: 'https://baz.js' }),
		).toBeNull();
	});

	test('returns first matching pattern when multiple defined', () => {
		const tech = makeTech({
			patterns: {
				scriptSrc: [
					parsePattern('foo\\;confidence:30'),
					parsePattern('jquery\\;confidence:80'),
				],
			},
		});
		const r = matchTechAgainstSignal(tech, {
			kind: 'scriptSrc',
			value: 'https://cdn.example.com/jquery.min.js',
		});
		expect(r?.confidence).toBe(80);
	});
});

describe('matchTechAgainstSignal — js', () => {
	test('matches dotted-path js signal', () => {
		const tech = makeTech({
			patterns: { js: { 'jQuery.fn.jquery': parsePattern('([0-9.]+)\\;version:\\1') } },
		});
		const sig: Signal = { kind: 'js', name: 'jQuery.fn.jquery', value: '3.6.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r?.version).toBe('3.6.0');
	});
});

describe('matchTechAgainstSignal — cookie', () => {
	test('matches cookie name with empty value pattern', () => {
		const tech = makeTech({
			patterns: { cookies: { wordpress_test_cookie: parsePattern('') } },
		});
		const sig: Signal = { kind: 'cookie', name: 'wordpress_test_cookie', value: 'WP%20Cookie%20check' };
		expect(matchTechAgainstSignal(tech, sig)).not.toBeNull();
	});
});

describe('matchTechAgainstSignal — kind without patterns returns null', () => {
	test('tech with only headers does not match url signal', () => {
		const tech = makeTech({ patterns: { headers: { Server: parsePattern('nginx') } } });
		expect(matchTechAgainstSignal(tech, { kind: 'url', value: 'nginx.com' })).toBeNull();
	});
});
