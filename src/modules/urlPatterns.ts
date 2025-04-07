export interface UrlPattern {
  url: string;
  method: string;
  headerType?: string;
  headerName?: string;
  headerValue?: string;
}

/**
 * Gerencia os padrões de URL para interceptação
 */
export class UrlPatternManager {
  private urlList: HTMLElement;

  constructor(urlList: HTMLElement) {
    this.urlList = urlList;
  }

  /**
   * Adiciona um novo padrão de URL
   */
  public async addUrlPattern(
    urlPattern: string,
    httpMethod: string,
    headerName: string,
    headerValue: string,
    headerType: string
  ): Promise<void> {
    if (!urlPattern) {
      alert('Por favor, insira um padrão de URL');
      return;
    }

    // Preparar o objeto de configuração de interceptação
    const interceptConfig: UrlPattern = {
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
    const patterns: (string | UrlPattern)[] = result.urlPatterns || [];

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
    await chrome.storage.local.set({ urlPatterns: patterns });
  }

  /**
   * Carrega os padrões de URL do armazenamento
   */
  public async loadUrlPatterns(): Promise<void> {
    const result = await chrome.storage.local.get(['urlPatterns']);
    const patterns: (string | UrlPattern)[] = result.urlPatterns || [];

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
  public async removeUrlPattern(index: number): Promise<void> {
    const result = await chrome.storage.local.get(['urlPatterns']);
    let patterns: (string | UrlPattern)[] = result.urlPatterns || [];

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
