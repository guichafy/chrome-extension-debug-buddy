import { useState, useEffect, useCallback } from 'react';
import type { InterceptedResponse, ResponseModifications } from '@/types/intercepted';

export type { InterceptedResponse, ResponseModifications };

export function useResponses() {
	const [pendingResponses, setPendingResponses] = useState<Record<string, InterceptedResponse>>({});
	const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
	const [currentResponse, setCurrentResponse] = useState<InterceptedResponse | null>(null);
	const [loading, setLoading] = useState(true);

	// Carregar respostas pendentes
	const loadPendingResponses = useCallback(async () => {
		setLoading(true);
		try {
			const response = await chrome.runtime.sendMessage({ action: 'getPendingResponses' });
			if (response && response.pendingResponses) {
				setPendingResponses(response.pendingResponses);
			}
		} catch (error) {
			console.error('Erro ao carregar respostas pendentes:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Obter detalhes de uma resposta específica
	const getResponseDetails = useCallback(async (requestId: string) => {
		try {
			const result = await chrome.runtime.sendMessage({
				action: 'getResponseDetails',
				requestId,
			});

			if (result && result.success) {
				setCurrentResponseId(requestId);
				setCurrentResponse(result.response);
				return result.response;
			} else {
				alert('Falha ao obter detalhes da resposta');
				return null;
			}
		} catch (error) {
			console.error('Erro ao obter detalhes da resposta:', error);
			return null;
		}
	}, []);

	// Aprovar uma resposta com modificações
	const approveResponse = useCallback(
		async (requestId: string, modifications: ResponseModifications): Promise<boolean> => {
			try {
				// Log para depuração
				console.log('useResponses - Sending modifications:', JSON.stringify(modifications));
				if (modifications.status) {
					console.log(
						`useResponses - Status code: ${modifications.status}, type: ${typeof modifications.status}`,
					);
				}

				const response = await chrome.runtime.sendMessage({
					action: 'approveResponse',
					requestId,
					modifications,
				});

				if (response && response.success) {
					// Background já persistiu a versão final no IndexedDB e fez broadcast
					// `requestUpdated` com isWaiting=false. Aqui só limpamos o pending local.
					const newPendingResponses = { ...pendingResponses };
					delete newPendingResponses[requestId];
					setPendingResponses(newPendingResponses);

					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}
					return true;
				} else {
					alert('Falha ao aprovar resposta: ' + (response ? response.error : 'Erro desconhecido'));
					return false;
				}
			} catch (error) {
				console.error('Erro ao aprovar resposta:', error);
				return false;
			}
		},
		[pendingResponses, currentResponseId],
	);

	// Edição one-shot: envia status/headers/body editados via approveResponseWithEdit.
	// Devolve `{ success, error }` para que a UI (EditResponseSheet) renderize o
	// erro como toast — regra "no fallbacks" exige propagação explícita.
	const approveResponseWithEdit = useCallback(
		async (
			requestId: string,
			payload: { status: number; headers: Record<string, string>; body: string },
		): Promise<{ success: boolean; error?: string }> => {
			try {
				const response = await chrome.runtime.sendMessage({
					action: 'approveResponseWithEdit',
					requestId,
					...payload,
				});

				if (response && response.success) {
					// Background já fez patchRequest com isWaiting=false; o broadcast
					// requestUpdated chega depois, mas removemos localmente já para
					// reagir imediatamente no inspetor que disparou a edição.
					setPendingResponses((prev) => {
						if (!prev[requestId]) return prev;
						const next = { ...prev };
						delete next[requestId];
						return next;
					});
					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}
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
		[currentResponseId],
	);

	// Ignorar uma resposta (continua sem modificações)
	const ignoreResponse = useCallback(
		async (requestId: string): Promise<boolean> => {
			try {
				console.log(`Ignorando resposta: ${requestId}`);

				const response = await chrome.runtime.sendMessage({
					action: 'approveResponse',
					requestId,
					// Sem modifications: background continua a request original.
				});

				if (response && response.success) {
					const newPendingResponses = { ...pendingResponses };
					delete newPendingResponses[requestId];
					setPendingResponses(newPendingResponses);

					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}
					return true;
				} else {
					alert('Falha ao ignorar resposta: ' + (response ? response.error : 'Erro desconhecido'));
					return false;
				}
			} catch (error) {
				console.error('Erro ao ignorar resposta:', error);
				return false;
			}
		},
		[pendingResponses, currentResponseId],
	);

	// Ignora em massa todas as respostas pausadas atualmente.
	// Estratégia: iteramos um snapshot dos IDs e reaproveitamos `ignoreResponse`
	// para cada um — assim o tratamento de erro existente (console.error + alert
	// quando o background rejeita) continua valendo por request, e nenhum
	// fallback "fingindo sucesso" é introduzido aqui. Optamos por não criar uma
	// action `ignoreAllPending` no background porque a iteração no front mantém
	// o protocolo simples (uma única action `approveResponse` sem modificações)
	// e a UI ainda reage em tempo real via os eventos `requestUpdated` que o
	// background já emite após cada `Fetch.continueRequest`.
	const ignoreAllPending = useCallback(async (): Promise<void> => {
		const ids = Object.keys(pendingResponses);
		for (const id of ids) {
			// Sequencial para preservar a ordem original das respostas no background.
			await ignoreResponse(id);
		}
	}, [pendingResponses, ignoreResponse]);

	// Limpar a resposta atual
	const clearCurrentResponse = useCallback(() => {
		setCurrentResponseId(null);
		setCurrentResponse(null);
	}, []);

	// Configurar listener para novas respostas
	useEffect(() => {
		const messageListener = (message: any) => {
			if (message.action === 'newPendingResponse') {
				if (!message.requestId || !message.response) return;
				setPendingResponses((prev) => ({
					...prev,
					[message.requestId]: message.response,
				}));
			} else if (message.action === 'responseBodyReady') {
				// Atualizar o corpo da resposta
				if (pendingResponses[message.requestId]) {
					setPendingResponses((prev) => ({
						...prev,
						[message.requestId]: {
							...prev[message.requestId],
							body: message.body,
						},
					}));

					// Atualizar resposta atual se for a mesma
					if (currentResponseId === message.requestId && currentResponse) {
						setCurrentResponse({
							...currentResponse,
							body: message.body,
						});
					}
				}
			} else if (message.action === 'requestUpdated') {
				// Quando o background sinaliza que uma request saiu do estado pausado
				// (isWaiting=false após aprovação/ignore por outro caminho), removemos
				// localmente para que a tabela de pausadas reaja em tempo real.
				const updates = message.updates;
				const requestId = message.requestId;
				if (!requestId || !updates) return;
				if (updates.isWaiting === false) {
					setPendingResponses((prev) => {
						if (!prev[requestId]) return prev;
						const next = { ...prev };
						delete next[requestId];
						return next;
					});
					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}
				}
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		// Carregar respostas pendentes ao montar o componente
		loadPendingResponses();

		// Configurar intervalo para verificar respostas pendentes periodicamente
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				loadPendingResponses();
			}
		}, 2000);

		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
			clearInterval(interval);
		};
	}, [loadPendingResponses, pendingResponses, currentResponseId, currentResponse]);

	return {
		pendingResponses,
		currentResponseId,
		currentResponse,
		loading,
		loadPendingResponses,
		getResponseDetails,
		approveResponse,
		approveResponseWithEdit,
		ignoreResponse,
		ignoreAllPending,
		clearCurrentResponse,
	};
}
