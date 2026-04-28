import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useRules } from '../useRules';

describe('useRules — chrome.storage.onChanged subscription', () => {
	test('atualiza state quando rules muda em chrome.storage.local', async () => {
		const initialRules: any[] = [];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initialRules });

		const listeners: Array<(c: Record<string, chrome.storage.StorageChange>, ns: string) => void> =
			[];
		(chrome.storage.onChanged.addListener as any).mockImplementation((fn: any) => {
			listeners.push(fn);
		});

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.rules).toEqual([]);

		const newRules = [
			{
				id: 'rX',
				name: 'X',
				enabled: true,
				matchers: [{ type: 'url', enabled: true, pattern: 'a', isRegex: false }],
				action: { type: 'mock', enabled: true, status: 200, headers: {} },
				createdAt: 1,
				updatedAt: 1,
			},
		];

		act(() => {
			for (const fn of listeners) {
				fn({ rules: { newValue: newRules, oldValue: undefined } as any }, 'local');
			}
		});

		expect(result.current.rules).toEqual(newRules);
	});
});
