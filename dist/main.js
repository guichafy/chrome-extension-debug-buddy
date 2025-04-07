/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/modules/debugging.ts":
/*!**********************************!*\
  !*** ./src/modules/debugging.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DebuggingManager = void 0;
/**
 * Gerencia as operações de debugging
 */
class DebuggingManager {
    constructor(statusDot, statusText, selectTargetTabButton, startDebuggingButton, stopDebuggingButton) {
        this.targetTabId = null;
        this.statusDot = statusDot;
        this.statusText = statusText;
        this.selectTargetTabButton = selectTargetTabButton;
        this.startDebuggingButton = startDebuggingButton;
        this.stopDebuggingButton = stopDebuggingButton;
        // Configurar event listeners
        this.selectTargetTabButton.addEventListener('click', () => this.selectTargetTab());
        this.startDebuggingButton.addEventListener('click', () => this.startDebugging());
        this.stopDebuggingButton.addEventListener('click', () => this.stopDebugging());
    }
    /**
     * Verifica o status atual do debugging
     */
    async checkDebuggingStatus() {
        const response = await chrome.runtime.sendMessage({ action: 'getDebuggingStatus' });
        if (response && response.isDebugging) {
            this.updateStatusIndicator(true, 'Interceptação ativa');
        }
        else {
            this.updateStatusIndicator(false, 'Inativo');
        }
    }
    /**
     * Atualiza o indicador de status na UI
     */
    updateStatusIndicator(isActive, statusMessage) {
        if (isActive) {
            this.statusDot.classList.add('active');
            this.statusText.textContent = statusMessage;
            this.statusText.style.color = 'var(--success-color)';
        }
        else {
            this.statusDot.classList.remove('active');
            this.statusText.textContent = statusMessage;
            this.statusText.style.color = '';
        }
    }
    /**
     * Abre um modal para selecionar a aba alvo
     */
    async selectTargetTab() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        // Criar uma lista de abas para seleção
        const tabOptions = tabs.map(tab => ({
            title: tab.title && tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title || 'Sem título',
            url: tab.url || '',
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
                if (tab.id) {
                    this.targetTabId = tab.id;
                    // Atualizar o texto do botão com o título da aba
                    this.selectTargetTabButton.innerHTML = `
            <span class="material-icons">tab</span>
            ${tab.title.substring(0, 15)}...
          `;
                    // Fechar o modal
                    document.body.removeChild(modal);
                    // Atualizar visualmente
                    this.selectTargetTabButton.classList.add('selected');
                }
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
    }
    /**
     * Inicia o debugging na aba selecionada
     */
    async startDebugging() {
        if (!this.targetTabId) {
            alert('Por favor, selecione uma aba para interceptar primeiro');
            this.selectTargetTab();
            return;
        }
        const response = await chrome.runtime.sendMessage({
            action: 'startDebugging',
            tabId: this.targetTabId
        });
        if (response && response.success) {
            this.updateStatusIndicator(true, 'Interceptação ativa');
        }
        else {
            this.updateStatusIndicator(false, 'Falha ao iniciar interceptação');
            alert(`Erro ao iniciar: ${response ? response.error : 'Erro desconhecido'}`);
        }
    }
    /**
     * Para o debugging
     */
    async stopDebugging() {
        const response = await chrome.runtime.sendMessage({ action: 'stopDebugging' });
        if (response && response.success) {
            this.updateStatusIndicator(false, 'Inativo');
        }
        else {
            alert(`Erro ao parar: ${response ? response.error : 'Erro desconhecido'}`);
        }
    }
}
exports.DebuggingManager = DebuggingManager;


/***/ }),

/***/ "./src/modules/mocks.ts":
/*!******************************!*\
  !*** ./src/modules/mocks.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MockManager = void 0;
exports.detectContentType = detectContentType;
exports.getCodeMirrorMode = getCodeMirrorMode;
/**
 * Detecta o tipo de conteúdo com base no texto
 */
function detectContentType(content) {
    content = content.trim();
    // Tentar detectar JSON
    if ((content.startsWith('{') && content.endsWith('}')) ||
        (content.startsWith('[') && content.endsWith(']'))) {
        try {
            JSON.parse(content);
            return 'json';
        }
        catch (e) {
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
/**
 * Obtém o modo correto para o CodeMirror
 */
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
/**
 * Gerencia os mocks para respostas
 */
class MockManager {
    constructor(mockList, mockDetails, mockUrlPatternInput, mockMethodSelect, mockStatusInput, mockHeadersTextarea, mockBodyTextarea, formatHeadersBtn, formatBodyBtn, detectBodyTypeBtn, bodyContentTypeSelect) {
        this.mocks = [];
        this.currentEditingMockIndex = -1;
        this.headersEditor = null;
        this.bodyEditor = null;
        this.mockList = mockList;
        this.mockDetails = mockDetails;
        this.mockUrlPatternInput = mockUrlPatternInput;
        this.mockMethodSelect = mockMethodSelect;
        this.mockStatusInput = mockStatusInput;
        this.mockHeadersTextarea = mockHeadersTextarea;
        this.mockBodyTextarea = mockBodyTextarea;
        this.formatHeadersBtn = formatHeadersBtn;
        this.formatBodyBtn = formatBodyBtn;
        this.detectBodyTypeBtn = detectBodyTypeBtn;
        this.bodyContentTypeSelect = bodyContentTypeSelect;
    }
    /**
     * Carrega os mocks do armazenamento
     */
    async loadMocks() {
        const result = await chrome.storage.local.get(['mocks']);
        this.mocks = result.mocks || [];
        this.updateMocksList();
    }
    /**
     * Atualiza a lista de mocks na UI
     */
    updateMocksList() {
        // Limpar lista atual
        this.mockList.innerHTML = '';
        if (this.mocks.length === 0) {
            const noMocks = document.createElement('p');
            noMocks.className = 'no-mocks';
            noMocks.textContent = 'Nenhum mock configurado';
            this.mockList.appendChild(noMocks);
            return;
        }
        // Adicionar cada mock à lista
        this.mocks.forEach((mock, index) => {
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
                this.toggleMockStatus(index);
            });
            actionsElement.appendChild(toggleButton);
            const editButton = document.createElement('button');
            editButton.className = 'secondary-button';
            editButton.innerHTML = '<span class="material-icons">edit</span>';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMock(index);
            });
            actionsElement.appendChild(editButton);
            const deleteButton = document.createElement('button');
            deleteButton.className = 'danger-button';
            deleteButton.innerHTML = '<span class="material-icons">delete</span>';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMock(index);
            });
            actionsElement.appendChild(deleteButton);
            mockItem.appendChild(actionsElement);
            this.mockList.appendChild(mockItem);
        });
    }
    /**
     * Exibe o formulário de detalhes do mock
     */
    showMockDetails(mockData = null) {
        if (mockData) {
            // Edição de mock existente
            this.mockUrlPatternInput.value = mockData.urlPattern;
            this.mockMethodSelect.value = mockData.method;
            this.mockStatusInput.value = mockData.status.toString();
            this.mockHeadersTextarea.value = JSON.stringify(mockData.headers, null, 2);
            this.mockBodyTextarea.value = mockData.body;
            // Armazenar o status de habilitado/desabilitado
            mockData.enabled = mockData.enabled !== undefined ? mockData.enabled : true;
        }
        else {
            // Novo mock
            this.mockUrlPatternInput.value = '';
            this.mockMethodSelect.value = 'ANY';
            this.mockStatusInput.value = '200';
            this.mockHeadersTextarea.value = '{\n  "Content-Type": "application/json"\n}';
            this.mockBodyTextarea.value = '{\n  "success": true,\n  "data": {}\n}';
            this.currentEditingMockIndex = -1;
        }
        this.mockDetails.classList.remove('hidden');
        // Inicializar os editores CodeMirror após um pequeno delay para garantir que os elementos estejam visíveis
        setTimeout(() => {
            this.initializeCodeEditors();
        }, 100);
    }
    /**
     * Esconde o formulário de detalhes do mock
     */
    hideMockDetails() {
        // Destruir os editores CodeMirror antes de esconder o painel
        if (this.headersEditor) {
            this.headersEditor.toTextArea();
            this.headersEditor = null;
        }
        if (this.bodyEditor) {
            this.bodyEditor.toTextArea();
            this.bodyEditor = null;
        }
        this.mockDetails.classList.add('hidden');
        this.currentEditingMockIndex = -1;
    }
    /**
     * Inicializa os editores CodeMirror
     */
    initializeCodeEditors() {
        // Inicializar o editor de headers (sempre JSON)
        if (!this.headersEditor) {
            this.headersEditor = CodeMirror.fromTextArea(this.mockHeadersTextarea, {
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
                    'Ctrl-Q': function (cm) { cm.foldCode(cm.getCursor()); }
                }
            });
        }
        // Inicializar o editor de body (detectar tipo automaticamente)
        if (!this.bodyEditor) {
            const bodyContent = this.mockBodyTextarea.value;
            let mode = detectContentType(bodyContent);
            this.bodyContentTypeSelect.value = mode;
            this.bodyEditor = CodeMirror.fromTextArea(this.mockBodyTextarea, {
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
                    'Ctrl-Q': function (cm) { cm.foldCode(cm.getCursor()); }
                }
            });
        }
        // Configurar event listeners para os botões de formatação
        this.formatHeadersBtn.addEventListener('click', () => this.formatHeaders());
        this.formatBodyBtn.addEventListener('click', () => this.formatBody());
        this.detectBodyTypeBtn.addEventListener('click', () => this.detectAndSetBodyType());
        this.bodyContentTypeSelect.addEventListener('change', () => this.updateBodyEditorMode());
    }
    /**
     * Formata os headers (sempre JSON)
     */
    formatHeaders() {
        try {
            const content = this.headersEditor.getValue();
            const jsonObj = JSON.parse(content);
            const formatted = JSON.stringify(jsonObj, null, 2);
            this.headersEditor.setValue(formatted);
        }
        catch (e) {
            alert('Não foi possível formatar o JSON. Verifique se é um JSON válido.');
        }
    }
    /**
     * Formata o body de acordo com o tipo selecionado
     */
    formatBody() {
        const content = this.bodyEditor.getValue();
        const type = this.bodyContentTypeSelect.value;
        if (type === 'json') {
            try {
                const jsonObj = JSON.parse(content);
                const formatted = JSON.stringify(jsonObj, null, 2);
                this.bodyEditor.setValue(formatted);
            }
            catch (e) {
                alert('Não foi possível formatar o JSON. Verifique se é um JSON válido.');
            }
        }
        else if (type === 'html') {
            try {
                // Usar prettier para formatar HTML
                const formatted = prettier.format(content, {
                    parser: 'html',
                    printWidth: 80,
                    tabWidth: 2,
                    useTabs: false
                });
                this.bodyEditor.setValue(formatted);
            }
            catch (e) {
                alert('Não foi possível formatar o HTML. Verifique se é um HTML válido.');
            }
        }
        // Para texto simples, não fazemos formatação
    }
    /**
     * Detecta e define o tipo de conteúdo do body
     */
    detectAndSetBodyType() {
        const content = this.bodyEditor.getValue();
        const detectedType = detectContentType(content);
        this.bodyContentTypeSelect.value = detectedType;
        this.updateBodyEditorMode();
    }
    /**
     * Atualiza o modo do editor de acordo com o tipo selecionado
     */
    updateBodyEditorMode() {
        const type = this.bodyContentTypeSelect.value;
        this.bodyEditor.setOption('mode', getCodeMirrorMode(type));
    }
    /**
     * Salva um mock
     */
    async saveMock() {
        const urlPattern = this.mockUrlPatternInput.value.trim();
        const method = this.mockMethodSelect.value;
        const status = parseInt(this.mockStatusInput.value, 10);
        if (!urlPattern) {
            alert('Por favor, insira um padrão de URL');
            return;
        }
        // Obter o conteúdo dos editores CodeMirror
        this.headersEditor.save(); // Salva o conteúdo no textarea original
        this.bodyEditor.save();
        let headers;
        try {
            headers = JSON.parse(this.mockHeadersTextarea.value);
        }
        catch (e) {
            alert('Headers inválidos. Certifique-se de que é um JSON válido.');
            return;
        }
        const body = this.mockBodyTextarea.value;
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
        const result = await chrome.storage.local.get(['mocks']);
        let mocksList = result.mocks || [];
        if (this.currentEditingMockIndex >= 0 && this.currentEditingMockIndex < mocksList.length) {
            // Atualizar mock existente
            mocksList[this.currentEditingMockIndex] = mockData;
        }
        else {
            // Adicionar novo mock
            mocksList.push(mockData);
        }
        // Salvar mocks atualizados
        await chrome.storage.local.set({ mocks: mocksList });
        this.mocks = mocksList;
        this.updateMocksList();
        this.hideMockDetails();
    }
    /**
     * Edita um mock existente
     */
    editMock(index) {
        if (index >= 0 && index < this.mocks.length) {
            this.currentEditingMockIndex = index;
            this.showMockDetails(this.mocks[index]);
        }
    }
    /**
     * Exclui um mock
     */
    async deleteMock(index) {
        if (index >= 0 && index < this.mocks.length) {
            if (confirm('Tem certeza que deseja remover este mock?')) {
                this.mocks.splice(index, 1);
                await chrome.storage.local.set({ mocks: this.mocks });
                this.updateMocksList();
            }
        }
    }
    /**
     * Alterna o status de habilitado/desabilitado de um mock
     */
    async toggleMockStatus(index) {
        if (index >= 0 && index < this.mocks.length) {
            // Inverter o status de habilitado/desabilitado
            this.mocks[index].enabled = !this.mocks[index].enabled;
            // Salvar as alterações
            await chrome.storage.local.set({ mocks: this.mocks });
            // Atualizar a interface
            this.updateMocksList();
        }
    }
    /**
     * Cria um mock a partir de uma resposta interceptada
     */
    createMockFromResponse(response) {
        if (!response) {
            alert('Nenhuma resposta selecionada');
            return;
        }
        // Extrair o URL base da requisição para o mock
        const url = response.url;
        const urlObj = new URL(url);
        const urlPattern = urlObj.hostname + urlObj.pathname;
        // Determinar o método (precisamos adivinhar com base no tipo ou URL)
        let method = 'GET';
        // Criar mock a partir da resposta atual
        const mockData = {
            urlPattern,
            method,
            status: response.status,
            headers: response.headers,
            body: response.body,
            createdAt: Date.now(),
            enabled: true // Por padrão, novos mocks são habilitados
        };
        // Exibir o formulário com os dados pré-preenchidos
        this.currentEditingMockIndex = -1; // É um novo mock
        this.showMockDetails(mockData);
    }
}
exports.MockManager = MockManager;


/***/ }),

/***/ "./src/modules/responses.ts":
/*!**********************************!*\
  !*** ./src/modules/responses.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ResponseManager = void 0;
exports.parseResponseHeaders = parseResponseHeaders;
/**
 * Converte texto de headers em um objeto
 */
function parseResponseHeaders(headersText) {
    const headers = {};
    const lines = headersText.split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (!line)
            return;
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            headers[key] = value;
        }
    });
    return headers;
}
/**
 * Gerencia as respostas interceptadas
 */
class ResponseManager {
    constructor(pendingResponsesList, responseDetails, responseUrl, responseType, responseMimeType, responseStatus, responseHeaders, responseBody, approveResponseButton, cancelEditButton, ignoreResponseButton, mockResponseButton, editResponseButton) {
        this.pendingResponses = {};
        this.currentRequestId = null;
        this.currentResponseDetails = null;
        this.isEditingResponse = false;
        this.pendingResponsesList = pendingResponsesList;
        this.responseDetails = responseDetails;
        this.responseUrl = responseUrl;
        this.responseType = responseType;
        this.responseMimeType = responseMimeType;
        this.responseStatus = responseStatus;
        this.responseHeaders = responseHeaders;
        this.responseBody = responseBody;
        this.approveResponseButton = approveResponseButton;
        this.cancelEditButton = cancelEditButton;
        this.ignoreResponseButton = ignoreResponseButton;
        this.mockResponseButton = mockResponseButton;
        this.editResponseButton = editResponseButton;
        // Configurar event listeners
        this.approveResponseButton.addEventListener('click', () => this.approveResponse());
        this.cancelEditButton.addEventListener('click', () => this.hideResponseDetails());
        this.ignoreResponseButton.addEventListener('click', () => this.ignoreResponse());
        this.editResponseButton.addEventListener('click', () => this.toggleResponseEditing());
    }
    /**
     * Carrega as respostas pendentes do background script
     */
    async loadPendingResponses() {
        const response = await chrome.runtime.sendMessage({ action: 'getPendingResponses' });
        if (response && response.pendingResponses) {
            this.pendingResponses = response.pendingResponses;
            this.updatePendingResponsesList();
        }
    }
    /**
     * Atualiza a lista de respostas pendentes na UI
     */
    updatePendingResponsesList() {
        // Limpar lista atual
        this.pendingResponsesList.innerHTML = '';
        // Obter IDs das respostas e ordenar por timestamp (mais recentes primeiro)
        const responseIds = Object.keys(this.pendingResponses);
        if (responseIds.length === 0) {
            const noResponses = document.createElement('p');
            noResponses.className = 'no-responses';
            noResponses.textContent = 'Nenhuma requisição interceptada';
            this.pendingResponsesList.appendChild(noResponses);
            return;
        }
        responseIds.sort((a, b) => {
            return this.pendingResponses[b].timestamp - this.pendingResponses[a].timestamp;
        });
        // Adicionar cada resposta à lista
        responseIds.forEach(requestId => {
            const response = this.pendingResponses[requestId];
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
                this.viewResponseDetails(requestId);
            });
            this.pendingResponsesList.appendChild(responseItem);
        });
    }
    /**
     * Exibe os detalhes de uma resposta
     */
    async viewResponseDetails(requestId) {
        this.currentRequestId = requestId;
        this.isEditingResponse = false;
        // Obter detalhes completos da resposta do background script
        const result = await chrome.runtime.sendMessage({
            action: 'getResponseDetails',
            requestId
        });
        if (result && result.success) {
            this.currentResponseDetails = result.response;
            // Atualizar UI
            if (this.currentResponseDetails) {
                this.responseUrl.textContent = this.currentResponseDetails.url;
                this.responseType.textContent = this.currentResponseDetails.type;
                this.responseMimeType.textContent = this.currentResponseDetails.mimeType;
                this.responseStatus.value = this.currentResponseDetails.status.toString();
                // Formatar headers como pares chave: valor
                let headersText = '';
                for (const [key, value] of Object.entries(this.currentResponseDetails.headers)) {
                    headersText += `${key}: ${value}\n`;
                }
                this.responseHeaders.value = headersText;
                // Definir body se disponível
                this.responseBody.value = this.currentResponseDetails.body || 'Carregando corpo da resposta...';
            }
            // Exibir detalhes da resposta
            this.responseDetails.classList.remove('hidden');
            // Esconder os controles de edição inicialmente
            this.toggleResponseEditing(false);
        }
        else {
            alert('Falha ao obter detalhes da resposta');
        }
    }
    /**
     * Esconde os detalhes da resposta
     */
    hideResponseDetails() {
        this.responseDetails.classList.add('hidden');
        this.currentRequestId = null;
        this.currentResponseDetails = null;
    }
    /**
     * Alterna o modo de edição da resposta
     */
    toggleResponseEditing(shouldEdit) {
        if (typeof shouldEdit !== 'boolean') {
            shouldEdit = !this.isEditingResponse;
        }
        this.isEditingResponse = shouldEdit;
        // Elementos que devem ser editáveis
        this.responseStatus.disabled = !shouldEdit;
        this.responseHeaders.disabled = !shouldEdit;
        this.responseBody.disabled = !shouldEdit;
        // Mostrar/esconder botões relevantes
        if (shouldEdit) {
            this.approveResponseButton.style.display = 'flex';
            this.cancelEditButton.style.display = 'flex';
            this.ignoreResponseButton.style.display = 'none';
            this.mockResponseButton.style.display = 'none';
            this.editResponseButton.style.display = 'none';
        }
        else {
            this.approveResponseButton.style.display = 'none';
            this.cancelEditButton.style.display = 'none';
            this.ignoreResponseButton.style.display = 'flex';
            this.mockResponseButton.style.display = 'flex';
            this.editResponseButton.style.display = 'flex';
        }
    }
    /**
     * Aprova uma resposta com modificações
     */
    async approveResponse() {
        if (!this.currentRequestId) {
            alert('Nenhuma resposta selecionada');
            return;
        }
        // Preparar modificações
        const modifications = {
            status: parseInt(this.responseStatus.value, 10),
            headers: parseResponseHeaders(this.responseHeaders.value),
            body: this.responseBody.value
        };
        // Enviar para o background script
        const response = await chrome.runtime.sendMessage({
            action: 'approveResponse',
            requestId: this.currentRequestId,
            modifications
        });
        if (response && response.success) {
            // Remover da lista de respostas pendentes
            delete this.pendingResponses[this.currentRequestId];
            // Atualizar UI
            this.updatePendingResponsesList();
            this.hideResponseDetails();
        }
        else {
            alert('Falha ao aplicar modificações: ' + (response ? response.error : 'Erro desconhecido'));
        }
    }
    /**
     * Ignora uma resposta (continua sem modificações)
     */
    async ignoreResponse() {
        if (!this.currentRequestId) {
            alert('Nenhuma resposta selecionada');
            return;
        }
        // Continuar a requisição sem modificações
        const response = await chrome.runtime.sendMessage({
            action: 'approveResponse',
            requestId: this.currentRequestId
        });
        if (response && response.success) {
            // Remover da lista de respostas pendentes
            delete this.pendingResponses[this.currentRequestId];
            // Atualizar UI
            this.updatePendingResponsesList();
            this.hideResponseDetails();
        }
        else {
            alert('Falha ao ignorar resposta: ' + (response ? response.error : 'Erro desconhecido'));
        }
    }
    /**
     * Retorna a resposta atual para criar um mock
     */
    getCurrentResponse() {
        return this.currentResponseDetails;
    }
    /**
     * Retorna o número de respostas pendentes
     */
    getPendingResponsesCount() {
        return Object.keys(this.pendingResponses).length;
    }
}
exports.ResponseManager = ResponseManager;


/***/ }),

/***/ "./src/modules/urlPatterns.ts":
/*!************************************!*\
  !*** ./src/modules/urlPatterns.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UrlPatternManager = void 0;
/**
 * Gerencia os padrões de URL para interceptação
 */
class UrlPatternManager {
    constructor(urlList) {
        this.urlList = urlList;
    }
    /**
     * Adiciona um novo padrão de URL
     */
    async addUrlPattern(urlPattern, httpMethod, headerName, headerValue, headerType) {
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
        const result = await chrome.storage.local.get(['urlPatterns']);
        const patterns = result.urlPatterns || [];
        // Verificar se já existe uma configuração idêntica
        const exists = patterns.some(pattern => {
            if (typeof pattern === 'string') {
                return pattern === urlPattern;
            }
            else {
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
        await chrome.storage.local.set({ urlPatterns: patterns });
    }
    /**
     * Carrega os padrões de URL do armazenamento
     */
    async loadUrlPatterns() {
        const result = await chrome.storage.local.get(['urlPatterns']);
        const patterns = result.urlPatterns || [];
        // Clear current list
        this.urlList.innerHTML = '';
        // Add each pattern to the list
        patterns.forEach((pattern, index) => {
            const li = document.createElement('li');
            const patternText = document.createElement('div');
            patternText.className = 'pattern-info';
            // Verificar se é um objeto de configuração ou uma string
            if (typeof pattern === 'string') {
                patternText.innerHTML = `<strong>URL:</strong> ${pattern}`;
            }
            else {
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
            removeButton.addEventListener('click', () => {
                this.removeUrlPattern(index);
            });
            li.appendChild(removeButton);
            this.urlList.appendChild(li);
        });
    }
    /**
     * Remove um padrão de URL pelo índice
     */
    async removeUrlPattern(index) {
        const result = await chrome.storage.local.get(['urlPatterns']);
        let patterns = result.urlPatterns || [];
        // Remove o padrão pelo índice
        if (index >= 0 && index < patterns.length) {
            patterns.splice(index, 1);
        }
        // Salvar os padrões atualizados
        await chrome.storage.local.set({ urlPatterns: patterns });
        // Atualizar a lista
        this.loadUrlPatterns();
    }
}
exports.UrlPatternManager = UrlPatternManager;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
// Import classes from modules
const urlPatterns_1 = __webpack_require__(/*! ./modules/urlPatterns */ "./src/modules/urlPatterns.ts");
const responses_1 = __webpack_require__(/*! ./modules/responses */ "./src/modules/responses.ts");
const mocks_1 = __webpack_require__(/*! ./modules/mocks */ "./src/modules/mocks.ts");
const debugging_1 = __webpack_require__(/*! ./modules/debugging */ "./src/modules/debugging.ts");
// Import hot reload utility for development mode
if (true) {
    console.log('Running in development mode with hot reload support');
}
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
    const urlPatternManager = new urlPatterns_1.UrlPatternManager(urlList);
    const responseManager = new responses_1.ResponseManager(pendingResponsesList, responseDetails, responseUrl, responseType, responseMimeType, responseStatus, responseHeaders, responseBody, approveResponseButton, cancelEditButton, ignoreResponseButton, mockResponseButton, editResponseButton);
    const mockManager = new mocks_1.MockManager(mockList, mockDetails, mockUrlPatternInput, mockMethodSelect, mockStatusInput, mockHeadersTextarea, mockBodyTextarea, formatHeadersBtn, formatBodyBtn, detectBodyTypeBtn, bodyContentTypeSelect);
    const debuggingManager = new debugging_1.DebuggingManager(statusDot, statusText, selectTargetTabButton, startDebuggingButton, stopDebuggingButton);
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
            else if (message.action === 'hot_reload') {
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

})();

/******/ })()
;
//# sourceMappingURL=main.js.map