// Global variables
let isDebugging = false;
let attachedTabId = null;
let urlPatterns = [];
let pendingResponses = {}; // Store intercepted responses
// Variáveis globais para rastrear abas
let interceptorTabId = null;
// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('Network Request Interceptor extension installed');
});
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
// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.action === 'getMocks') {
        chrome.storage.local.get(['mocks'], function (result) {
            sendResponse({ success: true, mocks: result.mocks || [] });
        });
        return true; // Indicates we'll respond asynchronously
    }
    else if (message.action === 'startDebugging') {
        // Usa o tabId fornecido pelo usuário através da interface
        const targetTabId = message.tabId;
        if (targetTabId) {
            startDebugging(targetTabId)
                .then(() => sendResponse({ success: true }))
                .catch(error => {
                console.error('Error starting debugging:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Indicates we'll respond asynchronously
        }
        else {
            sendResponse({ success: false, error: 'No tab ID provided' });
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
    else if (message.action === 'getResponseDetails') {
        const { requestId } = message;
        if (requestId && pendingResponses[requestId]) {
            sendResponse({ success: true, response: pendingResponses[requestId] });
        }
        else {
            sendResponse({ success: false, error: 'Response not found' });
        }
        return false; // Indicates we've responded synchronously
    }
    else if (message.action === 'approveResponse') {
        const { requestId, modifications } = message;
        if (!requestId || !pendingResponses[requestId]) {
            sendResponse({ success: false, error: 'Response not found' });
            return false;
        }
        // Apply modifications if provided
        if (modifications) {
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
        }
        else {
            // No modifications, just continue the request
            if (attachedTabId !== null) {
                chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId }, () => {
                    console.log(`Request ${requestId} continued without modifications`);
                    // Remove from pending responses
                    if (requestId) {
                        delete pendingResponses[requestId];
                    }
                    sendResponse({ success: true });
                });
                return true; // Indicates we'll respond asynchronously
            }
            else {
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
async function applyResponseModifications(requestId, modifications) {
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
        // Check if body was modified
        if (modifications.body && modifications.body !== pendingResponse.body) {
            console.log('Body was modified, attempting to apply changes');
            try {
                // Get original response body format
                const responseBodyResult = await new Promise((resolve, reject) => {
                    chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.getResponseBody', { requestId }, (result) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        }
                        else {
                            resolve(result);
                        }
                    });
                });
                // Determine if the original response was base64 encoded
                let base64Encoded = responseBodyResult.base64Encoded;
                // Prepare the modified body in the correct format - sempre codifica como base64
                let modifiedBody;
                try {
                    // Codifica o corpo como base64 independente do original
                    modifiedBody = btoa(unescape(encodeURIComponent(modifications.body)));
                    // Força base64 para evitar problemas de codificação
                    base64Encoded = true;
                }
                catch (e) {
                    console.error('Error encoding body to base64:', e);
                    // Se falhar, tenta usar o corpo original
                    modifiedBody = responseBodyResult.body;
                }
                // Prepare response headers
                let responseHeaders = pendingResponse.headers;
                if (modifications.headers) {
                    responseHeaders = modifications.headers;
                }
                // Convert headers object to array format required by Fetch API
                const headersArray = [];
                for (const [name, value] of Object.entries(responseHeaders)) {
                    headersArray.push({ name, value });
                }
                // Prepare status code
                let statusCode = pendingResponse.status;
                if (modifications.status) {
                    statusCode = modifications.status;
                }
                // Fulfill the request with modified response
                await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.fulfillRequest', {
                    requestId,
                    responseCode: statusCode,
                    responseHeaders: headersArray,
                    body: modifiedBody,
                    base64Encoded: base64Encoded
                });
                console.log('Successfully applied modified response');
                return true;
            }
            catch (modError) {
                console.error('Error modifying response:', modError);
                // If modification fails, fall back to continuing the request
                await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId });
                console.log('Continued request after modification error');
                return true;
            }
        }
        else {
            // No body modifications, just continue the request
            await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId });
            console.log(`Request ${requestId} continued without modifications`);
            return true;
        }
    }
    catch (error) {
        console.error('Error in applyResponseModifications:', error);
        // If there's an error, try to continue the request anyway to prevent hanging
        try {
            await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId });
            console.log(`Request ${requestId} continued despite error`);
        }
        catch (continueError) {
            console.error('Error continuing request:', continueError);
        }
        throw error;
    }
}
// Start debugging
async function startDebugging(specificTabId = null) {
    // If already debugging, stop first
    if (isDebugging) {
        await stopDebugging();
    }
    // Get URL patterns from storage
    const result = await chrome.storage.local.get(['urlPatterns']);
    urlPatterns = result.urlPatterns || [];
    if (urlPatterns.length === 0) {
        throw new Error('No URL patterns to intercept');
    }
    // Use o tabId especificado ou tente encontrar uma aba ativa
    let tabId = specificTabId;
    if (!tabId) {
        try {
            // Primeiro, tentamos obter a aba ativa na janela atual
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].id) {
                tabId = tabs[0].id;
            }
            else {
                // Se não encontrarmos, buscamos qualquer aba ativa
                const allTabs = await chrome.tabs.query({ active: true });
                if (allTabs.length > 0 && allTabs[0].id) {
                    tabId = allTabs[0].id;
                }
                else {
                    throw new Error('Nenhuma aba ativa encontrada');
                }
            }
        }
        catch (error) {
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
        await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
            patterns: [
                {
                    urlPattern: '*',
                    requestStage: 'Response'
                    // Removed invalid resourceType: '*'
                }
            ]
        });
        console.log('Fetch domain enabled for response interception');
        // Set up event listeners for debugger events
        chrome.debugger.onEvent.addListener(debuggerEventListener);
        // Set global state
        isDebugging = true;
        attachedTabId = tabId;
        pendingResponses = {};
        console.log('Debugging started successfully');
        return true;
    }
    catch (error) {
        console.error('Error attaching debugger:', error);
        throw error;
    }
}
// Stop debugging
async function stopDebugging() {
    if (!isDebugging || attachedTabId === null) {
        console.log('Not currently debugging');
        return true;
    }
    try {
        // Continue any pending requests before disabling
        const pendingRequestIds = Object.keys(pendingResponses);
        for (const requestId of pendingRequestIds) {
            try {
                await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId });
                console.log(`Continued pending request ${requestId} before stopping`);
            }
            catch (error) {
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
        console.log('Debugging stopped successfully');
        return true;
    }
    catch (error) {
        console.error('Error stopping debugging:', error);
        throw error;
    }
}
// Debugger event listener
function debuggerEventListener(debuggeeId, message, params) {
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
async function handleRequestPaused(params) {
    const { requestId, request, responseStatusCode, responseHeaders, resourceType } = params;
    const url = request.url;
    console.log(`🟡 REQUEST PAUSED: ${url}`);
    console.log('Request ID:', requestId);
    console.log('Method:', request.method);
    console.log('Resource Type:', resourceType);
    // Verificar se existe um mock configurado para essa requisição
    const mockResult = await checkForMock(url, request.method);
    if (mockResult) {
        console.log(`Applying mock for ${url}`);
        applyMockResponse(requestId, mockResult);
        return;
    }
    // Check if this URL should be intercepted based on our patterns
    if (shouldInterceptUrl(url, request)) {
        // This is a URL we want to intercept
        console.log(`Intercepting response for ${url}`);
        // Get response body
        chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.getResponseBody', { requestId }, (result) => {
            const responseBody = result;
            if (responseBody) {
                let body = responseBody.base64Encoded ?
                    atob(responseBody.body) :
                    responseBody.body;
                // Store response info
                pendingResponses[requestId] = {
                    url,
                    status: responseStatusCode,
                    statusText: getStatusText(responseStatusCode),
                    headers: responseHeadersToObject(responseHeaders),
                    mimeType: getMimeTypeFromHeaders(responseHeaders),
                    type: resourceType,
                    timestamp: Date.now(),
                    body: body,
                    isWaiting: true
                };
                // Notify popup about new pending response
                chrome.runtime.sendMessage({
                    action: 'newPendingResponse',
                    requestId,
                    url,
                    status: responseStatusCode,
                    statusText: getStatusText(responseStatusCode),
                    type: resourceType,
                    mimeType: getMimeTypeFromHeaders(responseHeaders)
                });
                console.log(`Response for ${url} is now pending user approval`);
            }
            else {
                // If we can't get the response body, just continue the request
                continueRequest(requestId);
            }
        });
    }
    else {
        // This is not a URL we want to intercept, continue the request
        continueRequest(requestId);
    }
}
// Helper function to continue a request
function continueRequest(requestId) {
    if (attachedTabId !== null) {
        chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId }, () => {
            console.log(`Continued request ${requestId}`);
        });
    }
}
// Helper function to get status text from status code
function getStatusText(statusCode) {
    const statusTexts = {
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
function responseHeadersToObject(headers) {
    const result = {};
    if (Array.isArray(headers)) {
        headers.forEach(header => {
            result[header.name] = header.value;
        });
    }
    return result;
}
// Helper function to get MIME type from headers
function getMimeTypeFromHeaders(headers) {
    if (Array.isArray(headers)) {
        const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
        if (contentType) {
            return contentType.value.split(';')[0].trim();
        }
    }
    return 'text/plain';
}
// Obter headers de resposta para adicionar com base nas configurações
function getResponseHeadersToAdd(url) {
    const responseHeaders = [];
    // Procurar por configurações que correspondam a esta URL e tenham headers de resposta
    urlPatterns.forEach(pattern => {
        if (typeof pattern !== 'string' && pattern.url && url.includes(pattern.url)) {
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
function shouldInterceptUrl(url, request) {
    if (!url)
        return false;
    return urlPatterns.some(pattern => {
        // Verificar se é um objeto de configuração ou uma string (compatibilidade)
        if (typeof pattern === 'string') {
            // String simples (contém)
            return url.includes(pattern);
        }
        else {
            // Verificar se a URL corresponde
            const urlMatches = url.includes(pattern.url);
            if (!urlMatches)
                return false;
            // Verificar o método HTTP, se especificado
            if (pattern.method && pattern.method !== 'ANY') {
                if (request.method !== pattern.method)
                    return false;
            }
            // Verificar headers na request, se especificados
            if (pattern.headerName && pattern.headerValue && pattern.headerType === 'request') {
                // Verificar se o header na request corresponde
                const headerValue = request.headers.find((h) => h.name.toLowerCase() === pattern.headerName?.toLowerCase())?.value;
                if (!headerValue || headerValue !== pattern.headerValue)
                    return false;
            }
            // Todos os critérios foram satisfeitos
            return true;
        }
    });
}
// Verifica se existe um mock configurado para a URL
async function checkForMock(url, method) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['mocks'], (result) => {
            const mocks = result.mocks || [];
            // Procura por um mock que corresponda à URL e método e esteja habilitado
            const mock = mocks.find(m => {
                const urlMatches = url.includes(m.urlPattern);
                const methodMatches = m.method === 'ANY' || m.method === method;
                const isEnabled = m.enabled !== undefined ? m.enabled : true; // Se não tiver a propriedade, considera como habilitado
                return urlMatches && methodMatches && isEnabled;
            });
            resolve(mock);
        });
    });
}
// Aplica um mock como resposta para uma requisição
async function applyMockResponse(requestId, mock) {
    if (!attachedTabId || !mock)
        return;
    try {
        // Converte headers de objeto para array (formato esperado pelo API Fetch)
        const headerArray = [];
        for (const [name, value] of Object.entries(mock.headers)) {
            headerArray.push({ name, value });
        }
        // Importante: O Chrome espera que o body seja codificado como base64
        // quando passado para fulfillRequest
        let base64Body;
        try {
            // Tenta codificar o corpo como base64
            base64Body = btoa(unescape(encodeURIComponent(mock.body)));
            console.log('Body codificado em base64:', base64Body);
        }
        catch (encodeError) {
            console.error('Erro ao codificar corpo em base64:', encodeError);
            // Se falhar, tenta um fallback seguro
            const fallbackBody = JSON.stringify({ message: "Mock body error - could not encode" });
            base64Body = btoa(fallbackBody);
        }
        // Envia a resposta mockada com o body corretamente codificado
        await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.fulfillRequest', {
            requestId,
            responseCode: mock.status,
            responseHeaders: headerArray,
            body: base64Body,
            base64Encoded: true // Importante! Indica que o body está em base64
        });
        console.log(`Mock aplicado com sucesso para ${requestId}`);
    }
    catch (error) {
        console.error('Erro ao aplicar mock:', error);
        // Em caso de erro, tenta continuar a requisição original
        try {
            await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.continueRequest', { requestId });
        }
        catch (continueError) {
            console.error('Erro ao continuar requisição após falha do mock:', continueError);
        }
    }
}
// Handle debugger detached event
chrome.debugger.onDetach.addListener((debuggeeId, reason) => {
    if (debuggeeId.tabId === attachedTabId) {
        console.log(`Debugger detached: ${reason}`);
        isDebugging = false;
        attachedTabId = null;
    }
});
//# sourceMappingURL=background.js.map