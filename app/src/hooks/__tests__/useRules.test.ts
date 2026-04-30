import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import { useRules } from '../useRules';

function makeRule(id: string): Rule {
	return {
		id,
		name: id,
		enabled: true,
		matchers: [{ type: 'url', enabled: true, pattern: id, isRegex: false }],
		action: { type: 'mock', enabled: true, status: 200, headers: {} },
		createdAt: 0,
		updatedAt: 0,
	};
}

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

describe('useRules — reorderRules', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('move uma regra para antes do alvo, ajustando índice quando origem está antes', async () => {
		const initial = [makeRule('a'), makeRule('b'), makeRule('c')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		const setMock = chrome.storage.local.set as any;
		setMock.mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			const ok = await result.current.reorderRules('a', 'c', 'before');
			expect(ok).toBe(true);
		});

		expect(setMock).toHaveBeenCalledWith({
			rules: expect.arrayContaining([
				expect.objectContaining({ id: 'b' }),
				expect.objectContaining({ id: 'a' }),
				expect.objectContaining({ id: 'c' }),
			]),
		});
		expect(result.current.rules.map((r) => r.id)).toEqual(['b', 'a', 'c']);
	});

	test('move uma regra para depois do alvo', async () => {
		const initial = [makeRule('a'), makeRule('b'), makeRule('c')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		(chrome.storage.local.set as any).mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.reorderRules('a', 'b', 'after');
		});

		expect(result.current.rules.map((r) => r.id)).toEqual(['b', 'a', 'c']);
	});

	test('move regra do final para o início (before)', async () => {
		const initial = [makeRule('a'), makeRule('b'), makeRule('c')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		(chrome.storage.local.set as any).mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.reorderRules('c', 'a', 'before');
		});

		expect(result.current.rules.map((r) => r.id)).toEqual(['c', 'a', 'b']);
	});

	test('reordenar para a mesma posição retorna false sem persistir', async () => {
		const initial = [makeRule('a'), makeRule('b')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		const setMock = chrome.storage.local.set as any;
		setMock.mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			const ok = await result.current.reorderRules('a', 'a', 'before');
			expect(ok).toBe(false);
		});
		expect(setMock).not.toHaveBeenCalled();
	});
});

describe('useRules — moveRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('move regra uma posição para cima', async () => {
		const initial = [makeRule('a'), makeRule('b'), makeRule('c')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		(chrome.storage.local.set as any).mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			const ok = await result.current.moveRule('c', 'up');
			expect(ok).toBe(true);
		});

		expect(result.current.rules.map((r) => r.id)).toEqual(['a', 'c', 'b']);
	});

	test('move regra uma posição para baixo', async () => {
		const initial = [makeRule('a'), makeRule('b'), makeRule('c')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		(chrome.storage.local.set as any).mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.moveRule('a', 'down');
		});

		expect(result.current.rules.map((r) => r.id)).toEqual(['b', 'a', 'c']);
	});

	test('mover primeira regra para cima retorna false', async () => {
		const initial = [makeRule('a'), makeRule('b')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		const setMock = chrome.storage.local.set as any;
		setMock.mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			const ok = await result.current.moveRule('a', 'up');
			expect(ok).toBe(false);
		});
		expect(setMock).not.toHaveBeenCalled();
	});

	test('mover última regra para baixo retorna false', async () => {
		const initial = [makeRule('a'), makeRule('b')];
		(chrome.storage.local.get as any).mockResolvedValue({ rules: initial });
		const setMock = chrome.storage.local.set as any;
		setMock.mockResolvedValue(undefined);

		const { result } = renderHook(() => useRules());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			const ok = await result.current.moveRule('b', 'down');
			expect(ok).toBe(false);
		});
		expect(setMock).not.toHaveBeenCalled();
	});
});
