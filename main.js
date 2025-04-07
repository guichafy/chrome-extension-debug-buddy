document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - Navegação
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM elements - Status
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status');
  const requestCountBadge = document.getElementById('requestCount');

  // DOM elements - Settings tab
  const urlPatternInput = document.getElementById('urlPattern');
  const httpMethodSelect = document.getElementById('httpMethod');
  const requestHeaderNameInput = document.getElementById('requestHeaderName');
  const requestHeaderValueInput = document.getElementById('requestHeaderValue');
  const headerTypeSelect = document.getElementById('headerType');
  const addUrlButton = document.getElementById('addUrl');
  const urlList = document.getElementById('urlList');
  const selectTargetTabButton = document.getElementById('selectTargetTab');
  const startDebuggingButton = document.getElementById('startDebugging');
  const stopDebuggingButton = document.getElementById('stopDebugging');

  // Variável de controle para a aba alvo
  let targetTabId = null;

  // DOM elements - Responses tab
  const pendingResponsesList = document.getElementById('pendingResponsesList');
  const responseDetails = document.getElementById('responseDetails');
  const responseUrl = document.getElementById('responseUrl');
  const responseType = document.getElementById('responseType');
  const responseMimeType = document.getElementById('responseMimeType');
  const responseStatus = document.getElementById('responseStatus');
  const responseHeaders = document.getElementById('responseHeaders');
  const responseBody = document.getElementById('responseBody');
  const approveResponseButton = document.getElementById('approveResponse');
  const ignoreResponseButton = document.getElementById('ignoreResponse');
  const mockResponseButton = document.getElementById('mockResponse');
  const editResponseButton = document.getElementById('editResponse');
  const cancelEditButton = document.getElementById('cancelEdit');

  // DOM elements - Mocks tab
  const mockList = document.getElementById('mockList');
  const addMockButton = document.getElementById('addMock');
  const mockDetails = document.getElementById('mockDetails');
  const mockUrlPatternInput = document.getElementById('mockUrlPattern');
  const mockMethodSelect = document.getElementById('mockMethod');
  const mockStatusInput = document.getElementById('mockStatus');
  const mockHeadersTextarea = document.getElementById('mockHeaders');
  const mockBodyTextarea = document.getElementById('mockBody');
  const mockHeadersEditor = document.getElementById('mockHeadersEditor');
  const mockBodyEditor = document.getElementById('mockBodyEditor');
  const formatHeadersBtn = document.getElementById('formatHeadersBtn');
  const formatBodyBtn = document.getElementById('formatBodyBtn');
  const detectBodyTypeBtn = document.getElementById('detectBodyTypeBtn');
  const bodyContentTypeSelect = document.getElementById('bodyContentType');
  const saveMockButton = document.getElementById('saveMock');
  const cancelMockButton = document.getElementById('cancelMock');

  // CodeMirror instances
  let headersEditor = null;
  let bodyEditor = null;

  // Current state
  let currentRequestId = null;
  let pendingResponses = {};
  let currentResponseDetails = null;
  let isEditingResponse = false;
  let mocks = [];
  let currentEditingMockIndex = -1;

  // Inicialização
  initializeApp();

  function initializeApp() {
    // Garantir que a página use UTF-8
    document.characterSet = "UTF-8";

    // Carregar dados salvos
    loadUrlPatterns();
    loadMocks();
    checkDebuggingStatus();

    // Configurar event listeners
    setupEventListeners();

    // Atualizar a cada 2 segundos para garantir sincronização entre abas
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkDebuggingStatus();
        loadPendingResponses();
      }
    }, 2000);
  }

  function setupEventListeners() {
    // Navegação
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabName = item.getAttribute('data-tab');
        switchTab(tabName);

        // Se mudar para a aba de respostas, atualizar a lista
        if (tabName === 'responses') {
          loadPendingResponses();
        }
      });
    });

    // Settings tab
    addUrlButton.addEventListener('click', addUrlPattern);
    selectTargetTabButton.addEventListener('click', selectTargetTab);
    startDebuggingButton.addEventListener('click', startDebugging);
    stopDebuggingButton.addEventListener('click', stopDebugging);

    // Responses tab
    approveResponseButton.addEventListener('click', approveResponse);
    cancelEditButton.addEventListener('click', hideResponseDetails);
    ignoreResponseButton.addEventListener('click', ignoreResponse);
    mockResponseButton.addEventListener('click', createMockFromResponse);
    editResponseButton.addEventListener('click', toggleResponseEditing);

    // Mocks tab
    addMockButton.addEventListener('click', () => showMockDetails());
    saveMockButton.addEventListener('click', saveMock);
    cancelMockButton.addEventListener('click', hideMockDetails);

    // Formatação e detecção de tipo de conteúdo
    if (formatHeadersBtn) formatHeadersBtn.addEventListener('click', formatHeaders);
    if (formatBodyBtn) formatBodyBtn.addEventListener('click', formatBody);
    if (detectBodyTypeBtn) detectBodyTypeBtn.addEventListener('click', detectAndSetBodyType);
    if (bodyContentTypeSelect) bodyContentTypeSelect.addEventListener('change', updateBodyEditorMode);

    // Ouvir mensagens do background script
    listenForBackgroundMessages();
  }

  function listenForBackgroundMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'newPendingResponse') {
        // Adicionar à lista de respostas pendentes
        pendingResponses[message.requestId] = {
          url: message.url,
          status: message.status,
          statusText: message.statusText,
          type: message.type,
          mimeType: message.mimeType,
          body: null,
          headers: null,
          timestamp: Date.now()
        };

        // Atualizar contador
        updateRequestCount();

        // Atualizar UI se estiver na aba de respostas
        if (document.getElementById('responses').classList.contains('active')) {
          updatePendingResponsesList();
        }
      }
    });
  }

  function updateRequestCount() {
    const count = Object.keys(pendingResponses).length;
    requestCountBadge.textContent = count;

    // Destacar o badge se houver requisições pendentes
    if (count > 0) {
      requestCountBadge.style.display = 'inline-block';
    } else {
      requestCountBadge.style.display = 'none';
    }
  }

  // Navegação entre abas
  function switchTab(tabName) {
    // Atualizar botões de navegação
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Atualizar conteúdo das abas
    tabContents.forEach(content => {
      if (content.id === tabName) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  // Configurações de URL
  function addUrlPattern() {
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
    };

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
      const exists = patterns.some(pattern => {
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

  function loadUrlPatterns() {
    chrome.storage.local.get(['urlPatterns'], function(result) {
      const patterns = result.urlPatterns || [];

      // Clear current list
      urlList.innerHTML = '';

      // Add each pattern to the list
      patterns.forEach(function(pattern, index) {
        const li = document.createElement('li');

        const patternText = document.createElement('div');
        patternText.className = 'pattern-info';

        // Verificar se é um objeto de configuração ou uma string
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
        removeButton.innerHTML = '<span class="material-icons">delete</span>';
        removeButton.className = 'remove-url';
        removeButton.addEventListener('click', function() {
          removeUrlPattern(index);
        });
        li.appendChild(removeButton);

        urlList.appendChild(li);
      });
    });
  }

  function removeUrlPattern(index) {
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

  // Funções de Debugging
  function selectTargetTab() {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      // Criar uma lista de abas para seleção
      const tabOptions = tabs.map(tab => ({
        title: tab.title && tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title || 'Sem título',
        url: tab.url,
        id: tab.id
      }));

      // Excluir a aba atual (interceptor)
      const filteredOptions = tabOptions.filter(tab => !tab.url.includes('main.html'));

      if (filteredOptions.length === 0) {
        alert('Nenhuma aba disponível para interceptação. Abra alguma página em outra aba primeiro.');
        return;
      }

      // Criar modal para seleção de aba
      const modal = document.createElement('div');
      modal.className = 'modal';

      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';

      const modalHeader = document.createElement('h2');
      modalHeader.textContent = 'Selecione a aba para interceptar';
      modalContent.appendChild(modalHeader);

      const tabsList = document.createElement('div');
      tabsList.className = 'tabs-list';

      filteredOptions.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.innerHTML = `
          <div class="tab-title">${tab.title}</div>
          <div class="tab-url">${tab.url}</div>
        `;

        tabItem.addEventListener('click', () => {
          // Armazenar o ID da aba selecionada
          targetTabId = tab.id;

          // Atualizar o texto do botão com o título da aba
          selectTargetTabButton.innerHTML = `
            <span class="material-icons">tab</span>
            ${tab.title.substring(0, 15)}...
          `;

          // Fechar o modal
          document.body.removeChild(modal);

          // Atualizar visualmente
          selectTargetTabButton.classList.add('selected');
        });

        tabsList.appendChild(tabItem);
      });

      modalContent.appendChild(tabsList);

      const closeButton = document.createElement('button');
      closeButton.className = 'secondary-button';
      closeButton.innerHTML = '<span class="material-icons">close</span> Cancelar';
      closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
      });

      modalContent.appendChild(closeButton);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
    });
  }

  function startDebugging() {
    if (!targetTabId) {
      alert('Por favor, selecione uma aba para interceptar primeiro');
      selectTargetTab();
      return;
    }

    chrome.runtime.sendMessage({
      action: 'startDebugging',
      tabId: targetTabId
    }, function(response) {
      if (response && response.success) {
        updateStatusIndicator(true, 'Interceptação ativa');
      } else {
        updateStatusIndicator(false, 'Falha ao iniciar interceptação');
        alert(`Erro ao iniciar: ${response ? response.error : 'Erro desconhecido'}`);
      }
    });
  }

  function stopDebugging() {
    chrome.runtime.sendMessage({ action: 'stopDebugging' }, function(response) {
      if (response && response.success) {
        updateStatusIndicator(false, 'Inativo');

        // Limpar respostas pendentes
        pendingResponses = {};
        updatePendingResponsesList();
        hideResponseDetails();
        updateRequestCount();
      } else {
        alert(`Erro ao parar: ${response ? response.error : 'Erro desconhecido'}`);
      }
    });
  }

  function checkDebuggingStatus() {
    chrome.runtime.sendMessage({ action: 'getDebuggingStatus' }, function(response) {
      if (response && response.isDebugging) {
        updateStatusIndicator(true, 'Interceptação ativa');
      } else {
        updateStatusIndicator(false, 'Inativo');
      }
    });
  }

  function updateStatusIndicator(isActive, statusMessage) {
    if (isActive) {
      statusDot.classList.add('active');
      statusText.textContent = statusMessage;
      statusText.style.color = 'var(--success-color)';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = statusMessage;
      statusText.style.color = '';
    }
  }

  // Funções para gerenciamento de respostas
  function loadPendingResponses() {
    chrome.runtime.sendMessage({ action: 'getPendingResponses' }, function(response) {
      if (response && response.pendingResponses) {
        pendingResponses = response.pendingResponses;
        updatePendingResponsesList();
        updateRequestCount();
      }
    });
  }

  function updatePendingResponsesList() {
    // Limpar lista atual
    pendingResponsesList.innerHTML = '';

    // Obter IDs das respostas e ordenar por timestamp (mais recentes primeiro)
    const responseIds = Object.keys(pendingResponses);

    if (responseIds.length === 0) {
      const noResponses = document.createElement('p');
      noResponses.className = 'no-responses';
      noResponses.textContent = 'Nenhuma requisição interceptada';
      pendingResponsesList.appendChild(noResponses);
      return;
    }

    responseIds.sort((a, b) => {
      return pendingResponses[b].timestamp - pendingResponses[a].timestamp;
    });

    // Adicionar cada resposta à lista
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

      // Adicionar evento de clique para ver detalhes da resposta
      responseItem.addEventListener('click', () => {
        viewResponseDetails(requestId);
      });

      pendingResponsesList.appendChild(responseItem);
    });
  }

  function viewResponseDetails(requestId) {
    currentRequestId = requestId;
    isEditingResponse = false;

    // Obter detalhes completos da resposta do background script
    chrome.runtime.sendMessage({
      action: 'getResponseDetails',
      requestId
    }, function(result) {
      if (result && result.success) {
        currentResponseDetails = result.response;

        // Atualizar UI
        responseUrl.textContent = currentResponseDetails.url;
        responseType.textContent = currentResponseDetails.type;
        responseMimeType.textContent = currentResponseDetails.mimeType;
        responseStatus.value = currentResponseDetails.status;

        // Formatar headers como pares chave: valor
        let headersText = '';
        for (const [key, value] of Object.entries(currentResponseDetails.headers)) {
          headersText += `${key}: ${value}\n`;
        }
        responseHeaders.value = headersText;

        // Definir body se disponível
        responseBody.value = currentResponseDetails.body || 'Carregando corpo da resposta...';

        // Exibir detalhes da resposta
        responseDetails.classList.remove('hidden');

        // Esconder os controles de edição inicialmente
        toggleResponseEditing(false);
      } else {
        alert('Falha ao obter detalhes da resposta');
      }
    });
  }

  function hideResponseDetails() {
    responseDetails.classList.add('hidden');
    currentRequestId = null;
    currentResponseDetails = null;
  }

  function toggleResponseEditing(shouldEdit) {
    if (typeof shouldEdit !== 'boolean') {
      shouldEdit = !isEditingResponse;
    }

    isEditingResponse = shouldEdit;

    // Elementos que devem ser editáveis
    responseStatus.disabled = !shouldEdit;
    responseHeaders.disabled = !shouldEdit;
    responseBody.disabled = !shouldEdit;

    // Mostrar/esconder botões relevantes
    if (shouldEdit) {
      approveResponseButton.style.display = 'flex';
      cancelEditButton.style.display = 'flex';
      ignoreResponseButton.style.display = 'none';
      mockResponseButton.style.display = 'none';
      editResponseButton.style.display = 'none';
    } else {
      approveResponseButton.style.display = 'none';
      cancelEditButton.style.display = 'none';
      ignoreResponseButton.style.display = 'flex';
      mockResponseButton.style.display = 'flex';
      editResponseButton.style.display = 'flex';
    }
  }

  function approveResponse() {
    if (!currentRequestId) {
      alert('Nenhuma resposta selecionada');
      return;
    }

    // Preparar modificações
    const modifications = {
      status: parseInt(responseStatus.value, 10),
      headers: parseHeaders(responseHeaders.value),
      body: responseBody.value
    };

    // Enviar para o background script
    chrome.runtime.sendMessage({
      action: 'approveResponse',
      requestId: currentRequestId,
      modifications
    }, function(response) {
      if (response && response.success) {
        // Remover da lista de respostas pendentes
        delete pendingResponses[currentRequestId];

        // Atualizar UI
        updatePendingResponsesList();
        hideResponseDetails();
        updateRequestCount();
      } else {
        alert('Falha ao aplicar modificações: ' + (response ? response.error : 'Erro desconhecido'));
      }
    });
  }

  function ignoreResponse() {
    if (!currentRequestId) {
      alert('Nenhuma resposta selecionada');
      return;
    }

    // Continuar a requisição sem modificações
    chrome.runtime.sendMessage({
      action: 'approveResponse',
      requestId: currentRequestId
    }, function(response) {
      if (response && response.success) {
        // Remover da lista de respostas pendentes
        delete pendingResponses[currentRequestId];

        // Atualizar UI
        updatePendingResponsesList();
        hideResponseDetails();
        updateRequestCount();
      } else {
        alert('Falha ao ignorar resposta: ' + (response ? response.error : 'Erro desconhecido'));
      }
    });
  }

  // Funções para Mocks
  function loadMocks() {
    chrome.storage.local.get(['mocks'], function(result) {
      mocks = result.mocks || [];
      updateMocksList();
    });
  }

  function updateMocksList() {
    // Limpar lista atual
    mockList.innerHTML = '';

    if (mocks.length === 0) {
      const noMocks = document.createElement('p');
      noMocks.className = 'no-mocks';
      noMocks.textContent = 'Nenhum mock configurado';
      mockList.appendChild(noMocks);
      return;
    }

    // Adicionar cada mock à lista
    mocks.forEach((mock, index) => {
      // Garantir que todos os mocks tenham a propriedade enabled
      if (mock.enabled === undefined) {
        mock.enabled = true;
      }

      const mockItem = document.createElement('div');
      mockItem.className = 'mock-item';

      // Adicionar classe para mocks desabilitados
      if (!mock.enabled) {
        mockItem.classList.add('mock-disabled');
      }

      const urlElement = document.createElement('div');
      urlElement.className = 'url';
      urlElement.textContent = mock.urlPattern;
      mockItem.appendChild(urlElement);

      const detailsElement = document.createElement('div');
      detailsElement.className = 'details';
      detailsElement.innerHTML = `${mock.method} | Status: ${mock.status} <span class="status-badge ${mock.enabled ? 'enabled' : 'disabled'}">${mock.enabled ? 'Ativo' : 'Inativo'}</span>`;
      mockItem.appendChild(detailsElement);

      // Ações
      const actionsElement = document.createElement('div');
      actionsElement.className = 'response-actions';

      // Botão de toggle para habilitar/desabilitar
      const toggleButton = document.createElement('button');
      toggleButton.className = `toggle-button ${mock.enabled ? 'enabled' : 'disabled'}`;
      toggleButton.innerHTML = `<span class="material-icons">${mock.enabled ? 'toggle_on' : 'toggle_off'}</span>`;
      toggleButton.title = mock.enabled ? 'Desabilitar' : 'Habilitar';
      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMockStatus(index);
      });
      actionsElement.appendChild(toggleButton);

      const editButton = document.createElement('button');
      editButton.className = 'secondary-button';
      editButton.innerHTML = '<span class="material-icons">edit</span>';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        editMock(index);
      });
      actionsElement.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'danger-button';
      deleteButton.innerHTML = '<span class="material-icons">delete</span>';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMock(index);
      });
      actionsElement.appendChild(deleteButton);

      mockItem.appendChild(actionsElement);

      mockList.appendChild(mockItem);
    });
  }

  function showMockDetails(mockData = null) {
    if (mockData) {
      // Edição de mock existente
      mockUrlPatternInput.value = mockData.urlPattern;
      mockMethodSelect.value = mockData.method;
      mockStatusInput.value = mockData.status;
      mockHeadersTextarea.value = JSON.stringify(mockData.headers, null, 2);
      mockBodyTextarea.value = mockData.body;

      // Armazenar o status de habilitado/desabilitado
      mockData.enabled = mockData.enabled !== undefined ? mockData.enabled : true;
    } else {
      // Novo mock
      mockUrlPatternInput.value = '';
      mockMethodSelect.value = 'ANY';
      mockStatusInput.value = '200';
      mockHeadersTextarea.value = '{\n  "Content-Type": "application/json"\n}';
      mockBodyTextarea.value = '{\n  "success": true,\n  "data": {}\n}';
      currentEditingMockIndex = -1;
    }

    mockDetails.classList.remove('hidden');

    // Inicializar os editores CodeMirror após um pequeno delay para garantir que os elementos estejam visíveis
    setTimeout(() => {
      initializeCodeEditors();
    }, 100);
  }

  function hideMockDetails() {
    // Destruir os editores CodeMirror antes de esconder o painel
    if (headersEditor) {
      headersEditor.toTextArea();
      headersEditor = null;
    }

    if (bodyEditor) {
      bodyEditor.toTextArea();
      bodyEditor = null;
    }

    mockDetails.classList.add('hidden');
    currentEditingMockIndex = -1;
  }

  // Inicialização dos editores CodeMirror
  function initializeCodeEditors() {
    // Inicializar o editor de headers (sempre JSON)
    if (!headersEditor) {
      headersEditor = CodeMirror.fromTextArea(mockHeadersTextarea, {
        mode: { name: 'javascript', json: true },
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        lint: true,
        indentUnit: 2,
        tabSize: 2,
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Ctrl-Q': function(cm) { cm.foldCode(cm.getCursor()); }
        }
      });
    }

    // Inicializar o editor de body (detectar tipo automaticamente)
    if (!bodyEditor) {
      const bodyContent = mockBodyTextarea.value;
      let mode = detectContentType(bodyContent);
      bodyContentTypeSelect.value = mode;

      bodyEditor = CodeMirror.fromTextArea(mockBodyTextarea, {
        mode: getCodeMirrorMode(mode),
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        indentUnit: 2,
        tabSize: 2,
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Ctrl-Q': function(cm) { cm.foldCode(cm.getCursor()); }
        }
      });
    }

    // Configurar event listeners para os botões de formatação
    formatHeadersBtn.addEventListener('click', formatHeaders);
    formatBodyBtn.addEventListener('click', formatBody);
    detectBodyTypeBtn.addEventListener('click', detectAndSetBodyType);
    bodyContentTypeSelect.addEventListener('change', updateBodyEditorMode);
  }

  // Função para detectar o tipo de conteúdo
  function detectContentType(content) {
    content = content.trim();

    // Tentar detectar JSON
    if ((content.startsWith('{') && content.endsWith('}')) ||
        (content.startsWith('[') && content.endsWith(']'))) {
      try {
        JSON.parse(content);
        return 'json';
      } catch (e) {
        // Não é JSON válido
      }
    }

    // Tentar detectar HTML
    if ((content.startsWith('<') && content.endsWith('>')) ||
        content.includes('<!DOCTYPE html>') ||
        content.includes('<html') ||
        content.includes('<body') ||
        content.includes('<div')) {
      return 'html';
    }

    // Padrão para texto
    return 'text';
  }

  // Obter o modo correto para o CodeMirror
  function getCodeMirrorMode(type) {
    switch (type) {
      case 'json':
        return { name: 'javascript', json: true };
      case 'html':
        return 'htmlmixed';
      default:
        return 'text';
    }
  }

  // Formatar headers (sempre JSON)
  function formatHeaders() {
    try {
      const content = headersEditor.getValue();
      const jsonObj = JSON.parse(content);
      const formatted = JSON.stringify(jsonObj, null, 2);
      headersEditor.setValue(formatted);
    } catch (e) {
      alert('Não foi possível formatar o JSON. Verifique se é um JSON válido.');
    }
  }

  // Formatar body de acordo com o tipo selecionado
  function formatBody() {
    const content = bodyEditor.getValue();
    const type = bodyContentTypeSelect.value;

    if (type === 'json') {
      try {
        const jsonObj = JSON.parse(content);
        const formatted = JSON.stringify(jsonObj, null, 2);
        bodyEditor.setValue(formatted);
      } catch (e) {
        alert('Não foi possível formatar o JSON. Verifique se é um JSON válido.');
      }
    } else if (type === 'html') {
      try {
        // Usar prettier para formatar HTML
        const formatted = prettier.format(content, {
          parser: 'html',
          printWidth: 80,
          tabWidth: 2,
          useTabs: false
        });
        bodyEditor.setValue(formatted);
      } catch (e) {
        alert('Não foi possível formatar o HTML. Verifique se é um HTML válido.');
      }
    }
    // Para texto simples, não fazemos formatação
  }

  // Detectar e definir o tipo de conteúdo do body
  function detectAndSetBodyType() {
    const content = bodyEditor.getValue();
    const detectedType = detectContentType(content);

    bodyContentTypeSelect.value = detectedType;
    updateBodyEditorMode();
  }

  // Atualizar o modo do editor de acordo com o tipo selecionado
  function updateBodyEditorMode() {
    const type = bodyContentTypeSelect.value;
    bodyEditor.setOption('mode', getCodeMirrorMode(type));
  }

  function saveMock() {
    const urlPattern = mockUrlPatternInput.value.trim();
    const method = mockMethodSelect.value;
    const status = parseInt(mockStatusInput.value, 10);

    if (!urlPattern) {
      alert('Por favor, insira um padrão de URL');
      return;
    }

    // Obter o conteúdo dos editores CodeMirror
    headersEditor.save(); // Salva o conteúdo no textarea original
    bodyEditor.save();

    let headers;
    try {
      headers = JSON.parse(mockHeadersTextarea.value);
    } catch (e) {
      alert('Headers inválidos. Certifique-se de que é um JSON válido.');
      return;
    }

    const body = mockBodyTextarea.value;

    const mockData = {
      urlPattern,
      method,
      status,
      headers,
      body,
      createdAt: Date.now(),
      enabled: true // Por padrão, novos mocks são habilitados
    };

    // Obter mocks existentes
    chrome.storage.local.get(['mocks'], function(result) {
      let mocksList = result.mocks || [];

      if (currentEditingMockIndex >= 0 && currentEditingMockIndex < mocksList.length) {
        // Atualizar mock existente
        mocksList[currentEditingMockIndex] = mockData;
      } else {
        // Adicionar novo mock
        mocksList.push(mockData);
      }

      // Salvar mocks atualizados
      chrome.storage.local.set({ mocks: mocksList }, function() {
        mocks = mocksList;
        updateMocksList();
        hideMockDetails();
      });
    });
  }

  function editMock(index) {
    if (index >= 0 && index < mocks.length) {
      currentEditingMockIndex = index;
      showMockDetails(mocks[index]);
    }
  }

  function deleteMock(index) {
    if (index >= 0 && index < mocks.length) {
      if (confirm('Tem certeza que deseja remover este mock?')) {
        mocks.splice(index, 1);
        chrome.storage.local.set({ mocks: mocks }, function() {
          updateMocksList();
        });
      }
    }
  }

  function toggleMockStatus(index) {
    if (index >= 0 && index < mocks.length) {
      // Inverter o status de habilitado/desabilitado
      mocks[index].enabled = !mocks[index].enabled;

      // Salvar as alterações
      chrome.storage.local.set({ mocks: mocks }, function() {
        // Atualizar a interface
        updateMocksList();
      });
    }
  }

  function createMockFromResponse() {
    if (!currentResponseDetails) {
      alert('Nenhuma resposta selecionada');
      return;
    }

    // Extrair o URL base da requisição para o mock
    const url = currentResponseDetails.url;
    const urlObj = new URL(url);
    const urlPattern = urlObj.hostname + urlObj.pathname;

    // Determinar o método (precisamos adivinhar com base no tipo ou URL)
    let method = 'GET';

    // Criar mock a partir da resposta atual
    const mockData = {
      urlPattern,
      method,
      status: currentResponseDetails.status,
      headers: currentResponseDetails.headers,
      body: currentResponseDetails.body,
      createdAt: Date.now(),
      enabled: true // Por padrão, novos mocks são habilitados
    };

    // Mudar para a aba de mocks
    switchTab('mockConfig');

    // Exibir o formulário com os dados pré-preenchidos
    currentEditingMockIndex = -1; // É um novo mock
    showMockDetails(mockData);
  }

  // Funções utilitárias
  function parseHeaders(headersText) {
    const headers = {};
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
});
