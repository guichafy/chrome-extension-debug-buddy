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
//# sourceMappingURL=mocks.js.map