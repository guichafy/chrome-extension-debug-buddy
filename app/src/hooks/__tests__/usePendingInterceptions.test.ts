import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { PendingInterception } from '@/lib/interceptionPipeline';
import { usePendingInterceptions } from '../usePendingInterceptions';

// O foco aqui são os 3 verbos novos da Phase 5:
//   - approveInterception          (libera pass-through; sem mods)
//   - approveInterceptionWithEdit  (libera com payload editado)
//   - cancelInterception           (Fetch.failRequest com 'Aborted')
//   - ignoreAllPending             (atalho em massa equivalente a aprovar todos)
// O contrato "no fallbacks" exige que erros do background sejam propagados
// para a UI — verificamos isso explicitamente em cada caminho.

const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

function makeStubBackground(initialPending: Record<string, PendingInterception>) {
	const state: { pending: Record<string, PendingInterception> } = {
		pending: { ...initialPending },
	};
	sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
		if (msg.action === 'getPendingInterceptions') {
			return { pendingInterceptions: { ...state.pending } };
		}
		return undefined;
	});
	return state;
}

function makePending(over: Partial<PendingInterception> = {}): PendingInterception {
	return {
		stage: 'response',
		requestId: over.requestId ?? 'r1',
		ruleId: '',
		url: 'https://api/x',
		method: 'GET',
		request: { headers: {} },
		response: { status: 200, statusPhrase: 'OK', headers: {} },
		...over,
	};
}

beforeEach(() => {
	sendMessage.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('usePendingInterceptions — approveInterception', () => {
	test('background success → resolve true e remove do estado local', async () => {
		const state = makeStubBackground({ r1: makePending({ requestId: 'r1' }) });
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingInterceptions') {
				return { pendingInterceptions: { ...state.pending } };
			}
			if (msg.action === 'approveInterception') {
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toContain('r1'));

		let resolved: boolean | undefined;
		await act(async () => {
			resolved = await result.current.approveInterception('r1');
		});

		expect(resolved).toBe(true);
		await waitFor(() => expect(result.current.pendingInterceptions).toEqual({}));
	});

	test('background success=false → resolve false (mantém entry local pra retry)', async () => {
		makeStubBackground({ r1: makePending({ requestId: 'r1' }) });
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingInterceptions') {
				return { pendingInterceptions: { r1: makePending({ requestId: 'r1' }) } };
			}
			if (msg.action === 'approveInterception') {
				return { success: false, error: 'Interception not found' };
			}
			return undefined;
		});
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let resolved: boolean | undefined;
		await act(async () => {
			resolved = await result.current.approveInterception('r1');
		});

		expect(resolved).toBe(false);
		expect(consoleErrorSpy).toHaveBeenCalled();
		consoleErrorSpy.mockRestore();
	});
});

describe('usePendingInterceptions — approveInterceptionWithEdit', () => {
	test('background success → resolve { success: true } e remove pending local', async () => {
		const state = makeStubBackground({ r1: makePending({ requestId: 'r1' }) });
		sendMessage.mockImplementation(
			async (msg: { action: string; requestId?: string; interceptionEdit?: unknown }) => {
				if (msg.action === 'getPendingInterceptions') {
					return { pendingInterceptions: { ...state.pending } };
				}
				if (msg.action === 'approveInterceptionWithEdit') {
					delete state.pending[msg.requestId!];
					return { success: true };
				}
				return undefined;
			},
		);

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toContain('r1'));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveInterceptionWithEdit('r1', {
				status: 201,
				headers: {},
				body: '{}',
			});
		});

		expect(resolved).toEqual({ success: true });
		await waitFor(() => expect(result.current.pendingInterceptions).toEqual({}));
	});

	test('background success=false → propaga error sem fingir sucesso', async () => {
		makeStubBackground({});
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingInterceptions') return { pendingInterceptions: {} };
			if (msg.action === 'approveInterceptionWithEdit') {
				return { success: false, error: 'status obrigatório em edição de Response stage' };
			}
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveInterceptionWithEdit('r1', {
				headers: {},
				body: '',
			});
		});

		expect(resolved?.success).toBe(false);
		expect(resolved?.error).toBe('status obrigatório em edição de Response stage');
	});

	test('sendMessage lança → propaga mensagem do erro', async () => {
		makeStubBackground({});
		sendMessage.mockImplementation(async (msg: { action: string }) => {
			if (msg.action === 'getPendingInterceptions') return { pendingInterceptions: {} };
			if (msg.action === 'approveInterceptionWithEdit') throw new Error('SW disconnected');
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(result.current.loading).toBe(false));

		let resolved: { success: boolean; error?: string } | undefined;
		await act(async () => {
			resolved = await result.current.approveInterceptionWithEdit('r1', {
				status: 200,
				headers: {},
				body: '',
			});
		});

		expect(resolved?.success).toBe(false);
		expect(resolved?.error).toBe('SW disconnected');
	});
});

describe('usePendingInterceptions — cancelInterception', () => {
	test('background success → resolve true e remove pending local', async () => {
		const state = makeStubBackground({ r1: makePending({ requestId: 'r1', stage: 'request' }) });
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingInterceptions') {
				return { pendingInterceptions: { ...state.pending } };
			}
			if (msg.action === 'cancelInterception') {
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toContain('r1'));

		let resolved: boolean | undefined;
		await act(async () => {
			resolved = await result.current.cancelInterception('r1');
		});

		expect(resolved).toBe(true);
		await waitFor(() => expect(result.current.pendingInterceptions).toEqual({}));
	});
});

describe('usePendingInterceptions — ignoreAllPending', () => {
	test('todas pendentes aprovadas com sucesso → succeeded=N, failed=[]', async () => {
		const state = makeStubBackground({
			r1: makePending({ requestId: 'r1', url: 'https://a/' }),
			r2: makePending({ requestId: 'r2', url: 'https://b/' }),
		});
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingInterceptions') {
				return { pendingInterceptions: { ...state.pending } };
			}
			if (msg.action === 'approveInterception') {
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toHaveLength(2));

		let outcome: { succeeded: number; failed: Array<{ requestId: string; error: string }> } = {
			succeeded: 0,
			failed: [],
		};
		await act(async () => {
			outcome = await result.current.ignoreAllPending();
		});

		expect(outcome.succeeded).toBe(2);
		expect(outcome.failed).toEqual([]);
		await waitFor(() => expect(result.current.pendingInterceptions).toEqual({}));
	});

	test('falha parcial é AGREGADA — sucessos contam, falhas vão em failed[]', async () => {
		const state = makeStubBackground({
			r1: makePending({ requestId: 'r1', url: 'https://a/' }),
			r2: makePending({ requestId: 'r2', url: 'https://b/' }),
			r3: makePending({ requestId: 'r3', url: 'https://c/' }),
		});
		sendMessage.mockImplementation(async (msg: { action: string; requestId?: string }) => {
			if (msg.action === 'getPendingInterceptions') {
				return { pendingInterceptions: { ...state.pending } };
			}
			if (msg.action === 'approveInterception') {
				if (msg.requestId === 'r2') {
					return { success: false, error: 'Tab fechada mid-loop' };
				}
				delete state.pending[msg.requestId!];
				return { success: true };
			}
			return undefined;
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toHaveLength(3));

		let outcome: { succeeded: number; failed: Array<{ requestId: string; error: string }> } = {
			succeeded: 0,
			failed: [],
		};
		await act(async () => {
			outcome = await result.current.ignoreAllPending();
		});

		expect(outcome.succeeded).toBe(2);
		expect(outcome.failed).toEqual([{ requestId: 'r2', error: 'Tab fechada mid-loop' }]);
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toEqual(['r2']));
	});
});

describe('usePendingInterceptions — broadcast', () => {
	test('newPendingInterception com interception preenchida adiciona à fila sem reload', async () => {
		makeStubBackground({});
		const listeners: Array<(msg: unknown) => void> = [];
		(
			chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>
		).mockImplementation((fn: (msg: unknown) => void) => {
			listeners.push(fn);
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(result.current.loading).toBe(false));

		const entry = makePending({ requestId: 'r-new', stage: 'request', url: 'https://broadcast/x' });
		act(() => {
			for (const l of listeners) {
				l({ action: 'newPendingInterception', requestId: 'r-new', interception: entry });
			}
		});

		await waitFor(() =>
			expect(result.current.pendingInterceptions['r-new']?.url).toBe('https://broadcast/x'),
		);
	});

	test('requestUpdated com isWaiting=false remove a entry local', async () => {
		makeStubBackground({ r1: makePending({ requestId: 'r1' }) });
		const listeners: Array<(msg: unknown) => void> = [];
		(
			chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>
		).mockImplementation((fn: (msg: unknown) => void) => {
			listeners.push(fn);
		});

		const { result } = renderHook(() => usePendingInterceptions());
		await waitFor(() => expect(Object.keys(result.current.pendingInterceptions)).toContain('r1'));

		act(() => {
			for (const l of listeners) {
				l({ action: 'requestUpdated', requestId: 'r1', updates: { isWaiting: false } });
			}
		});

		await waitFor(() => expect(result.current.pendingInterceptions).toEqual({}));
	});
});
