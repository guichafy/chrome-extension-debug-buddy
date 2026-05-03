import { afterEach, beforeEach, describe, expect, it, test } from 'vitest';
import { detectDataFetching } from '../dataFetching';

afterEach(() => {
	(window as unknown as { __APOLLO_CLIENT__?: unknown }).__APOLLO_CLIENT__ = undefined;
	(window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown }).__TANSTACK_QUERY_CLIENT__ =
		undefined;
});

describe('detectDataFetching', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		(window as unknown as { __APOLLO_CLIENT__?: unknown }).__APOLLO_CLIENT__ = undefined;
		(window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown }).__TANSTACK_QUERY_CLIENT__ =
			undefined;
		(window as unknown as { ng?: unknown }).ng = undefined;
	});

	it('detecta Apollo via __APOLLO_CLIENT__ com version', () => {
		(window as unknown as { __APOLLO_CLIENT__: unknown }).__APOLLO_CLIENT__ = {
			version: '3.9.0',
		};
		expect(detectDataFetching()).toContainEqual({
			name: 'apollo',
			version: '3.9.0',
			treatment: 'detection-only',
		});
	});

	it('detecta Apollo sem version', () => {
		(window as unknown as { __APOLLO_CLIENT__: unknown }).__APOLLO_CLIENT__ = {};
		expect(detectDataFetching()).toContainEqual({
			name: 'apollo',
			treatment: 'detection-only',
		});
	});

	it('detecta TanStack Query via __TANSTACK_QUERY_CLIENT__', () => {
		(window as unknown as { __TANSTACK_QUERY_CLIENT__: unknown }).__TANSTACK_QUERY_CLIENT__ = {};
		expect(detectDataFetching()).toContainEqual({
			name: 'tanstack-query',
			treatment: 'detection-only',
		});
	});

	it('retorna vazio quando nada é detectado', () => {
		expect(detectDataFetching()).toEqual([]);
	});

	test('não emite angular-http mesmo com <app-root> presente (angular-http é HTTP client, não data fetching)', () => {
		document.body.innerHTML = '<app-root></app-root>';
		const result = detectDataFetching();
		expect(result.find((d) => d.name === 'angular-http')).toBeUndefined();
	});
});
