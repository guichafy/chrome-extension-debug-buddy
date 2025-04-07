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
//# sourceMappingURL=debugging.js.map