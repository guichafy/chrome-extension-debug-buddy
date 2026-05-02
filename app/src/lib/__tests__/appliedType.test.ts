import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { getAppliedTypeBadgeMeta, getAppliedTypes } from '../appliedType';

function makeRequest(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api.example.com/users/42',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		mimeType: 'application/json',
		type: 'xhr',
		timestamp: 0,
		...overrides,
	};
}

describe('getAppliedTypes', () => {
	test('usa appliedTypes do background, deduplicado e ordenado por rank', () => {
		expect(getAppliedTypes(makeRequest({ appliedTypes: ['mock'] }))).toEqual(['mock']);
		// Ordem desejada: breakpoint > mock > transform > latency > proxy.
		expect(getAppliedTypes(makeRequest({ appliedTypes: ['latency', 'mock'] }))).toEqual([
			'mock',
			'latency',
		]);
		expect(
			getAppliedTypes(makeRequest({ appliedTypes: ['mock', 'mock', 'latency'] })),
		).toEqual(['mock', 'latency']);
	});

	test('proxy é mutuamente exclusivo: descartado quando vier junto com outros', () => {
		expect(getAppliedTypes(makeRequest({ appliedTypes: ['proxy', 'mock'] }))).toEqual(['mock']);
		expect(
			getAppliedTypes(makeRequest({ appliedTypes: ['proxy', 'breakpoint', 'transform'] })),
		).toEqual(['breakpoint', 'transform']);
	});

	test('appliedTypes ausente ou vazio → ["proxy"]', () => {
		expect(getAppliedTypes(makeRequest())).toEqual(['proxy']);
		expect(getAppliedTypes(makeRequest({ appliedTypes: [] }))).toEqual(['proxy']);
	});

	test('appliedTypes só com proxy permanece ["proxy"]', () => {
		expect(getAppliedTypes(makeRequest({ appliedTypes: ['proxy'] }))).toEqual(['proxy']);
	});

	test('ignora flags antigas (isMocked, isTransformed, mockLatencyMs) — sem derivação legada', () => {
		// Sem appliedTypes, não importa se isMocked está true: tratamos como proxy.
		expect(
			getAppliedTypes(makeRequest({ isMocked: true, mockLatencyMs: 500 })),
		).toEqual(['proxy']);
		expect(getAppliedTypes(makeRequest({ isTransformed: true }))).toEqual(['proxy']);
	});
});

describe('getAppliedTypeBadgeMeta', () => {
	test('todo AppliedType tem metadados consistentes (label, ícone, variant)', () => {
		for (const type of ['proxy', 'mock', 'transform', 'breakpoint', 'latency'] as const) {
			const meta = getAppliedTypeBadgeMeta(type);
			expect(meta.label.length).toBeGreaterThan(0);
			expect(meta.iconName.length).toBeGreaterThan(0);
			expect(['default', 'secondary', 'outline', 'destructive']).toContain(meta.variant);
		}
	});
});
