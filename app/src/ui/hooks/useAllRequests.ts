import { useState, useEffect, useCallback, useMemo } from 'react';
import { InterceptedResponse } from './useResponses';
import { indexedDBService } from '@/backend/services/indexedDB';

export function useAllRequests() {
	const [allRequests, setAllRequests] = useState<Record<string, InterceptedResponse>>({});
	const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
	const [currentRequest, setCurrentRequest] = useState<InterceptedResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState('');
	const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
	const [dbInitialized, setDbInitialized] = useState(false);

	// Inicializar o banco de dados
	useEffect(() => {
		const initDB = async () => {
			try {
				await indexedDBService.init();
				setDbInitialized(true);
				console.log('IndexedDB inicializado com sucesso');
			} catch (error) {
				console.error('Erro ao inicializar IndexedDB:', error);
			}
		};

		initDB();
	}, []);

	// Função para desativar o auto-refresh
	const pauseAutoRefresh = useCallback(() => {
		setAutoRefreshEnabled(false);
	}, []);

	// Função para reativar o auto-refresh
	const enableAutoRefresh = useCallback(() => {
		setAutoRefreshEnabled(true);
	}, []);

	// Carregar todas as requisições
	const loadAllRequests = useCallback(async () => {
		setLoading(true);
		try {
			// Primeiro, tenta carregar do IndexedDB
			if (dbInitialized) {
				const dbRequests = await indexedDBService.getAllRequests();
				if (Object.keys(dbRequests).length > 0) {
					// Verificar se há mudanças antes de atualizar o estado
					const hasChanges = hasDataChanged(allRequests, dbRequests);
					if (hasChanges) {
						setAllRequests(dbRequests);
					}
					setLoading(false);
					return;
				}
			}

			// Se não houver dados no IndexedDB ou ele não estiver inicializado,
			// carrega do background script
			const response = await chrome.runtime.sendMessage({ action: 'getAllRequests' });
			if (response && response.allRequests) {
				// Verificar se há mudanças antes de atualizar o estado
				const hasChanges = hasDataChanged(allRequests, response.allRequests);
				if (hasChanges) {
					setAllRequests(response.allRequests);

					// Salva as requisições no IndexedDB
					if (dbInitialized) {
						Object.entries(response.allRequests).forEach(([id, request]) => {
							indexedDBService.saveRequest(id, request as InterceptedResponse).catch((err) => {
								console.error('Erro ao salvar requisição no IndexedDB:', err);
							});
						});
					}
				}
			}
		} catch (error) {
			console.error('Erro ao carregar todas as requisições:', error);
		} finally {
			setLoading(false);
		}
	}, [dbInitialized, allRequests]);

	// Função auxiliar para verificar se os dados mudaram
	const hasDataChanged = (
		oldData: Record<string, InterceptedResponse>,
		newData: Record<string, InterceptedResponse>,
	): boolean => {
		// Verificar se o número de requisições mudou
		if (Object.keys(oldData).length !== Object.keys(newData).length) {
			return true;
		}

		// Verificar se alguma requisição foi adicionada ou removida
		for (const id in oldData) {
			if (!newData[id]) {
				return true;
			}
		}

		for (const id in newData) {
			if (!oldData[id]) {
				return true;
			}
		}

		// Se chegou até aqui, não houve mudanças significativas
		return false;
	};

	// Obter detalhes de uma requisição específica
	const getRequestDetails = useCallback(
		async (requestId: string) => {
			// Se a requisição já estiver no estado, não precisamos fazer uma nova chamada
			if (allRequests[requestId]) {
				setCurrentRequestId(requestId);
				setCurrentRequest(allRequests[requestId]);
				return allRequests[requestId];
			}

			// Tenta obter do IndexedDB primeiro
			if (dbInitialized) {
				try {
					const request = await indexedDBService.getRequest(requestId);
					if (request) {
						setCurrentRequestId(requestId);
						setCurrentRequest(request);
						return request;
					}
				} catch (error) {
					console.error('Erro ao obter requisição do IndexedDB:', error);
				}
			}

			// Caso contrário, carregamos todas as requisições novamente
			try {
				await loadAllRequests();
				if (allRequests[requestId]) {
					setCurrentRequestId(requestId);
					setCurrentRequest(allRequests[requestId]);
					return allRequests[requestId];
				}
				return null;
			} catch (error) {
				console.error('Erro ao obter detalhes da requisição:', error);
				return null;
			}
		},
		[allRequests, loadAllRequests, dbInitialized],
	);

	// Limpar a requisição atual
	const clearCurrentRequest = useCallback(() => {
		setCurrentRequestId(null);
		setCurrentRequest(null);
	}, []);

	// Limpar todas as requisições
	const clearAllRequests = useCallback(async () => {
		try {
			if (dbInitialized) {
				// Limpar do IndexedDB
				await indexedDBService.clearAllRequests();

				// Notificar o background script para limpar suas requisições também
				try {
					await chrome.runtime.sendMessage({ action: 'clearAllRequests' });
				} catch (bgError) {
					console.warn('Erro ao limpar requisições do background script:', bgError);
					// Continua mesmo se o background script falhar
				}

				// Limpar o estado local
				setAllRequests({});
				clearCurrentRequest();
				return true;
			}
			return false;
		} catch (error) {
			console.error('Erro ao limpar todas as requisições:', error);
			return false;
		}
	}, [dbInitialized, clearCurrentRequest]);

	// Filtrar requisições por URL
	const filteredRequests = useCallback(() => {
		// Verificar se allRequests é válido
		if (!allRequests || typeof allRequests !== 'object') {
			return {};
		}

		if (!filter) return allRequests;

		const filtered: Record<string, InterceptedResponse> = {};
		Object.entries(allRequests).forEach(([id, request]) => {
			if (request && request.url && request.url.toLowerCase().includes(filter.toLowerCase())) {
				filtered[id] = request;
			}
		});
		return filtered;
	}, [allRequests, filter]);

	// Configurar listener para novas requisições
	useEffect(() => {
		// Carregar requisições ao montar o componente
		loadAllRequests();

		// Armazenar o último timestamp para evitar atualizações muito frequentes
		let lastUpdateTime = Date.now();

		const upsertRequest = (
			requestId: string,
			compute: (existing: InterceptedResponse | undefined) => InterceptedResponse | null,
		) => {
			setAllRequests((prev) => {
				const next = compute(prev[requestId]);
				if (next === null || next === prev[requestId]) return prev;
				if (dbInitialized) {
					indexedDBService.saveRequest(requestId, next).catch((err) => {
						console.error('Erro ao salvar requisição no IndexedDB:', err);
					});
				}
				return { ...prev, [requestId]: next };
			});
		};

		const messageListener = (message: any) => {
			if (message.action === 'newRequest' && message.requestId && message.request) {
				upsertRequest(message.requestId, () => message.request);
			} else if (message.action === 'requestUpdated' && message.requestId && message.updates) {
				upsertRequest(message.requestId, (existing) => {
					if (!existing) return null;
					return { ...existing, ...message.updates };
				});
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		// Configurar intervalo para verificar requisições periodicamente
		const interval = setInterval(() => {
			// Só atualiza se o auto-refresh estiver habilitado, a página estiver visível
			// e se passaram pelo menos 10 segundos desde a última atualização
			const now = Date.now();
			if (
				autoRefreshEnabled &&
				document.visibilityState === 'visible' &&
				now - lastUpdateTime >= 10000
			) {
				lastUpdateTime = now;
				loadAllRequests();
			}
		}, 10000); // Aumentar o intervalo para 10 segundos

		return () => {
			clearInterval(interval);
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, [loadAllRequests, autoRefreshEnabled, dbInitialized]);

	// Simplificado para evitar problemas de roteamento
	const filteredRequestsResult = filteredRequests();

	return {
		allRequests,
		filteredRequests: filteredRequestsResult,
		currentRequestId,
		currentRequest,
		loading,
		loadAllRequests,
		getRequestDetails,
		clearCurrentRequest,
		clearAllRequests,
		filter,
		setFilter,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		dbInitialized,
	};
}
