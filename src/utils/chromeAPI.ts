/**
 * Chrome API Wrapper
 * 
 * Este módulo fornece uma camada de abstração para as APIs do Chrome,
 * permitindo que o código funcione tanto no ambiente de desenvolvimento
 * quanto na extensão Chrome.
 */

// Verificar se estamos em um ambiente de desenvolvimento (servidor local)
const isDevelopment = typeof chrome === 'undefined' || !chrome.runtime;

// Mock para o objeto chrome.runtime
const mockRuntime = {
  // Mock para onMessage
  onMessage: {
    addListener: (callback: (message: any, sender: any, sendResponse: any) => void) => {
      console.log('Mock: Adicionado listener para mensagens');
      // No ambiente de desenvolvimento, não fazemos nada com o listener
      return () => {};
    },
    removeListener: (callback: (message: any, sender: any, sendResponse: any) => void) => {
      console.log('Mock: Removido listener para mensagens');
      // No ambiente de desenvolvimento, não fazemos nada
    }
  },
  
  // Mock para sendMessage
  sendMessage: async (message: any) => {
    console.log('Mock: Enviando mensagem', message);
    
    // Simular respostas para diferentes tipos de mensagens
    if (message.action === 'getDebuggingStatus') {
      return { isDebugging: false };
    }
    
    if (message.action === 'getPendingResponses') {
      return { responses: {} };
    }
    
    if (message.action === 'startDebugging' || message.action === 'stopDebugging') {
      return { success: true };
    }
    
    return { success: false, error: 'Não implementado no ambiente de desenvolvimento' };
  },
  
  // Mock para connect
  connect: (options: any) => {
    console.log('Mock: Conectando ao runtime', options);
    return {
      onMessage: {
        addListener: (callback: (message: any) => void) => {
          console.log('Mock: Adicionado listener para mensagens de conexão');
        }
      },
      onDisconnect: {
        addListener: (callback: () => void) => {
          console.log('Mock: Adicionado listener para desconexão');
        }
      }
    };
  }
};

// Mock para o objeto chrome.storage
const mockStorage = {
  local: {
    get: async (keys: string | string[] | object) => {
      console.log('Mock: Obtendo dados do storage', keys);
      
      // Simular dados armazenados
      const mockData: Record<string, any> = {
        urlPatterns: [],
        mocks: [],
        targetTabInfo: { id: null, title: 'Desenvolvimento Local', url: 'http://localhost:8080' }
      };
      
      if (typeof keys === 'string') {
        return { [keys]: mockData[keys] };
      } else if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          result[key] = mockData[key];
        });
        return result;
      } else {
        const result: Record<string, any> = {};
        Object.keys(keys).forEach(key => {
          result[key] = mockData[key];
        });
        return result;
      }
    },
    
    set: async (items: object) => {
      console.log('Mock: Salvando dados no storage', items);
      return {};
    }
  }
};

// Mock para o objeto chrome.tabs
const mockTabs = {
  sendMessage: async (tabId: number, message: any) => {
    console.log('Mock: Enviando mensagem para tab', tabId, message);
    return {};
  },
  
  query: async (queryInfo: object) => {
    console.log('Mock: Consultando tabs', queryInfo);
    return [{ id: 1, title: 'Desenvolvimento Local', url: 'http://localhost:8080' }];
  }
};

// Exportar a API do Chrome real ou o mock
export const chromeAPI = {
  runtime: isDevelopment ? mockRuntime : chrome.runtime,
  storage: isDevelopment ? mockStorage : chrome.storage,
  tabs: isDevelopment ? mockTabs : chrome.tabs
};

// Função auxiliar para verificar se estamos em ambiente de desenvolvimento
export const isDevEnvironment = () => isDevelopment;
