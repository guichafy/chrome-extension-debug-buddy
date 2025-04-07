// Tipos para respostas interceptadas
interface InterceptedResponse {
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

// Tipos para modificações de resposta
interface ResponseModifications {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

// Support for hot reload during development
if (process.env.NODE_ENV !== 'production') {
  console.log('Popup running in development mode with hot reload support');
}

// Função para converter texto de headers em um objeto
function parseHeaders(headersText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headersText.split('\n');

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      headers[key] = value;
    }
  });

  return headers;
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - Settings tab
  const urlPatternInput = document.getElementById('urlPattern') as HTMLInputElement;
  const httpMethodSelect = document.getElementById('httpMethod') as HTMLSelectElement;
  const requestHeaderNameInput = document.getElementById('requestHeaderName') as HTMLInputElement;
  const requestHeaderValueInput = document.getElementById('requestHeaderValue') as HTMLInputElement;
  const headerTypeSelect = document.getElementById('headerType') as HTMLSelectElement;
  const addUrlButton = document.getElementById('addUrl') as HTMLElement;
  const urlList = document.getElementById('urlList') as HTMLElement;
  const startDebuggingButton = document.getElementById('startDebugging') as HTMLElement;
  const stopDebuggingButton = document.getElementById('stopDebugging') as HTMLElement;
  const statusElement = document.getElementById('status') as HTMLElement;

  // DOM elements - Tabs
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM elements - Responses tab
  const pendingResponsesList = document.getElementById('pendingResponsesList') as HTMLElement;
  const responseDetails = document.getElementById('responseDetails') as HTMLElement;
  const responseUrl = document.getElementById('responseUrl') as HTMLElement;
  const responseType = document.getElementById('responseType') as HTMLElement;
  const responseMimeType = document.getElementById('responseMimeType') as HTMLElement;
  const responseStatus = document.getElementById('responseStatus') as HTMLInputElement;
  const responseHeaders = document.getElementById('responseHeaders') as HTMLTextAreaElement;
  const responseBody = document.getElementById('responseBody') as HTMLTextAreaElement;
  const approveResponseButton = document.getElementById('approveResponse') as HTMLElement;
  const cancelEditButton = document.getElementById('cancelEdit') as HTMLElement;

  // Current state
  let currentRequestId: string | null = null;
  let pendingResponses: Record<string, InterceptedResponse> = {};

  // Load saved URL patterns
  loadUrlPatterns();

  // Check debugging status
  checkDebuggingStatus();

  // Event listeners - Settings tab
  addUrlButton.addEventListener('click', addUrlPattern);
  startDebuggingButton.addEventListener('click', startDebugging);
  stopDebuggingButton.addEventListener('click', stopDebugging);

  // Event listeners - Tabs
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);

        // If switching to responses tab, refresh the list
        if (tabName === 'responses') {
          loadPendingResponses();
        }
      }
    });
  });

  // Event listeners - Responses tab
  approveResponseButton.addEventListener('click', approveResponse);
  cancelEditButton.addEventListener('click', hideResponseDetails);

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
    if (message.action === 'newPendingResponse') {
      // Add to pending responses
      pendingResponses[message.requestId] = {
        url: message.url,
        status: message.status,
        statusText: message.statusText,
        type: message.type,
        mimeType: message.mimeType,
        body: "",
        headers: {},
        timestamp: Date.now()
      };

      // Update UI if on responses tab
      if (document.getElementById('responses')?.classList.contains('active')) {
        updatePendingResponsesList();
      }
    }
    else if (message.action === 'responseBodyReady') {
      // Update body in pending responses
      if (pendingResponses[message.requestId]) {
        pendingResponses[message.requestId].body = message.body;

        // Update UI if this response is currently being viewed
        if (currentRequestId === message.requestId) {
          responseBody.value = message.body;
        }
      }
    }
    else if (message.action === 'hot_reload') {
      console.log('Hot reload message received, reloading popup...');
      window.location.reload();
    }
  });

  // Tab switching
  function switchTab(tabName: string): void {
    // Update tab buttons
    tabButtons.forEach(button => {
      if (button.getAttribute('data-tab') === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Update tab contents
    tabContents.forEach(content => {
      if (content.id === tabName) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  // Add URL pattern to the list
  function addUrlPattern(): void {
    const urlPattern = urlPatternInput.value.trim();
    const httpMethod = httpMethodSelect.value;
    const headerName = requestHeaderNameInput.value.trim();
    const headerValue = requestHeaderValueInput.value.trim();
    const headerType = headerTypeSelect.value;

    if (!urlPattern) {
      alert('Por favor, insira um padrão de URL');
      return;
    }

    // Preparar o objeto de configuração de interceptação
    const interceptConfig = {
      url: urlPattern,
      method: httpMethod,
    } as any;

    // Adicionar header se estiver preenchido
    if (headerName && headerValue) {
      interceptConfig.headerType = headerType;
      interceptConfig.headerName = headerName;
      interceptConfig.headerValue = headerValue;
    }

    // Get existing patterns
    chrome.storage.local.get(['urlPatterns'], function(result) {
      const patterns = result.urlPatterns || [];

      // Verificar se já existe uma configuração idêntica
      const exists = patterns.some((pattern: any) => {
        if (typeof pattern === 'string') {
          return pattern === urlPattern;
        } else {
          return pattern.url === urlPattern &&
                 pattern.method === httpMethod &&
                 pattern.headerName === headerName &&
                 pattern.headerValue === headerValue &&
                 pattern.headerType === headerType;
        }
      });

      if (exists) {
        alert('Esta configuração de interceptação já existe na lista');
        return;
      }

      // Adicionar nova configuração
      patterns.push(interceptConfig);

      // Salvar as configurações atualizadas
      chrome.storage.local.set({ urlPatterns: patterns }, function() {
        // Limpar os campos
        urlPatternInput.value = '';
        httpMethodSelect.value = 'ANY';
        requestHeaderNameInput.value = '';
        requestHeaderValueInput.value = '';
        headerTypeSelect.value = 'request';

        // Atualizar a lista
        loadUrlPatterns();
      });
    });
  }

  // Load URL patterns from storage
  function loadUrlPatterns(): void {
    chrome.storage.local.get(['urlPatterns'], function(result) {
      const patterns = result.urlPatterns || [];

      // Clear current list
      urlList.innerHTML = '';

      // Add each pattern to the list
      patterns.forEach(function(pattern: any, index: number) {
        const li = document.createElement('li');

        const patternText = document.createElement('div');
        patternText.className = 'pattern-info';

        // Verificar se é um objeto de configuração ou uma string (compatibilidade)
        if (typeof pattern === 'string') {
          patternText.innerHTML = `<strong>URL:</strong> ${pattern}`;
        } else {
          // Exibir URL e método
          patternText.innerHTML = `<strong>URL:</strong> ${pattern.url}<br>
                                  <strong>Método:</strong> ${pattern.method || 'ANY'}`;

          // Exibir informações de header, se existirem
          if (pattern.headerName && pattern.headerValue) {
            patternText.innerHTML += `<br><strong>Header (${pattern.headerType || 'request'}):</strong>
                                    ${pattern.headerName}: ${pattern.headerValue}`;
          }
        }

        li.appendChild(patternText);

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remover';
        removeButton.className = 'remove-url';
        removeButton.addEventListener('click', function() {
          removeUrlPattern(index);
        });
        li.appendChild(removeButton);

        urlList.appendChild(li);
      });
    });
  }

  // Remove URL pattern from the list by index
  function removeUrlPattern(index: number): void {
    chrome.storage.local.get(['urlPatterns'], function(result) {
      let patterns = result.urlPatterns || [];

      // Remove o padrão pelo índice
      if (index >= 0 && index < patterns.length) {
        patterns.splice(index, 1);
      }

      // Salvar os padrões atualizados
      chrome.storage.local.set({ urlPatterns: patterns }, function() {
        // Atualizar a lista
        loadUrlPatterns();
      });
    });
  }

  // Start debugging
  function startDebugging(): void {
    chrome.runtime.sendMessage({ action: 'startDebugging' }, function(response) {
      if (response && response.success) {
        statusElement.textContent = 'Debugging active';
        statusElement.style.color = '#0f9d58';
      } else {
        statusElement.textContent = 'Failed to start debugging';
        statusElement.style.color = '#db4437';
      }
    });
  }

  // Stop debugging
  function stopDebugging(): void {
    chrome.runtime.sendMessage({ action: 'stopDebugging' }, function(response) {
      if (response && response.success) {
        statusElement.textContent = 'Not debugging';
        statusElement.style.color = '';

        // Clear pending responses
        pendingResponses = {};
        updatePendingResponsesList();
        hideResponseDetails();
      } else {
        statusElement.textContent = 'Failed to stop debugging';
        statusElement.style.color = '#db4437';
      }
    });
  }

  // Check current debugging status
  function checkDebuggingStatus(): void {
    chrome.runtime.sendMessage({ action: 'getDebuggingStatus' }, function(response) {
      if (response && response.isDebugging) {
        statusElement.textContent = 'Debugging active';
        statusElement.style.color = '#0f9d58';
      } else {
        statusElement.textContent = 'Not debugging';
        statusElement.style.color = '';
      }
    });
  }

  // Load pending responses
  function loadPendingResponses(): void {
    chrome.runtime.sendMessage({ action: 'getPendingResponses' }, function(response) {
      if (response && response.pendingResponses) {
        pendingResponses = response.pendingResponses;
        updatePendingResponsesList();
      }
    });
  }

  // Update the pending responses list in the UI
  function updatePendingResponsesList(): void {
    // Clear current list
    pendingResponsesList.innerHTML = '';

    // Get response IDs and sort by timestamp (newest first)
    const responseIds = Object.keys(pendingResponses);

    if (responseIds.length === 0) {
      const noResponses = document.createElement('p');
      noResponses.className = 'no-responses';
      noResponses.textContent = 'No pending responses';
      pendingResponsesList.appendChild(noResponses);
      return;
    }

    responseIds.sort((a, b) => {
      return pendingResponses[b].timestamp - pendingResponses[a].timestamp;
    });

    // Add each response to the list
    responseIds.forEach(requestId => {
      const response = pendingResponses[requestId];

      const responseItem = document.createElement('div');
      responseItem.className = 'response-item';
      responseItem.setAttribute('data-request-id', requestId);

      const urlElement = document.createElement('div');
      urlElement.className = 'url';
      urlElement.textContent = response.url;
      responseItem.appendChild(urlElement);

      const detailsElement = document.createElement('div');
      detailsElement.className = 'details';
      detailsElement.textContent = `${response.status} ${response.statusText} | ${response.type} | ${response.mimeType}`;
      responseItem.appendChild(detailsElement);

      // Add click event to view response details
      responseItem.addEventListener('click', () => {
        viewResponseDetails(requestId);
      });

      pendingResponsesList.appendChild(responseItem);
    });
  }

  // View response details
  function viewResponseDetails(requestId: string): void {
    currentRequestId = requestId;
    const response = pendingResponses[requestId];

    if (!response) {
      alert('Response not found');
      return;
    }

    // Get full response details from background script
    chrome.runtime.sendMessage({
      action: 'getResponseDetails',
      requestId
    }, function(result) {
      if (result && result.success) {
        const fullResponse = result.response;

        // Update UI
        responseUrl.textContent = fullResponse.url;
        responseType.textContent = fullResponse.type;
        responseMimeType.textContent = fullResponse.mimeType;
        responseStatus.value = fullResponse.status.toString();

        // Format headers as key: value pairs
        let headersText = '';
        for (const [key, value] of Object.entries(fullResponse.headers)) {
          headersText += `${key}: ${value}\n`;
        }
        responseHeaders.value = headersText;

        // Set body if available
        responseBody.value = fullResponse.body || 'Loading body...';

        // Show response details
        responseDetails.classList.remove('hidden');
      } else {
        alert('Failed to get response details');
      }
    });
  }

  // Hide response details
  function hideResponseDetails(): void {
    responseDetails.classList.add('hidden');
    currentRequestId = null;
  }

  // Approve response with modifications
  function approveResponse(): void {
    if (!currentRequestId) {
      alert('No response selected');
      return;
    }

    // Prepare modifications
    const modifications: ResponseModifications = {
      status: parseInt(responseStatus.value, 10),
      headers: parseHeaders(responseHeaders.value),
      body: responseBody.value
    };

    // Send to background script
    chrome.runtime.sendMessage({
      action: 'approveResponse',
      requestId: currentRequestId,
      modifications
    }, function(response) {
      if (response && response.success) {
        // Remove from pending responses
        delete pendingResponses[currentRequestId!];

        // Update UI
        updatePendingResponsesList();
        hideResponseDetails();
      } else {
        alert('Failed to approve response: ' + (response ? response.error : 'Unknown error'));
      }
    });
  }
});
