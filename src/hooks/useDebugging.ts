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

  // Verificar status de debugging ao montar o componente
  useEffect(() => {
    checkDebuggingStatus();

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
  }, [checkDebuggingStatus]);

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
