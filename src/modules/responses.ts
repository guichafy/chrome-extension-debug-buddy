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

interface ResponseModifications {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Converte texto de headers em um objeto
 */
function parseResponseHeaders(headersText: string): Record<string, string> {
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

/**
 * Gerencia as respostas interceptadas
 */
class ResponseManager {
  private pendingResponsesList: HTMLElement;
  private responseDetails: HTMLElement;
  private responseUrl: HTMLElement;
  private responseType: HTMLElement;
  private responseMimeType: HTMLElement;
  private responseStatus: HTMLInputElement;
  private responseHeaders: HTMLTextAreaElement;
  private responseBody: HTMLTextAreaElement;
  private approveResponseButton: HTMLElement;
  private cancelEditButton: HTMLElement;
  private ignoreResponseButton: HTMLElement;
  private mockResponseButton: HTMLElement;
  private editResponseButton: HTMLElement;

  private pendingResponses: Record<string, InterceptedResponse> = {};
  private currentRequestId: string | null = null;
  private currentResponseDetails: InterceptedResponse | null = null;
  private isEditingResponse: boolean = false;

  constructor(
    pendingResponsesList: HTMLElement,
    responseDetails: HTMLElement,
    responseUrl: HTMLElement,
    responseType: HTMLElement,
    responseMimeType: HTMLElement,
    responseStatus: HTMLInputElement,
    responseHeaders: HTMLTextAreaElement,
    responseBody: HTMLTextAreaElement,
    approveResponseButton: HTMLElement,
    cancelEditButton: HTMLElement,
    ignoreResponseButton: HTMLElement,
    mockResponseButton: HTMLElement,
    editResponseButton: HTMLElement
  ) {
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
  public async loadPendingResponses(): Promise<void> {
    const response = await chrome.runtime.sendMessage({ action: 'getPendingResponses' });
    if (response && response.pendingResponses) {
      this.pendingResponses = response.pendingResponses;
      this.updatePendingResponsesList();
    }
  }

  /**
   * Atualiza a lista de respostas pendentes na UI
   */
  public updatePendingResponsesList(): void {
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
  public async viewResponseDetails(requestId: string): Promise<void> {
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
    } else {
      alert('Falha ao obter detalhes da resposta');
    }
  }

  /**
   * Esconde os detalhes da resposta
   */
  public hideResponseDetails(): void {
    this.responseDetails.classList.add('hidden');
    this.currentRequestId = null;
    this.currentResponseDetails = null;
  }

  /**
   * Alterna o modo de edição da resposta
   */
  public toggleResponseEditing(shouldEdit?: boolean): void {
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
    } else {
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
  public async approveResponse(): Promise<void> {
    if (!this.currentRequestId) {
      alert('Nenhuma resposta selecionada');
      return;
    }

    // Preparar modificações
    const modifications: ResponseModifications = {
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
    } else {
      alert('Falha ao aplicar modificações: ' + (response ? response.error : 'Erro desconhecido'));
    }
  }

  /**
   * Ignora uma resposta (continua sem modificações)
   */
  public async ignoreResponse(): Promise<void> {
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
    } else {
      alert('Falha ao ignorar resposta: ' + (response ? response.error : 'Erro desconhecido'));
    }
  }

  /**
   * Retorna a resposta atual para criar um mock
   */
  public getCurrentResponse(): InterceptedResponse | null {
    return this.currentResponseDetails;
  }

  /**
   * Retorna o número de respostas pendentes
   */
  public getPendingResponsesCount(): number {
    return Object.keys(this.pendingResponses).length;
  }
}
