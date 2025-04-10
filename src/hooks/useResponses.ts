import { useState, useEffect, useCallback } from 'react';

export interface InterceptedResponse {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  type: string;
  timestamp: number;
  body: string;
  isWaiting?: boolean;
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
        requestId
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
  const approveResponse = useCallback(async (
    requestId: string,
    modifications: ResponseModifications
  ): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'approveResponse',
        requestId,
        modifications
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
        
        return true;
      } else {
        alert('Falha ao aprovar resposta: ' + (response ? response.error : 'Erro desconhecido'));
        return false;
      }
    } catch (error) {
      console.error('Erro ao aprovar resposta:', error);
      return false;
    }
  }, [pendingResponses, currentResponseId]);

  // Ignorar uma resposta
  const ignoreResponse = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'ignoreResponse',
        requestId
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
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Erro ao ignorar resposta:', error);
      return false;
    }
  }, [pendingResponses, currentResponseId]);

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
        setPendingResponses(prev => ({
          ...prev,
          [message.requestId]: {
            url: message.url,
            status: message.status,
            statusText: message.statusText,
            type: message.type,
            mimeType: message.mimeType,
            body: "",
            headers: {},
            timestamp: Date.now()
          }
        }));
      } else if (message.action === 'responseBodyReady') {
        // Atualizar o corpo da resposta
        if (pendingResponses[message.requestId]) {
          setPendingResponses(prev => ({
            ...prev,
            [message.requestId]: {
              ...prev[message.requestId],
              body: message.body
            }
          }));
          
          // Atualizar resposta atual se for a mesma
          if (currentResponseId === message.requestId && currentResponse) {
            setCurrentResponse({
              ...currentResponse,
              body: message.body
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
    clearCurrentResponse
  };
}
