import { useState, useEffect, useCallback } from 'react';
import { InterceptedResponse } from './useResponses';

export function useAllRequests() {
  const [allRequests, setAllRequests] = useState<Record<string, InterceptedResponse>>({});
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<InterceptedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Função para desativar temporariamente o auto-refresh
  const pauseAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(false);
    // Reativar após 30 segundos
    setTimeout(() => setAutoRefreshEnabled(true), 30000);
  }, []);

  // Carregar todas as requisições
  const loadAllRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllRequests' });
      if (response && response.allRequests) {
        setAllRequests(response.allRequests);
      }
    } catch (error) {
      console.error('Erro ao carregar todas as requisições:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Obter detalhes de uma requisição específica
  const getRequestDetails = useCallback(async (requestId: string) => {
    // Se a requisição já estiver no estado, não precisamos fazer uma nova chamada
    if (allRequests[requestId]) {
      setCurrentRequestId(requestId);
      setCurrentRequest(allRequests[requestId]);
      return allRequests[requestId];
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
  }, [allRequests, loadAllRequests]);

  // Limpar a requisição atual
  const clearCurrentRequest = useCallback(() => {
    setCurrentRequestId(null);
    setCurrentRequest(null);
  }, []);

  // Filtrar requisições por URL
  const filteredRequests = useCallback(() => {
    if (!filter) return allRequests;

    const filtered: Record<string, InterceptedResponse> = {};
    Object.entries(allRequests).forEach(([id, request]) => {
      if (request.url.toLowerCase().includes(filter.toLowerCase())) {
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

    // Configurar intervalo para verificar requisições periodicamente
    const interval = setInterval(() => {
      // Só atualiza se o auto-refresh estiver habilitado, a página estiver visível
      // e se passaram pelo menos 10 segundos desde a última atualização
      const now = Date.now();
      if (autoRefreshEnabled && document.visibilityState === 'visible' && now - lastUpdateTime >= 10000) {
        lastUpdateTime = now;
        loadAllRequests();
      }
    }, 10000); // Aumentar o intervalo para 10 segundos

    return () => {
      clearInterval(interval);
    };
  }, [loadAllRequests, autoRefreshEnabled]);

  return {
    allRequests,
    filteredRequests: filteredRequests(),
    currentRequestId,
    currentRequest,
    loading,
    loadAllRequests,
    getRequestDetails,
    clearCurrentRequest,
    filter,
    setFilter,
    pauseAutoRefresh,
    autoRefreshEnabled
  };
}
