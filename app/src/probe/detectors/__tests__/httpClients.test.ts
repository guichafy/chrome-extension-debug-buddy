import { afterEach, describe, expect, it } from 'vitest';
import { detectHttpClients } from '../httpClients';

afterEach(() => {
	(window as unknown as { axios?: unknown }).axios = undefined;
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
});
