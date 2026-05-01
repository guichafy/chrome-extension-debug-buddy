import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { useResponses } from '../useResponses';

// Apenas as ações `approveResponseWithEdit` e `ignoreAllPending` são exercidas
// aqui — `approveResponse`/`ignoreResponse` já têm cobertura indireta via
// CommandCenter.test.tsx. O foco é garantir que erros do background são
// propagados (regra "no fallbacks") e que `ignoreAllPending` agrega corretamente
// resultados parciais.

const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

// `useResponses` tem um useEffect que dispara `loadPendingResponses` toda vez
// que `pendingResponses` muda (deps amplas no efeito real). Por isso o mock de
// `getPendingResponses` precisa refletir o estado *corrente* — caso contrário
// cada `approveResponse` que remove um id é instantaneamente "restaurado" pelo
// reload. Usamos um spy stateful por test.
function makeStubBackground(initialPending: Record<string, InterceptedResponse>) {
	const state: { pending: Record<string, InterceptedResponse> } = {
		pending: { ...initialPending },
	};
	sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
		if (msg.action === 'getPendingResponses') {
			return { pendingResponses: { ...state.pending } };
		}
		return undefined;
	});
	return state;
}

function makePending(over: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api/x',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1,
		isWaiting: true,
		...over,
	};
}

beforeEach(() => {
	sendMessage.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useResponses — approveResponseWithEdit', () => {
	test('background success → resolve com { success: true } e remove pending local', async () => {
		const state = makeStubBackground({ r1: makePending() });
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: { ...state.pending } };
			if (msg.action === 'approveResponseWithEdit') {
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(Object.keys(result.current.pendingResponses)).toContain('r1'));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveResponseWithEdit('r1', {
				status: 201,
				headers: {},
				body: '{}',
			});
		});

		expect(resolved).toEqual({ success: true });
		await waitFor(() => expect(result.current.pendingResponses).toEqual({}));
	});

	test('background success=false → propaga error sem fallback de sucesso', async () => {
		makeStubBackground({});
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: {} };
			if (msg.action === 'approveResponseWithEdit') {
				return { success: false, error: 'Status code obrigatório para edição one-shot' };
			}
			return undefined;
		});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveResponseWithEdit('r1', {
				status: 0,
				headers: {},
				body: '',
			});
		});

		expect(resolved?.success).toBe(false);
		expect(resolved?.error).toBe('Status code obrigatório para edição one-shot');
	});

	test('sendMessage lança → propaga mensagem do erro', async () => {
		makeStubBackground({});
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: {} };
			if (msg.action === 'approveResponseWithEdit') throw new Error('SW disconnected');
			return undefined;
		});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveResponseWithEdit('r1', {
				status: 200,
				headers: {},
				body: '',
			});
		});

		expect(resolved?.success).toBe(false);
		expect(resolved?.error).toBe('SW disconnected');
	});
});

describe('useResponses — ignoreAllPending', () => {
	test('todas pendentes ignoradas com sucesso → succeeded=N, failed=[]', async () => {
		const state = makeStubBackground({
			r1: makePending({ url: 'https://a/', timestamp: 1 }),
			r2: makePending({ url: 'https://b/', timestamp: 2 }),
		});
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: { ...state.pending } };
			if (msg.action === 'approveResponse') {
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(Object.keys(result.current.pendingResponses)).toHaveLength(2));

		let outcome: { succeeded: number; failed: Array<{ requestId: string; error: string }> } = {
			succeeded: 0,
			failed: [],
		};
		await act(async () => {
			outcome = await result.current.ignoreAllPending();
		});

		expect(outcome.succeeded).toBe(2);
		expect(outcome.failed).toEqual([]);
		await waitFor(() => expect(result.current.pendingResponses).toEqual({}));
	});

	test('falha parcial é AGREGADA — sucessos contam, falhas vão em failed[]', async () => {
		const state = makeStubBackground({
			r1: makePending({ url: 'https://a/', timestamp: 1 }),
			r2: makePending({ url: 'https://b/', timestamp: 2 }),
			r3: makePending({ url: 'https://c/', timestamp: 3 }),
		});
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: { ...state.pending } };
			if (msg.action === 'approveResponse') {
				if (msg.requestId === 'r2') {
					return { success: false, error: 'Tab fechada mid-loop' };
				}
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(Object.keys(result.current.pendingResponses)).toHaveLength(3));

		let outcome: { succeeded: number; failed: Array<{ requestId: string; error: string }> } = {
			succeeded: 0,
			failed: [],
		};
		await act(async () => {
			outcome = await result.current.ignoreAllPending();
		});

		expect(outcome.succeeded).toBe(2);
		expect(outcome.failed).toEqual([{ requestId: 'r2', error: 'Tab fechada mid-loop' }]);
		// As que tiveram sucesso saem do snapshot local; r2 fica.
		await waitFor(() => expect(Object.keys(result.current.pendingResponses)).toEqual(['r2']));
	});

	test('exceção do sendMessage também vira entry em failed[]', async () => {
		const state = makeStubBackground({
			r1: makePending({ url: 'https://a/', timestamp: 1 }),
		});
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingResponses') return { pendingResponses: { ...state.pending } };
			if (msg.action === 'approveResponse') throw new Error('SW reciclado');
			return undefined;
		});

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { result } = renderHook(() => useResponses());
		await waitFor(() => expect(Object.keys(result.current.pendingResponses)).toHaveLength(1));

		let outcome: { succeeded: number; failed: Array<{ requestId: string; error: string }> } = {
			succeeded: 0,
			failed: [],
		};
		await act(async () => {
			outcome = await result.current.ignoreAllPending();
		});

		expect(outcome.succeeded).toBe(0);
		expect(outcome.failed).toEqual([{ requestId: 'r1', error: 'SW reciclado' }]);
		consoleErrorSpy.mockRestore();
	});
});
