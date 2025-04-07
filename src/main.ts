// Import classes from modules
import { UrlPatternManager } from './modules/urlPatterns';
import { ResponseManager } from './modules/responses';
import { MockManager } from './modules/mocks';
import { DebuggingManager } from './modules/debugging';

// Import hot reload utility for development mode
if (process.env.NODE_ENV !== 'production') {
  console.log('Running in development mode with hot reload support');
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - Navegação
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM elements - Status
  const statusDot = document.querySelector('.status-dot') as HTMLElement;
  const statusText = document.getElementById('status') as HTMLElement;
  const requestCountBadge = document.getElementById('requestCount') as HTMLElement;

  // DOM elements - Settings tab
  const urlPatternInput = document.getElementById('urlPattern') as HTMLInputElement;
  const httpMethodSelect = document.getElementById('httpMethod') as HTMLSelectElement;
  const requestHeaderNameInput = document.getElementById('requestHeaderName') as HTMLInputElement;
  const requestHeaderValueInput = document.getElementById('requestHeaderValue') as HTMLInputElement;
  const headerTypeSelect = document.getElementById('headerType') as HTMLSelectElement;
  const addUrlButton = document.getElementById('addUrl') as HTMLElement;
  const urlList = document.getElementById('urlList') as HTMLElement;
  const selectTargetTabButton = document.getElementById('selectTargetTab') as HTMLElement;
  const startDebuggingButton = document.getElementById('startDebugging') as HTMLElement;
  const stopDebuggingButton = document.getElementById('stopDebugging') as HTMLElement;

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
  const ignoreResponseButton = document.getElementById('ignoreResponse') as HTMLElement;
  const mockResponseButton = document.getElementById('mockResponse') as HTMLElement;
  const editResponseButton = document.getElementById('editResponse') as HTMLElement;
  const cancelEditButton = document.getElementById('cancelEdit') as HTMLElement;

  // DOM elements - Mocks tab
  const mockList = document.getElementById('mockList') as HTMLElement;
  const addMockButton = document.getElementById('addMock') as HTMLElement;
  const mockDetails = document.getElementById('mockDetails') as HTMLElement;
  const mockUrlPatternInput = document.getElementById('mockUrlPattern') as HTMLInputElement;
  const mockMethodSelect = document.getElementById('mockMethod') as HTMLSelectElement;
  const mockStatusInput = document.getElementById('mockStatus') as HTMLInputElement;
  const mockHeadersTextarea = document.getElementById('mockHeaders') as HTMLTextAreaElement;
  const mockBodyTextarea = document.getElementById('mockBody') as HTMLTextAreaElement;
  const formatHeadersBtn = document.getElementById('formatHeadersBtn') as HTMLElement;
  const formatBodyBtn = document.getElementById('formatBodyBtn') as HTMLElement;
  const detectBodyTypeBtn = document.getElementById('detectBodyTypeBtn') as HTMLElement;
  const bodyContentTypeSelect = document.getElementById('bodyContentType') as HTMLSelectElement;
  const saveMockButton = document.getElementById('saveMock') as HTMLElement;
  const cancelMockButton = document.getElementById('cancelMock') as HTMLElement;

  // Inicializar gerenciadores
  const urlPatternManager = new UrlPatternManager(urlList);
  const responseManager = new ResponseManager(
    pendingResponsesList,
    responseDetails,
    responseUrl,
    responseType,
    responseMimeType,
    responseStatus,
    responseHeaders,
    responseBody,
    approveResponseButton,
    cancelEditButton,
    ignoreResponseButton,
    mockResponseButton,
    editResponseButton
  );
  const mockManager = new MockManager(
    mockList,
    mockDetails,
    mockUrlPatternInput,
    mockMethodSelect,
    mockStatusInput,
    mockHeadersTextarea,
    mockBodyTextarea,
    formatHeadersBtn,
    formatBodyBtn,
    detectBodyTypeBtn,
    bodyContentTypeSelect
  );
  const debuggingManager = new DebuggingManager(
    statusDot,
    statusText,
    selectTargetTabButton,
    startDebuggingButton,
    stopDebuggingButton
  );

  // Inicialização
  initializeApp();

  function initializeApp() {
    // Garantir que a página use UTF-8
    // document.characterSet é somente leitura

    // Carregar dados salvos
    urlPatternManager.loadUrlPatterns();
    mockManager.loadMocks();
    debuggingManager.checkDebuggingStatus();

    // Configurar event listeners
    setupEventListeners();

    // Atualizar a cada 2 segundos para garantir sincronização entre abas
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        debuggingManager.checkDebuggingStatus();
        responseManager.loadPendingResponses();
        updateRequestCount();
      }
    }, 2000);
  }

  function setupEventListeners() {
    // Navegação
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabName = item.getAttribute('data-tab');
        if (tabName) {
          switchTab(tabName);

          // Se mudar para a aba de respostas, atualizar a lista
          if (tabName === 'responses') {
            responseManager.loadPendingResponses();
          }
        }
      });
    });

    // Settings tab
    addUrlButton.addEventListener('click', () => {
      urlPatternManager.addUrlPattern(
        urlPatternInput.value.trim(),
        httpMethodSelect.value,
        requestHeaderNameInput.value.trim(),
        requestHeaderValueInput.value.trim(),
        headerTypeSelect.value
      ).then(() => {
        // Limpar os campos
        urlPatternInput.value = '';
        httpMethodSelect.value = 'ANY';
        requestHeaderNameInput.value = '';
        requestHeaderValueInput.value = '';
        headerTypeSelect.value = 'request';
      });
    });

    // Mocks tab
    addMockButton.addEventListener('click', () => mockManager.showMockDetails());
    saveMockButton.addEventListener('click', () => mockManager.saveMock());
    cancelMockButton.addEventListener('click', () => mockManager.hideMockDetails());

    // Mock from response
    mockResponseButton.addEventListener('click', () => {
      const currentResponse = responseManager.getCurrentResponse();
      if (currentResponse) {
        // Mudar para a aba de mocks
        switchTab('mockConfig');
        // Criar mock a partir da resposta
        mockManager.createMockFromResponse(currentResponse);
      }
    });

    // Ouvir mensagens do background script
    listenForBackgroundMessages();
  }

  function listenForBackgroundMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.action === 'newPendingResponse') {
        // Atualizar contador
        updateRequestCount();

        // Atualizar UI se estiver na aba de respostas
        if (document.getElementById('responses')?.classList.contains('active')) {
          responseManager.loadPendingResponses();
        }
      } else if (message.action === 'hot_reload') {
        console.log('Hot reload message received, reloading page...');
        window.location.reload();
      }
    });
  }

  function updateRequestCount() {
    const count = responseManager.getPendingResponsesCount();
    requestCountBadge.textContent = count.toString();

    // Destacar o badge se houver requisições pendentes
    if (count > 0) {
      requestCountBadge.style.display = 'inline-block';
    } else {
      requestCountBadge.style.display = 'none';
    }
  }

  // Navegação entre abas
  function switchTab(tabName: string) {
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
});
