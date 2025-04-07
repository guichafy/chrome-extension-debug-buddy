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
//# sourceMappingURL=urlPatterns.js.map