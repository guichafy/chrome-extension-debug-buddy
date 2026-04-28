import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useRequestSelection } from '../useRequestSelection';

const sample = {
	abc: {
		url: 'https://api.example.com/x',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1,
	},
	def: {
		url: 'https://api.example.com/y',
		method: 'POST',
		status: 500,
		statusText: 'Server Error',
		headers: {},
		type: 'XHR',
		timestamp: 2,
	},
} as const;

describe('useRequestSelection', () => {
	test('seleciona uma request por id', () => {
		const { result } = renderHook(() => useRequestSelection(sample));
		expect(result.current.selectedId).toBeNull();

		act(() => {
			result.current.select('abc');
		});

		expect(result.current.selectedId).toBe('abc');
		expect(result.current.selected).toMatchObject({ url: 'https://api.example.com/x' });
	});

	test('clearSelection volta ao estado inicial', () => {
		const { result } = renderHook(() => useRequestSelection(sample));
		act(() => result.current.select('def'));
		act(() => result.current.clear());
		expect(result.current.selectedId).toBeNull();
		expect(result.current.selected).toBeNull();
	});

	test('quando id selecionado some do conjunto, selected vira null', () => {
		const { result, rerender } = renderHook(({ data }) => useRequestSelection(data), {
			initialProps: { data: sample as Record<string, any> },
		});
		act(() => result.current.select('abc'));
		expect(result.current.selected).not.toBeNull();
		rerender({ data: { def: sample.def } });
		expect(result.current.selected).toBeNull();
	});
});
