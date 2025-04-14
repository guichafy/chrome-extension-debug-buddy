// Tipos para padrões de URL
interface UrlPattern {
  url: string;
  method: string;
  headerType?: string;
  headerName?: string;
  headerValue?: string;
  enabled?: boolean;
  isRegex?: boolean;
}

// Tipos para respostas interceptadas
interface InterceptedResponse {
  url: string;
  method?: string;
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

// Tipos para modificações de resposta
interface ResponseModifications {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

// Tipos para mocks
interface MockConfig {
  urlPattern: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  enabled: boolean;
}

// Tipos para mensagens entre scripts
type MessageAction =
  | 'getMocks'
  | 'startDebugging'
  | 'stopDebugging'
  | 'getDebuggingStatus'
  | 'getPendingResponses'
  | 'getResponseDetails'
  | 'approveResponse'
  | 'newPendingResponse'
  | 'responseBodyReady'
  | 'hot_reload'
  | 'selectTargetTab'
  | 'setTargetTab';

interface Message {
  action: MessageAction;
  tabId?: number;
  requestId?: string;
  url?: string;
  status?: number;
  statusText?: string;
  type?: string;
  mimeType?: string;
  body?: string;
  modifications?: ResponseModifications;
}

interface MessageResponse {
  success?: boolean;
  error?: string;
  isDebugging?: boolean;
  pendingResponses?: Record<string, InterceptedResponse>;
  allRequests?: Record<string, InterceptedResponse>;
  response?: InterceptedResponse;
  mocks?: MockConfig[];
}

// Tipos para as novas regras
interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  matchers: Matcher[];
  action: Action;
  createdAt: number;
  updatedAt: number;
}

interface Matcher {
  type: string;
  enabled: boolean;
  pattern?: string;
  isRegex?: boolean;
  method?: string;
  name?: string;
  value?: string;
  headerType?: 'request' | 'response';
}

interface Action {
  type: string;
  enabled: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}

// Global variables
let isDebugging: boolean = false;
let attachedTabId: number | null = null;
let urlPatterns: (string | UrlPattern)[] = [];
let rules: Rule[] = [];
let pendingResponses: Record<string, InterceptedResponse> = {}; // Store intercepted responses
let allRequests: Record<string, InterceptedResponse> = {}; // Store all requests
// Variáveis globais para rastrear abas
let interceptorTabId: number | null = null;
let targetTabId: number | null = null;
let targetTabTitle: string = '';
let targetTabUrl: string = '';

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Network Request Interceptor extension installed');
});

// Carregar informações da aba alvo do armazenamento quando o background script é iniciado
chrome.storage.local.get(['targetTabInfo'], (result) => {
  if (result.targetTabInfo) {
    targetTabId = result.targetTabInfo.id;
    targetTabTitle = result.targetTabInfo.title || '';
    targetTabUrl = result.targetTabInfo.url || '';
    console.log('Informações da aba alvo carregadas do armazenamento:', result.targetTabInfo);
  }
});

// Support for hot reload during development
if (process.env.NODE_ENV !== 'production') {
  console.log('Running in development mode with hot reload support');
}

// Abrir a janela do interceptor quando o usuário clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('main.html')
  }, (tab) => {
    // Guardar o ID da aba do interceptor
    if (tab && tab.id) {
      interceptorTabId = tab.id;
      console.log(`Aba do interceptor criada com ID: ${interceptorTabId}`);
    }
  });
});

// Quando uma aba é fechada, verificar se é a aba do interceptor
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === interceptorTabId) {
    console.log('Aba do interceptor fechada, parando debugging');
    interceptorTabId = null;

    // Parar debugging se estiver ativo
    if (isDebugging && attachedTabId !== null) {
      stopDebugging().catch(console.error);
    }
  }
});

// Listen for messages from the popup or hot reload
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse: (response: MessageResponse) => void) => {
  // Apenas log mensagens que não são de verificação de status para reduzir ruído
  if (message.action !== 'getDebuggingStatus' && message.action !== 'getPendingResponses') {
    console.log('Received message:', message);
  }

  // Handle hot reload message
  if (message.action === 'hot_reload') {
    console.log('Hot reload triggered');
    // No need to do anything here, the extension will be reloaded by Chrome
    return false;
  }

  if (message.action === 'getMocks') {
    chrome.storage.local.get(['mocks'], function(result: { mocks?: MockConfig[] }) {
      sendResponse({ success: true, mocks: result.mocks || [] });
    });
    return true; // Indicates we'll respond asynchronously
  }

  else if (message.action === 'startDebugging') {
    // Usa o tabId armazenado ou o fornecido pelo usuário
    const tabIdToUse = message.tabId || targetTabId;
    if (tabIdToUse) {
      // Verificar se há padrões de URL ou regras configuradas
      chrome.storage.local.get(['urlPatterns', 'rules'], function(result) {
        const patterns = result.urlPatterns || [];
        const rules = result.rules || [];

        if (patterns.length === 0 && rules.length === 0) {
          sendResponse({ success: false, error: 'Nenhuma regra configurada para interceptar. Adicione pelo menos uma regra.' });
          return;
        }

        startDebugging(tabIdToUse)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('Error starting debugging:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
      return true; // Indicates we'll respond asynchronously
    } else {
      sendResponse({ success: false, error: 'Nenhuma aba selecionada. Selecione uma aba primeiro.' });
      return false;
    }
  }

  else if (message.action === 'stopDebugging') {
    stopDebugging()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error stopping debugging:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates we'll respond asynchronously
  }

  else if (message.action === 'getDebuggingStatus') {
    sendResponse({ isDebugging });
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'getPendingResponses') {
    sendResponse({ pendingResponses });
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'getAllRequests') {
    sendResponse({ allRequests });
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'addToRequestHistory') {
    const { requestId, request } = message;
    if (requestId && request) {
      // Adicionar ao histórico de requisições
      allRequests[requestId] = request;

      // Notificar o frontend sobre a nova requisição para atualizar a UI
      if (interceptorTabId) {
        chrome.tabs.sendMessage(interceptorTabId, {
          action: 'newRequest',
          requestId,
          request
        }).catch(() => {
          // Ignora erros se a página principal não estiver aberta
          console.log('Não foi possível enviar a requisição interceptada para o frontend');
        });
      }

      console.log(`Requisição interceptada ${requestId} adicionada ao histórico`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'ID de requisição ou dados inválidos' });
    }
    return false; // Indica que respondemos de forma síncrona
  }

  else if (message.action === 'getResponseDetails') {
    const { requestId } = message;
    if (requestId && pendingResponses[requestId]) {
      sendResponse({ success: true, response: pendingResponses[requestId] });
    } else {
      sendResponse({ success: false, error: 'Response not found' });
    }
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'selectTargetTab') {
    // Notificar a página principal para abrir o modal de seleção de aba
    if (interceptorTabId) {
      chrome.tabs.sendMessage(interceptorTabId, {
        action: 'openSelectTabDialog'
      }).catch(() => {
        // Ignora erros se a página principal não estiver aberta
      });
    }
    sendResponse({ success: true });
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'setTargetTab') {
    // Armazenar informações da aba selecionada
    if (message.tabId) {
      targetTabId = message.tabId;
      targetTabTitle = message.tabTitle || '';
      targetTabUrl = message.tabUrl || '';

      // Salvar informações da aba no Chrome Storage para persistência
      chrome.storage.local.set({
        targetTabInfo: {
          id: targetTabId,
          title: targetTabTitle,
          url: targetTabUrl
        }
      }, () => {
        console.log('Informações da aba alvo salvas no armazenamento');
      });

      // Notificar a página principal sobre a aba selecionada
      if (interceptorTabId) {
        chrome.tabs.sendMessage(interceptorTabId, {
          action: 'targetTabSelected',
          tabId: targetTabId,
          tabTitle: targetTabTitle,
          tabUrl: targetTabUrl
        }).catch(() => {
          // Ignora erros se a página principal não estiver aberta
        });
      }

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'ID da aba não fornecido' });
    }
    return false; // Indicates we've responded synchronously
  }

  else if (message.action === 'approveResponse') {
    const { requestId, modifications } = message;

    console.log('background.ts - Received approveResponse message:', JSON.stringify(message));
    if (modifications && modifications.status) {
      console.log(`background.ts - Received status code: ${modifications.status}, type: ${typeof modifications.status}`);
    }

    if (!requestId || !pendingResponses[requestId]) {
      sendResponse({ success: false, error: 'Response not found' });
      return false;
    }

    // Apply modifications if provided
    if (modifications) {
      // Garantir que o status code seja um número
      if (modifications.status) {
        modifications.status = Number(modifications.status);
        console.log(`background.ts - Converted status code: ${modifications.status}, type: ${typeof modifications.status}`);
      }

      applyResponseModifications(requestId, modifications)
        .then(() => {
          // Remove from pending responses
          if (requestId) {
            delete pendingResponses[requestId];
          }
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Error applying modifications:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Indicates we'll respond asynchronously
    } else {
      // No modifications, just continue the request (ignoring the response)
      console.log(`Ignoring response for request ${requestId} - continuing without modifications`);
      if (attachedTabId !== null) {
        chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.continueRequest',
          { requestId },
          () => {
            console.log(`Request ${requestId} continued without modifications`);
            // Remove from pending responses
            if (requestId) {
              delete pendingResponses[requestId];
            }
            sendResponse({ success: true });
          }
        );
        return true; // Indicates we'll respond asynchronously
      } else {
        // No active debugging session
        if (requestId) {
          delete pendingResponses[requestId];
        }
        sendResponse({ success: true });
        return false;
      }
    }
  }

  return false;
});

// Apply modifications to a response
async function applyResponseModifications(requestId: string, modifications: ResponseModifications): Promise<boolean> {
  if (!attachedTabId) {
    throw new Error('No active debugging session');
  }

  const pendingResponse = pendingResponses[requestId];
  if (!pendingResponse) {
    throw new Error('Response not found');
  }

  // Verificar se precisamos adicionar headers de resposta conforme configurações
  const url = pendingResponse.url;
  const addResponseHeaders = getResponseHeadersToAdd(url);
  if (addResponseHeaders.length > 0) {
    if (!modifications.headers) {
      modifications.headers = pendingResponse.headers;
    }

    addResponseHeaders.forEach(header => {
      if (modifications.headers) {
        modifications.headers[header.name] = header.value;
      }
    });
  }

  try {
    // Verificar se há alguma modificação (status, headers ou body)
    // Nota: Sempre tratamos como modificação se houver status, headers ou body definidos
    const hasModifications = (
      modifications.status !== undefined ||
      modifications.headers !== undefined ||
      modifications.body !== undefined
    );

    console.log(`Has modifications: ${hasModifications}, status: ${modifications.status}`);

    if (hasModifications) {
      console.log('Modifications detected, attempting to apply changes');

      try {
        // Get original response body format
        const responseBodyResult = await new Promise<{ body: string, base64Encoded: boolean }>((resolve, reject) => {
          chrome.debugger.sendCommand(
            { tabId: attachedTabId as number },
            'Fetch.getResponseBody',
            { requestId },
            (result: any) => {
              // Verificar se houve erro ao buscar o corpo da resposta
              if (chrome.runtime.lastError) {
                console.warn(`Erro ao obter corpo da resposta para ${requestId}: ${chrome.runtime.lastError.message}`);
                // Continuar a requisição original sem interceptar se não pudermos obter o corpo
                // Ou podemos decidir interceptar com corpo vazio dependendo do caso de uso
                // Neste caso, vamos continuar a requisição original para evitar inconsistências
                continueRequest(requestId);
                return;
              }

              const responseBody = result as { body: string, base64Encoded: boolean } | undefined;
              let body = ''; // Inicializar corpo como vazio

              if (responseBody) {
                try {
                  body = responseBody.base64Encoded ?
                    atob(responseBody.body) :
                    responseBody.body;
                } catch (e) {
                  console.error(`Erro ao decodificar base64 para ${requestId}:`, e);
                  // Tratar como corpo vazio ou logar erro
                  body = ''; // Fallback para corpo vazio
                }
              } else {
                // Corpo da resposta pode ser nulo ou vazio
                console.log(`Corpo da resposta para ${requestId} está vazio ou nulo.`);
              }

              resolve({ body, base64Encoded: responseBody?.base64Encoded || false });
            }
          );
        });

        // Determine if the original response was base64 encoded
        let base64Encoded = responseBodyResult.base64Encoded;

        // Prepare the modified body in the correct format
        let modifiedBody: string;

        // Se o body foi modificado, use o novo body
        if (modifications.body && modifications.body !== pendingResponse.body) {
          try {
            // Codifica o corpo como base64 independente do original
            modifiedBody = btoa(encodeURIComponent(modifications.body).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
            // Força base64 para evitar problemas de codificação
            base64Encoded = true;
          } catch (e) {
            console.error('Error encoding body to base64:', e);
            // Se falhar, tenta usar o corpo original
            modifiedBody = responseBodyResult.body;
          }
        } else {
          // Se o body não foi modificado, use o body original
          modifiedBody = responseBodyResult.body;
        }

        // Prepare response headers
        let responseHeaders = pendingResponse.headers;
        if (modifications.headers) {
          responseHeaders = modifications.headers;
        }

        // Convert headers object to array format required by Fetch API
        const headersArray: { name: string, value: string }[] = [];
        for (const [name, value] of Object.entries(responseHeaders)) {
          headersArray.push({ name, value });
        }

        // Prepare status code and phrase
        let statusCode = pendingResponse.status;
        let statusPhrase = getStatusText(statusCode);

        if (modifications.status) {
          console.log(`Original status code: ${statusCode}, type: ${typeof statusCode}`);
          console.log(`Modification status code: ${modifications.status}, type: ${typeof modifications.status}`);

          // Garantir que o status code seja um número
          statusCode = Number(modifications.status);
          statusPhrase = getStatusText(statusCode);

          console.log(`Final status code: ${statusCode}, type: ${typeof statusCode}`);
          console.log(`Applying modified status code: ${statusCode} (${statusPhrase})`);
        }

        // Preparar os parâmetros para o comando
        const fulfillParams = {
          requestId,
          responseCode: statusCode,
          responsePhrase: statusPhrase,
          responseHeaders: headersArray,
          body: modifiedBody,
          base64Encoded: base64Encoded
        };

        console.log('Fetch.fulfillRequest params:', JSON.stringify(fulfillParams));

        // Fulfill the request with modified response
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId as number },
          'Fetch.fulfillRequest',
          fulfillParams
        );

        console.log('Successfully applied modified response');
        return true;
      } catch (modError) {
        console.error('Error modifying response:', modError);
        // If modification fails, fall back to continuing the request
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId as number },
          'Fetch.continueRequest',
          { requestId }
        );
        console.log('Continued request after modification error');
        return true;
      }
    } else {
      // No modifications, just continue the request
      await chrome.debugger.sendCommand(
        { tabId: attachedTabId as number },
        'Fetch.continueRequest',
        { requestId }
      );
      console.log(`Request ${requestId} continued without modifications`);
      return true;
    }
  } catch (error) {
    console.error('Error in applyResponseModifications:', error);

    // If there's an error, try to continue the request anyway to prevent hanging
    try {
      await chrome.debugger.sendCommand(
        { tabId: attachedTabId as number },
        'Fetch.continueRequest',
        { requestId }
      );
      console.log(`Request ${requestId} continued despite error`);
    } catch (continueError) {
      console.error('Error continuing request:', continueError);
    }

    throw error;
  }
}

// Start debugging
async function startDebugging(specificTabId: number | null = null): Promise<boolean> {
  // If already debugging, stop first
  if (isDebugging) {
    await stopDebugging();
  }

  // Get URL patterns and rules from storage
  const result = await chrome.storage.local.get(['urlPatterns', 'rules']);
  urlPatterns = result.urlPatterns || [];
  rules = result.rules || [];

  // Check if we have any patterns or rules to intercept
  if (urlPatterns.length === 0 && rules.length === 0) {
    throw new Error('No URL patterns or rules to intercept');
  }

  console.log(`Loaded ${urlPatterns.length} URL patterns and ${rules.length} rules for interception`);

  // Use o tabId especificado ou tente encontrar uma aba ativa
  let tabId = specificTabId;

  if (!tabId) {
    try {
      // Primeiro, tentamos obter a aba ativa na janela atual
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        tabId = tabs[0].id;
      } else {
        // Se não encontrarmos, buscamos qualquer aba ativa
        const allTabs = await chrome.tabs.query({ active: true });
        if (allTabs.length > 0 && allTabs[0].id) {
          tabId = allTabs[0].id;
        } else {
          throw new Error('Nenhuma aba ativa encontrada');
        }
      }
    } catch (error) {
      console.error('Erro ao obter aba ativa:', error);
      throw new Error('Não foi possível determinar a aba para depuração');
    }
  }

  if (!tabId) {
    throw new Error('Não foi possível determinar a aba para depuração');
  }

  console.log(`Tentando anexar à aba ${tabId}`);

  // Attach debugger to the tab
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    console.log(`Debugger attached to tab ${tabId}`);

    // First disable Network domain to avoid conflicts
    await chrome.debugger.sendCommand({ tabId }, 'Network.disable');

    // Enable Fetch domain for request interception
    // This is the key part - we're intercepting ALL requests at the Response stage
    await chrome.debugger.sendCommand(
      { tabId },
      'Fetch.enable',
      {
        patterns: [
          {
            urlPattern: '*',
            requestStage: 'Response'
            // Removed invalid resourceType: '*'
          }
        ]
      }
    );
    console.log('Fetch domain enabled for response interception');

    // Set up event listeners for debugger events
    chrome.debugger.onEvent.addListener(debuggerEventListener);

    // Set global state
    isDebugging = true;
    attachedTabId = tabId;
    pendingResponses = {};

    console.log('Debugging started successfully');
    return true;
  } catch (error) {
    console.error('Error attaching debugger:', error);
    throw error;
  }
}

// Stop debugging
async function stopDebugging(): Promise<boolean> {
  if (!isDebugging || attachedTabId === null) {
    console.log('Not currently debugging');
    return true;
  }

  try {
    // Continue any pending requests before disabling
    const pendingRequestIds = Object.keys(pendingResponses);
    for (const requestId of pendingRequestIds) {
      try {
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.continueRequest',
          { requestId }
        );
        console.log(`Continued pending request ${requestId} before stopping`);
      } catch (error) {
        console.error(`Error continuing request ${requestId}:`, error);
      }
    }

    // Disable Fetch domain
    await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.disable');
    console.log('Fetch domain disabled');

    // Disable network tracking
    await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Network.disable');
    console.log('Network tracking disabled');

    // Detach debugger
    await chrome.debugger.detach({ tabId: attachedTabId });
    console.log(`Debugger detached from tab ${attachedTabId}`);

    // Remove event listener
    chrome.debugger.onEvent.removeListener(debuggerEventListener);

    // Reset global state
    isDebugging = false;
    attachedTabId = null;
    pendingResponses = {};
    allRequests = {};

    console.log('Debugging stopped successfully');
    return true;
  } catch (error) {
    console.error('Error stopping debugging:', error);
    throw error;
  }
}

// Debugger event listener
function debuggerEventListener(
  debuggeeId: chrome.debugger.Debuggee,
  message: string,
  params: any
): void {
  if (debuggeeId.tabId !== attachedTabId) {
    return;
  }

  // Handle fetch events
  if (message.startsWith('Fetch.')) {
    switch (message) {
      case 'Fetch.requestPaused':
        handleRequestPaused(params);
        break;
    }
  }
}

// Handle paused request
async function handleRequestPaused(params: any): Promise<void> {
  const { requestId, request, responseStatusCode, responseHeaders, resourceType } = params;
  const url = request.url;
  const method = request.method || 'GET';

  console.log(`🟡 REQUEST PAUSED: ${url}`);
  console.log('Request ID:', requestId);
  console.log('Method:', method);
  console.log('Resource Type:', resourceType);

  // Verificar se existe um mock configurado para essa requisição
  const mockResult = await checkForMock(url, method);
  if (mockResult) {
    console.log(`Applying mock for ${url}`);
    applyMockResponse(requestId, mockResult);
    return;
  }

  // Verificar se existe uma regra de breakpoint para essa requisição
  const breakpointRule = await checkForBreakpoint(url, method);
  if (breakpointRule) {
    console.log(`Applying breakpoint for ${url}`);
    // Não precisamos fazer nada especial aqui, pois o fluxo normal já vai interceptar a requisição
    // e adicionar à lista de pendingResponses para o usuário interagir
  }

  // Sempre obter o corpo da resposta para todas as requisições
  chrome.debugger.sendCommand(
    { tabId: attachedTabId as number },
    'Fetch.getResponseBody',
    { requestId },
    (result: any) => {
      // Verificar se houve erro ao buscar o corpo da resposta
      if (chrome.runtime.lastError) {
        console.warn(`Erro ao obter corpo da resposta para ${requestId}: ${chrome.runtime.lastError.message}`);
        // Continuar a requisição original sem interceptar se não pudermos obter o corpo
        // Ou podemos decidir interceptar com corpo vazio dependendo do caso de uso
        // Neste caso, vamos continuar a requisição original para evitar inconsistências
        continueRequest(requestId);
        return;
      }

      const responseBody = result as { body: string, base64Encoded: boolean } | undefined;
      let body = ''; // Inicializar corpo como vazio

      if (responseBody) {
        try {
          body = responseBody.base64Encoded ?
            atob(responseBody.body) :
            responseBody.body;
        } catch (e) {
          console.error(`Erro ao decodificar base64 para ${requestId}:`, e);
          // Tratar como corpo vazio ou logar erro
          body = ''; // Fallback para corpo vazio
        }
      } else {
        // Corpo da resposta pode ser nulo ou vazio
        console.log(`Corpo da resposta para ${requestId} está vazio ou nulo.`);
      }

      // Criar objeto de resposta
      const responseObj: InterceptedResponse = {
        url,
        method,
        status: responseStatusCode,
        statusText: getStatusText(responseStatusCode),
        headers: responseHeadersToObject(responseHeaders),
        mimeType: getMimeTypeFromHeaders(responseHeaders),
        type: resourceType,
        timestamp: Date.now(),
        body: body // Usa o corpo processado (ou vazio)
      };

      // Armazenar em allRequests
      allRequests[requestId] = responseObj;

      // Check if this URL should be intercepted based on our patterns
      if (shouldInterceptUrl(url, request)) {
        // This is a URL we want to intercept
        console.log(`Intercepting response for ${url}`);

        // Adicionar flag isWaiting para requisições interceptadas
        pendingResponses[requestId] = {
          ...responseObj,
          isWaiting: true
        };

        // Notify popup about new pending response
        chrome.runtime.sendMessage({
          action: 'newPendingResponse',
          requestId,
          url,
          method,
          status: responseStatusCode,
          statusText: getStatusText(responseStatusCode),
          type: resourceType,
          mimeType: getMimeTypeFromHeaders(responseHeaders)
        });

        console.log(`Response for ${url} is now pending user approval`);
      } else {
        // This is not a URL we want to intercept, continue the request
        continueRequest(requestId);

        // Notificar o frontend sobre a nova requisição para armazenamento no IndexedDB
        if (interceptorTabId) {
          chrome.tabs.sendMessage(interceptorTabId, {
            action: 'newRequest',
            requestId,
            request: responseObj
          }).catch(() => {
            // Ignora erros se a página principal não estiver aberta
            console.log('Não foi possível enviar a nova requisição para o frontend');
          });
        }
      }
    }
  );
}

// Helper function to continue a request
function continueRequest(requestId: string): void {
  if (attachedTabId !== null) {
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Fetch.continueRequest',
      { requestId },
      () => {
        console.log(`Continued request ${requestId}`);
      }
    );
  }
}

// Helper function to get status text from status code
function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  return statusTexts[statusCode] || 'Unknown';
}

// Helper function to convert response headers array to object
function responseHeadersToObject(headers: { name: string, value: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  if (Array.isArray(headers)) {
    headers.forEach(header => {
      result[header.name] = header.value;
    });
  }
  return result;
}

// Helper function to get MIME type from headers
function getMimeTypeFromHeaders(headers: { name: string, value: string }[]): string {
  if (Array.isArray(headers)) {
    const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
    if (contentType) {
      return contentType.value.split(';')[0].trim();
    }
  }
  return 'text/plain';
}

// Obter headers de resposta para adicionar com base nas configurações
function getResponseHeadersToAdd(url: string): { name: string, value: string }[] {
  const responseHeaders: { name: string, value: string }[] = [];

  // Procurar por configurações que correspondam a esta URL e tenham headers de resposta
  urlPatterns.forEach(pattern => {
    if (typeof pattern !== 'string' && pattern.url && url.includes(pattern.url)) {
      // Verificar se a regra está habilitada
      if (pattern.enabled === false) return;

      // Se for uma configuração com header de resposta
      if (pattern.headerName && pattern.headerValue && pattern.headerType === 'response') {
        responseHeaders.push({
          name: pattern.headerName,
          value: pattern.headerValue
        });
      }
    }
  });

  return responseHeaders;
}

// Check if a URL should be intercepted based on our patterns
function shouldInterceptUrl(url: string, request: any): boolean {
  if (!url) return false;

  // Primeiro, verificar as regras antigas (urlPatterns)
  const matchesOldPattern = urlPatterns.some(pattern => {
    // Verificar se é um objeto de configuração ou uma string (compatibilidade)
    if (typeof pattern === 'string') {
      // String simples (contém)
      return url.includes(pattern);
    } else {
      // Verificar se a regra está habilitada
      if (pattern.enabled === false) return false;

      // Verificar se a URL corresponde
      let urlMatches = false;

      if (pattern.isRegex) {
        // Usar expressão regular para verificar a correspondência
        try {
          const regex = new RegExp(pattern.url);
          urlMatches = regex.test(url);
        } catch (error) {
          console.error(`Erro ao processar expressão regular '${pattern.url}':`, error);
          return false; // Se a expressão regular for inválida, não intercepta
        }
      } else {
        // Usar método includes para verificação simples
        urlMatches = url.includes(pattern.url);
      }

      if (!urlMatches) return false;

      // Verificar o método HTTP, se especificado
      if (pattern.method && pattern.method !== 'ANY') {
        if (request.method !== pattern.method) return false;
      }

      // Verificar headers na request, se especificados
      if (pattern.headerName && pattern.headerValue && pattern.headerType === 'request') {
        // Verificar se o header na request corresponde
        const headerValue = request.headers.find((h: { name: string, value: string }) =>
          h.name.toLowerCase() === pattern.headerName?.toLowerCase()
        )?.value;

        if (!headerValue || headerValue !== pattern.headerValue) return false;
      }

      // Todos os critérios foram satisfeitos
      return true;
    }
  });

  // Se corresponder a um padrão antigo, interceptar
  if (matchesOldPattern) {
    return true;
  }

  // Verificar as novas regras
  return rules.some(rule => {
    // Verificar se a regra está habilitada
    if (!rule.enabled) return false;

    // Verificar se todos os matchers habilitados correspondem
    const allMatchersMatch = rule.matchers.every(matcher => {
      // Ignorar matchers desabilitados
      if (!matcher.enabled) return true;

      switch (matcher.type) {
        case 'url':
          if (!matcher.pattern) return false;

          if (matcher.isRegex) {
            try {
              const regex = new RegExp(matcher.pattern);
              return regex.test(url);
            } catch (error) {
              console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
              return false;
            }
          } else {
            return url.includes(matcher.pattern);
          }

        case 'method':
          if (!matcher.method) return true; // Se não tiver método, considera como correspondente
          return matcher.method === 'ANY' || matcher.method === request.method;

        case 'header':
          if (!matcher.name || !matcher.value || !matcher.headerType) return false;
          if (matcher.headerType !== 'request') return true; // Ignorar headers de resposta neste ponto

          // Verificar se o header na request corresponde
          const headerValue = request.headers.find((h: { name: string, value: string }) =>
            h.name.toLowerCase() === matcher.name.toLowerCase()
          )?.value;

          return !!headerValue && headerValue === matcher.value;

        case 'body':
          // Não podemos verificar o corpo da requisição neste ponto
          // Sempre retorna true para não bloquear a interceptação
          return true;

        default:
          return false;
      }
    });

    // Verificar se a ação está habilitada
    if (!rule.action.enabled) return false;

    // Se todos os matchers corresponderem e a ação estiver habilitada, interceptar
    // Interceptamos tanto regras de mock quanto de breakpoint
    return allMatchersMatch && (rule.action.type === 'mock' || rule.action.type === 'breakpoint');
  });
}

// Verifica se existe um mock configurado para a URL
async function checkForMock(url: string, method: string): Promise<MockConfig | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['mocks', 'rules'], (result: { mocks?: MockConfig[], rules?: Rule[] }) => {
      const mocks = result.mocks || [];
      const rules = result.rules || [];

      // Procura por um mock que corresponda à URL e método e esteja habilitado
      const mock = mocks.find(m => {
        // Verificar se o mock está habilitado
        const isEnabled = m.enabled !== undefined ? m.enabled : true; // Se não tiver a propriedade, considera como habilitado
        if (!isEnabled) return false;

        // Verificar se o método corresponde
        const methodMatches = m.method === 'ANY' || m.method === method;
        if (!methodMatches) return false;

        // Verificar se a URL corresponde
        let urlMatches = false;

        // Verificar se o padrão de URL é uma expressão regular
        if (m.urlPattern.startsWith('^') || m.urlPattern.includes('.*') || m.urlPattern.endsWith('$')) {
          try {
            const regex = new RegExp(m.urlPattern);
            urlMatches = regex.test(url);
          } catch (error) {
            console.error(`Erro ao processar expressão regular '${m.urlPattern}' no mock:`, error);
            return false;
          }
        } else {
          // Usar método includes para verificação simples
          urlMatches = url.includes(m.urlPattern);
        }

        return urlMatches && methodMatches && isEnabled;
      });

      // Se encontrou um mock antigo, retorna
      if (mock) {
        console.log(`Mock encontrado para ${url} no formato antigo`);
        resolve(mock);
        return;
      }

      // Procurar por uma regra com ação de mock que corresponda à URL e método
      for (const rule of rules) {
        // Verificar se a regra está habilitada
        if (!rule.enabled) continue;

        // Verificar se a ação é do tipo mock e está habilitada
        if (rule.action.type !== 'mock' || !rule.action.enabled) continue;

        // Verificar se todos os matchers habilitados correspondem
        const allMatchersMatch = rule.matchers.every(matcher => {
          // Ignorar matchers desabilitados
          if (!matcher.enabled) return true;

          switch (matcher.type) {
            case 'url':
              if (!matcher.pattern) return false;

              if (matcher.isRegex) {
                try {
                  const regex = new RegExp(matcher.pattern);
                  return regex.test(url);
                } catch (error) {
                  console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
                  return false;
                }
              } else {
                return url.includes(matcher.pattern);
              }

            case 'method':
              if (!matcher.method) return true; // Se não tiver método, considera como correspondente
              return matcher.method === 'ANY' || matcher.method === method;

            case 'header':
              // Não podemos verificar headers neste ponto
              // Sempre retorna true para não bloquear o mock
              return true;

            case 'body':
              // Não podemos verificar o corpo da requisição neste ponto
              // Sempre retorna true para não bloquear o mock
              return true;

            default:
              return false;
          }
        });

        // Se todos os matchers corresponderem, criar um mock a partir da regra
        if (allMatchersMatch) {
          console.log(`Mock encontrado para ${url} no novo formato de regras`);

          // Converter a ação de mock para o formato de MockConfig
          const mockFromRule: MockConfig = {
            urlPattern: rule.matchers.find(m => m.type === 'url')?.pattern || url,
            method: rule.matchers.find(m => m.type === 'method')?.method || 'ANY',
            status: rule.action.status || 200,
            headers: rule.action.headers || {},
            body: rule.action.body || '',
            createdAt: rule.createdAt,
            enabled: true
          };

          resolve(mockFromRule);
          return;
        }
      }

      // Se não encontrou nenhum mock, retorna undefined
      resolve(undefined);
    });
  });
}

// Verifica se existe uma regra de breakpoint configurada para a URL
async function checkForBreakpoint(url: string, method: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['rules'], (result: { rules?: Rule[] }) => {
      const rules = result.rules || [];

      // Procurar por uma regra com ação de breakpoint que corresponda à URL e método
      for (const rule of rules) {
        // Verificar se a regra está habilitada
        if (!rule.enabled) continue;

        // Verificar se a ação é do tipo breakpoint e está habilitada
        if (rule.action.type !== 'breakpoint' || !rule.action.enabled) continue;

        // Verificar se todos os matchers habilitados correspondem
        const allMatchersMatch = rule.matchers.every(matcher => {
          // Ignorar matchers desabilitados
          if (!matcher.enabled) return true;

          switch (matcher.type) {
            case 'url':
              if (!matcher.pattern) return false;

              if (matcher.isRegex) {
                try {
                  const regex = new RegExp(matcher.pattern);
                  return regex.test(url);
                } catch (error) {
                  console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
                  return false;
                }
              } else {
                return url.includes(matcher.pattern);
              }

            case 'method':
              if (!matcher.method) return true; // Se não tiver método, considera como correspondente
              return matcher.method === 'ANY' || matcher.method === method;

            case 'header':
              // Não podemos verificar headers neste ponto
              // Sempre retorna true para não bloquear o breakpoint
              return true;

            case 'body':
              // Não podemos verificar o corpo da requisição neste ponto
              // Sempre retorna true para não bloquear o breakpoint
              return true;

            default:
              return false;
          }
        });

        // Se todos os matchers corresponderem, encontramos uma regra de breakpoint
        if (allMatchersMatch) {
          console.log(`Breakpoint encontrado para ${url} na regra: ${rule.name}`);
          resolve(true);
          return;
        }
      }

      // Se não encontrou nenhuma regra de breakpoint, retorna false
      resolve(false);
    });
  });
}

// Aplica um mock como resposta para uma requisição
async function applyMockResponse(requestId: string, mock: MockConfig): Promise<void> {
  if (!attachedTabId || !mock) return;

  try {
    // Converte headers de objeto para array (formato esperado pelo API Fetch)
    const headerArray: { name: string, value: string }[] = [];
    for (const [name, value] of Object.entries(mock.headers)) {
      headerArray.push({ name, value });
    }

    // Importante: O Chrome espera que o body seja codificado como base64
    // quando passado para fulfillRequest
    let base64Body: string;
    try {
      // Tenta codificar o corpo como base64
      base64Body = btoa(encodeURIComponent(mock.body).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
      console.log('Body codificado em base64:', base64Body);
    } catch (encodeError) {
      console.error('Erro ao codificar corpo em base64:', encodeError);
      // Se falhar, tenta um fallback seguro
      const fallbackBody = JSON.stringify({message: "Mock body error - could not encode"});
      base64Body = btoa(fallbackBody);
    }

    // Obter o texto do status para o código
    const statusPhrase = getStatusText(mock.status);

    // Criar objeto de resposta para armazenar no histórico
    const responseObj: InterceptedResponse = {
      url: mock.urlPattern, // Usamos o padrão de URL do mock
      method: mock.method,
      status: mock.status,
      statusText: statusPhrase,
      headers: mock.headers,
      mimeType: getMimeTypeFromHeaders(headerArray),
      type: 'mock',
      timestamp: Date.now(),
      body: mock.body,
      isMocked: true
    };

    // Armazenar em allRequests
    allRequests[requestId] = responseObj;

    // Notificar o frontend sobre a nova requisição mockada
    if (interceptorTabId) {
      chrome.tabs.sendMessage(interceptorTabId, {
        action: 'newRequest',
        requestId,
        request: responseObj
      }).catch(() => {
        // Ignora erros se a página principal não estiver aberta
        console.log('Não foi possível enviar a requisição mockada para o frontend');
      });
    }

    // Envia a resposta mockada com o body corretamente codificado
    await chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Fetch.fulfillRequest',
      {
        requestId,
        responseCode: mock.status,
        responsePhrase: statusPhrase,
        responseHeaders: headerArray,
        body: base64Body,
        base64Encoded: true // Importante! Indica que o body está em base64
      }
    );

    console.log(`Mock aplicado com sucesso para ${requestId}`);
  } catch (error) {
    console.error('Erro ao aplicar mock:', error);

    // Em caso de erro, tenta continuar a requisição original
    try {
      await chrome.debugger.sendCommand(
        { tabId: attachedTabId },
        'Fetch.continueRequest',
        { requestId }
      );
    } catch (continueError) {
      console.error('Erro ao continuar requisição após falha do mock:', continueError);
    }
  }
}

// Handle debugger detached event
chrome.debugger.onDetach.addListener((debuggeeId: chrome.debugger.Debuggee, reason: string) => {
  if (debuggeeId.tabId === attachedTabId) {
    console.log(`Debugger detached: ${reason}`);
    isDebugging = false;
    attachedTabId = null;
  }
});
