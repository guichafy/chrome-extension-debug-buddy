import { useState, useEffect, useCallback } from 'react';
import type { InterceptedResponse, ResponseModifications } from '@/backend/types/intercepted';

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
		ignoreResponse,
		clearCurrentResponse,
	};
}
