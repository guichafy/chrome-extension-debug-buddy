// As classes serão definidas nos arquivos de módulos
document.addEventListener('DOMContentLoaded', function () {
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
    const formatHeadersBtn = document.getElementById('formatHeadersBtn');
    const formatBodyBtn = document.getElementById('formatBodyBtn');
    const detectBodyTypeBtn = document.getElementById('detectBodyTypeBtn');
    const bodyContentTypeSelect = document.getElementById('bodyContentType');
    const saveMockButton = document.getElementById('saveMock');
    const cancelMockButton = document.getElementById('cancelMock');
    // Inicializar gerenciadores
    const urlPatternManager = new UrlPatternManager(urlList);
    const responseManager = new ResponseManager(pendingResponsesList, responseDetails, responseUrl, responseType, responseMimeType, responseStatus, responseHeaders, responseBody, approveResponseButton, cancelEditButton, ignoreResponseButton, mockResponseButton, editResponseButton);
    const mockManager = new MockManager(mockList, mockDetails, mockUrlPatternInput, mockMethodSelect, mockStatusInput, mockHeadersTextarea, mockBodyTextarea, formatHeadersBtn, formatBodyBtn, detectBodyTypeBtn, bodyContentTypeSelect);
    const debuggingManager = new DebuggingManager(statusDot, statusText, selectTargetTabButton, startDebuggingButton, stopDebuggingButton);
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
            urlPatternManager.addUrlPattern(urlPatternInput.value.trim(), httpMethodSelect.value, requestHeaderNameInput.value.trim(), requestHeaderValueInput.value.trim(), headerTypeSelect.value).then(() => {
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
            }
        });
    }
    function updateRequestCount() {
        const count = responseManager.getPendingResponsesCount();
        requestCountBadge.textContent = count.toString();
        // Destacar o badge se houver requisições pendentes
        if (count > 0) {
            requestCountBadge.style.display = 'inline-block';
        }
        else {
            requestCountBadge.style.display = 'none';
        }
    }
    // Navegação entre abas
    function switchTab(tabName) {
        // Atualizar botões de navegação
        navItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabName) {
                item.classList.add('active');
            }
            else {
                item.classList.remove('active');
            }
        });
        // Atualizar conteúdo das abas
        tabContents.forEach(content => {
            if (content.id === tabName) {
                content.classList.add('active');
            }
            else {
                content.classList.remove('active');
            }
        });
    }
});
//# sourceMappingURL=main.js.map