import { useState, useEffect, useCallback } from 'react';

export interface InterceptedResponse {
	url: string;
	method?: string;
	/** Dados enviados no corpo da requisição original */
	request?: {
		postData?: string;
	};
	status: number;
	statusText: string;
	headers: Record<string, string>;
	mimeType: string;
	type: string;
	timestamp: number;
	body: string;
	isWaiting?: boolean;
	isMocked?: boolean;
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}

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
					// Obter a resposta atual antes de removê-la
					const currentPendingResponse = pendingResponses[requestId];

					// Remover da lista de respostas pendentes
					const newPendingResponses = { ...pendingResponses };
					delete newPendingResponses[requestId];
					setPendingResponses(newPendingResponses);

					// Limpar resposta atual
					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}

					// Adicionar ao histórico geral de requisições
					if (currentPendingResponse) {
						// Criar uma cópia da resposta com isWaiting=false para indicar que foi processada
						const processedResponse: InterceptedResponse = {
							...currentPendingResponse,
							isWaiting: false, // Indica que não está mais aguardando
							// Aplicar modificações, se houver
							status: modifications.status || currentPendingResponse.status,
							headers: modifications.headers || currentPendingResponse.headers,
							body: modifications.body || currentPendingResponse.body,
						};

						// Notificar o background script para adicionar ao histórico
						chrome.runtime.sendMessage({
							action: 'addToRequestHistory',
							requestId,
							request: processedResponse,
						});
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

				// Obter a resposta atual antes de qualquer operação
				const currentPendingResponse = pendingResponses[requestId];

				// Enviar para o background script sem modificações
				const response = await chrome.runtime.sendMessage({
					action: 'approveResponse',
					requestId,
					// Não enviamos modificações para continuar a requisição original
				});

				if (response && response.success) {
					// Remover da lista de respostas pendentes
					const newPendingResponses = { ...pendingResponses };
					delete newPendingResponses[requestId];
					setPendingResponses(newPendingResponses);

					// Limpar resposta atual
					if (currentResponseId === requestId) {
						setCurrentResponseId(null);
						setCurrentResponse(null);
					}

					// Adicionar ao histórico geral de requisições
					if (currentPendingResponse) {
						// Criar uma cópia da resposta com isWaiting=false
						const processedResponse: InterceptedResponse = {
							...currentPendingResponse,
							isWaiting: false, // Indica que não está mais aguardando
						};

						// Notificar o background script para adicionar ao histórico
						chrome.runtime.sendMessage({
							action: 'addToRequestHistory',
							requestId,
							request: processedResponse,
						});
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
				// Adicionar à lista de respostas pendentes
				setPendingResponses((prev) => ({
					...prev,
					[message.requestId]: {
						url: message.url,
						method: message.method || 'GET',
						status: message.status,
						statusText: message.statusText,
						type: message.type,
						mimeType: message.mimeType,
						body: '',
						headers: {},
						timestamp: Date.now(),
						isWaiting: true,
					},
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
