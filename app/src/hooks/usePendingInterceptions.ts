// Phase 5 (dual-stage interception): substitui `useResponses` por uma fila
// unificada de interceptações pendentes que funciona em ambos os stages
// (Request e Response). O estado é alimentado pelo background via duas rotas:
// - snapshot inicial (e polling) via mensagem `getPendingInterceptions`
// - eventos `newPendingInterception` (broadcast carrega a entry inteira para
//   evitar round-trip)
//
// API exposta:
// - `pendingInterceptions: Record<string, PendingInterception>` — espelho do
//   estado do background. Indexado por `requestId` (Map em insertion-order
//   é serializado como objeto para passar por `chrome.runtime.sendMessage`).
// - `approveInterception(id)` — aprova sem modificações (continueRequest).
// - `approveInterceptionWithEdit(id, payload)` — edita request (URL/method/
//   headers/postData) ou response (status/headers/body) e libera via CDP.
//   Retorna `{ success, error? }` para que a UI propague o erro (regra
//   "no fallbacks" do projeto).
// - `cancelInterception(id)` — falha a request com errorReason='Aborted'.
// - `ignoreAllPending()` — atalho em massa equivalente a aprovar todos sem
//   mods. Retorna agregado `{ succeeded, failed[] }` pra UI decidir como
//   notificar o usuário.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingInterception } from '@/lib/interceptionPipeline';

export type { PendingInterception };

// Forma do payload aceito pelo handler `approveInterceptionWithEdit` do
// background. Espelha o campo `interceptionEdit` em `types/messages.ts`.
export interface InterceptionEditPayload {
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	postData?: string;
	status?: number;
	body?: string;
}

export interface IgnoreAllResult {
	succeeded: number;
	failed: Array<{ requestId: string; error: string }>;
}

export function usePendingInterceptions() {
	const [pendingInterceptions, setPendingInterceptions] = useState<
		Record<string, PendingInterception>
	>({});
	const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Ref mirror para que o listener mountado uma vez consiga ler valor fresco
	// sem entrar nas deps do useEffect — evita re-attach por re-render.
	const currentRequestIdRef = useRef<string | null>(null);
	useEffect(() => {
		currentRequestIdRef.current = currentRequestId;
	}, [currentRequestId]);

	const loadPendingInterceptions = useCallback(async () => {
		setLoading(true);
		try {
			const response = await chrome.runtime.sendMessage({ action: 'getPendingInterceptions' });
			if (response && response.pendingInterceptions) {
				setPendingInterceptions(response.pendingInterceptions);
			}
		} catch (error) {
			console.error('Erro ao carregar interceptações pendentes:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	const removeLocal = useCallback((requestId: string) => {
		setPendingInterceptions((prev) => {
			if (!prev[requestId]) return prev;
			const next = { ...prev };
			delete next[requestId];
			return next;
		});
		if (currentRequestIdRef.current === requestId) {
			setCurrentRequestId(null);
		}
	}, []);

	const approveInterception = useCallback(
		async (requestId: string): Promise<boolean> => {
			try {
				const response = await chrome.runtime.sendMessage({
					action: 'approveInterception',
					requestId,
				});
				if (response?.success) {
					removeLocal(requestId);
					return true;
				}
				console.error(
					`Falha ao aprovar interceptação ${requestId}:`,
					response?.error ?? 'sem detalhe',
				);
				return false;
			} catch (error) {
				console.error('Erro ao aprovar interceptação:', error);
				return false;
			}
		},
		[removeLocal],
	);

	const approveInterceptionWithEdit = useCallback(
		async (
			requestId: string,
			payload: InterceptionEditPayload,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				const response = await chrome.runtime.sendMessage({
					action: 'approveInterceptionWithEdit',
					requestId,
					interceptionEdit: payload,
				});
				if (response?.success) {
					removeLocal(requestId);
					return { success: true };
				}
				return {
					success: false,
					error: response?.error ?? 'Erro desconhecido ao aplicar edição.',
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
		[removeLocal],
	);

	const cancelInterception = useCallback(
		async (requestId: string): Promise<boolean> => {
			try {
				const response = await chrome.runtime.sendMessage({
					action: 'cancelInterception',
					requestId,
				});
				if (response?.success) {
					removeLocal(requestId);
					return true;
				}
				console.error(
					`Falha ao cancelar interceptação ${requestId}:`,
					response?.error ?? 'sem detalhe',
				);
				return false;
			} catch (error) {
				console.error('Erro ao cancelar interceptação:', error);
				return false;
			}
		},
		[removeLocal],
	);

	const ignoreAllPending = useCallback(async (): Promise<IgnoreAllResult> => {
		const ids = Object.keys(pendingInterceptions);
		const failed: Array<{ requestId: string; error: string }> = [];
		let succeeded = 0;
		for (const id of ids) {
			try {
				const response = await chrome.runtime.sendMessage({
					action: 'approveInterception',
					requestId: id,
				});
				if (response?.success) {
					succeeded++;
					removeLocal(id);
				} else {
					failed.push({ requestId: id, error: response?.error ?? 'Erro desconhecido' });
				}
			} catch (error) {
				failed.push({
					requestId: id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return { succeeded, failed };
	}, [pendingInterceptions, removeLocal]);

	useEffect(() => {
		const listener = (message: {
			action?: string;
			requestId?: string;
			interception?: PendingInterception;
			updates?: Record<string, unknown>;
		}) => {
			if (message.action === 'newPendingInterception') {
				if (!message.requestId || !message.interception) return;
				const entry = message.interception;
				const id = message.requestId;
				setPendingInterceptions((prev) => ({ ...prev, [id]: entry }));
				return;
			}
			if (message.action === 'requestUpdated') {
				const updates = message.updates;
				const requestId = message.requestId;
				if (!requestId || !updates) return;
				if (updates.isWaiting === false) {
					removeLocal(requestId);
				}
			}
		};
		chrome.runtime.onMessage.addListener(listener);
		loadPendingInterceptions();

		// Resync periódico — defensivo contra perda de broadcast quando a UI
		// estava em segundo plano (Chrome desativa listeners de tabs hidden).
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				loadPendingInterceptions();
			}
		}, 2000);

		return () => {
			chrome.runtime.onMessage.removeListener(listener);
			clearInterval(interval);
		};
	}, [loadPendingInterceptions, removeLocal]);

	return {
		pendingInterceptions,
		currentRequestId,
		setCurrentRequestId,
		loading,
		loadPendingInterceptions,
		approveInterception,
		approveInterceptionWithEdit,
		cancelInterception,
		ignoreAllPending,
	};
}
