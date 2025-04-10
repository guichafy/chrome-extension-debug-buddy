import { useState, useEffect, useCallback } from 'react';

export function useDebugging() {
  const [isDebugging, setIsDebugging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetTab, setTargetTab] = useState<{ id: number | null, title: string, url: string }>({ id: null, title: '', url: '' });

  // Verificar o status de debugging
  const checkDebuggingStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDebuggingStatus' });
      setIsDebugging(response && response.isDebugging);
    } catch (error) {
      console.error('Erro ao verificar status de debugging:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Iniciar debugging
  const startDebugging = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'startDebugging' });
      if (response && response.success) {
        setIsDebugging(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Erro ao iniciar debugging:', error);
      return false;
    }
  }, []);

  // Parar debugging
  const stopDebugging = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopDebugging' });
      if (response && response.success) {
        setIsDebugging(false);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Erro ao parar debugging:', error);
      return false;
    }
  }, []);

  // Selecionar aba alvo
  const selectTargetTab = useCallback(async (): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'selectTargetTab' });
      return response && response.success;
    } catch (error) {
      console.error('Erro ao selecionar aba alvo:', error);
      return false;
    }
  }, []);

  // Carregar informações da aba alvo do armazenamento
  const loadTargetTabInfo = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['targetTabInfo']);
      if (result.targetTabInfo) {
        setTargetTab({
          id: result.targetTabInfo.id,
          title: result.targetTabInfo.title || '',
          url: result.targetTabInfo.url || ''
        });
        console.log('Informações da aba alvo carregadas:', result.targetTabInfo);
      }
    } catch (error) {
      console.error('Erro ao carregar informações da aba alvo:', error);
    }
  }, []);

  // Verificar status de debugging ao montar o componente
  useEffect(() => {
    // Carregar status e informações da aba alvo
    checkDebuggingStatus();
    loadTargetTabInfo();

    // Configurar intervalo para verificar o status periodicamente
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkDebuggingStatus();
      }
    }, 2000);

    // Listener para receber atualizações sobre a aba selecionada
    const messageListener = (message: any) => {
      if (message.action === 'targetTabSelected') {
        setTargetTab({
          id: message.tabId,
          title: message.tabTitle || '',
          url: message.tabUrl || ''
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      clearInterval(interval);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [checkDebuggingStatus, loadTargetTabInfo]);

  return {
    isDebugging,
    loading,
    targetTab,
    startDebugging,
    stopDebugging,
    selectTargetTab,
    checkDebuggingStatus
  };
}
