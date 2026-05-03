import { useCallback, useEffect, useMemo, useState } from 'react';
import { InterceptedResponse } from './useResponses';
import { indexedDBService } from '@/lib/indexedDB';
import type { Filter } from '@/types/filters';
import { buildFilterGroups, matchesFilterGroups } from '@/lib/filterMatching';

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
	const [filters, setFilters] = useState<Filter[]>([]);
	const [dbInitialized, setDbInitialized] = useState(false);

	useEffect(() => {
		indexedDBService
			.init()
			.then(() => setDbInitialized(true))
			.catch((err) => console.error('Erro ao inicializar IndexedDB:', err));
	}, []);

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

	const filteredRequests = useMemo(() => {
		if (filters.length === 0) return allRequests;
		const groups = buildFilterGroups(filters);
		const filtered: Record<string, InterceptedResponse> = {};
		for (const [id, request] of Object.entries(allRequests)) {
			if (request && matchesFilterGroups(request, groups)) filtered[id] = request;
		}
		return filtered;
	}, [allRequests, filters]);

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

		// Safety-net: re-fetch quando a tab volta a ser visible. Cobre o gap em que
		// service worker reciclou e perdeu broadcasts. Substitui o polling de 10s
		// (redundante com message listeners + custoso em IDB scan).
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				reloadFromDB();
			}
		};
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	}, [reloadFromDB]);

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
		filters,
		setFilters,
		dbInitialized,
	};
}
