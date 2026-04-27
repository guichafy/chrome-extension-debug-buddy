import { useCallback, useEffect, useState } from 'react';
import { InterceptedResponse } from './useResponses';
import { indexedDBService } from '@/backend/services/indexedDB';

// Hook puramente reativo: o background é a fonte de verdade da persistência
// (`background.ts` grava no IndexedDB ao receber Fetch.requestPaused, mock,
// aprovação ou duration update). Aqui apenas:
//  1. Lemos o snapshot inicial do IndexedDB ao montar.
//  2. Escutamos `newRequest` / `requestUpdated` para atualizar o state em tempo
//     real enquanto a hook está montada — sem gravar no DB de novo.
// Assim, navegar entre rotas durante interceptação não perde dados (a hook
// pode estar desmontada quando o evento chega; o IndexedDB já registrou).

export function useAllRequests() {
	const [allRequests, setAllRequests] = useState<Record<string, InterceptedResponse>>({});
	const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
	const [currentRequest, setCurrentRequest] = useState<InterceptedResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState('');
	const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
	const [dbInitialized, setDbInitialized] = useState(false);

	useEffect(() => {
		indexedDBService
			.init()
			.then(() => setDbInitialized(true))
			.catch((err) => console.error('Erro ao inicializar IndexedDB:', err));
	}, []);

	const pauseAutoRefresh = useCallback(() => setAutoRefreshEnabled(false), []);
	const enableAutoRefresh = useCallback(() => setAutoRefreshEnabled(true), []);

	const reloadFromDB = useCallback(async () => {
		if (!dbInitialized) return;
		setLoading(true);
		try {
			const dbRequests = await indexedDBService.getAllRequests();
			setAllRequests(dbRequests);
		} catch (err) {
			console.error('Erro ao carregar requisições do IndexedDB:', err);
		} finally {
			setLoading(false);
		}
	}, [dbInitialized]);

	const getRequestDetails = useCallback(
		async (requestId: string) => {
			if (allRequests[requestId]) {
				setCurrentRequestId(requestId);
				setCurrentRequest(allRequests[requestId]);
				return allRequests[requestId];
			}
			if (!dbInitialized) return null;
			try {
				const request = await indexedDBService.getRequest(requestId);
				if (request) {
					setCurrentRequestId(requestId);
					setCurrentRequest(request);
					return request;
				}
				return null;
			} catch (err) {
				console.error('Erro ao obter requisição do IndexedDB:', err);
				return null;
			}
		},
		[allRequests, dbInitialized],
	);

	const clearCurrentRequest = useCallback(() => {
		setCurrentRequestId(null);
		setCurrentRequest(null);
	}, []);

	// Limpa em ambos os lados via background (que limpa allRequests + IndexedDB).
	const clearAllRequests = useCallback(async () => {
		try {
			await chrome.runtime.sendMessage({ action: 'clearAllRequests' });
			setAllRequests({});
			clearCurrentRequest();
			return true;
		} catch (err) {
			console.error('Erro ao limpar requisições:', err);
			return false;
		}
	}, [clearCurrentRequest]);

	const filteredRequests = (() => {
		if (!filter) return allRequests;
		const needle = filter.toLowerCase();
		const filtered: Record<string, InterceptedResponse> = {};
		for (const [id, request] of Object.entries(allRequests)) {
			if (request?.url?.toLowerCase().includes(needle)) filtered[id] = request;
		}
		return filtered;
	})();

	useEffect(() => {
		reloadFromDB();

		const messageListener = (message: any) => {
			if (message.action === 'newRequest' && message.requestId && message.request) {
				setAllRequests((prev) => ({ ...prev, [message.requestId]: message.request }));
			} else if (message.action === 'requestUpdated' && message.requestId && message.updates) {
				setAllRequests((prev) => {
					const existing = prev[message.requestId];
					if (!existing) return prev;
					return { ...prev, [message.requestId]: { ...existing, ...message.updates } };
				});
			}
		};
		chrome.runtime.onMessage.addListener(messageListener);

		// Resincroniza periodicamente do IndexedDB caso a hook tenha perdido eventos
		// (ex.: foi montada após uma rajada de interceptações).
		const interval = setInterval(() => {
			if (autoRefreshEnabled && document.visibilityState === 'visible') {
				reloadFromDB();
			}
		}, 10000);

		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
			clearInterval(interval);
		};
	}, [reloadFromDB, autoRefreshEnabled]);

	return {
		allRequests,
		filteredRequests,
		currentRequestId,
		currentRequest,
		loading,
		loadAllRequests: reloadFromDB,
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
