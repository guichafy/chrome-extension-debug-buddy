import { afterEach, describe, expect, it } from 'vitest';
import { detectHttpClients } from '../httpClients';

afterEach(() => {
	(window as unknown as { axios?: unknown }).axios = undefined;
	(window as unknown as { ng?: unknown }).ng = undefined;
	document.body.innerHTML = '';
});

describe('detectHttpClients', () => {
	it('sempre detecta fetch e XHR com confidence high', () => {
		const got = detectHttpClients();
		expect(got).toContainEqual({ name: 'fetch', confidence: 'high' });
		expect(got).toContainEqual({ name: 'xhr', confidence: 'high' });
	});

	it('detecta Axios via window.axios', () => {
		(window as unknown as { axios: unknown }).axios = { create: () => null };
		const got = detectHttpClients();
		expect(got).toContainEqual({ name: 'axios', confidence: 'high' });
	});

	it('sem Axios, não inclui axios', () => {
		const got = detectHttpClients();
		expect(got.find((c) => c.name === 'axios')).toBeUndefined();
	});

	it('detecta angular-http com confidence high quando window.ng existe', () => {
		(window as unknown as { ng?: unknown }).ng = { getComponent: () => null };
		const out = detectHttpClients();
		const angular = out.find((c) => c.name === 'angular-http');
		expect(angular).toBeDefined();
		expect(angular?.confidence).toBe('high');
		(window as unknown as { ng?: unknown }).ng = undefined;
	});

	it('detecta angular-http com confidence medium quando só app-root existe', () => {
		document.body.innerHTML = '<app-root></app-root>';
		const out = detectHttpClients();
		const angular = out.find((c) => c.name === 'angular-http');
		expect(angular?.confidence).toBe('medium');
		document.body.innerHTML = '';
	});
});
