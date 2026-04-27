import { indexedDBService } from './services/indexedDB';
import { NetworkTimingTracker } from './services/networkTiming';
import type {
	Action,
	InterceptedResponse,
	Matcher,
	Message,
	MessageAction,
	MessageResponse,
	ResponseModifications,
	Rule,
} from './types';
import type { MockConfig, UrlPattern } from './types/legacy';

// Global variables
let isDebugging = false;
let attachedTabId: number | null = null;
let urlPatterns: (string | UrlPattern)[] = [];
let rules: Rule[] = [];
let pendingResponses: Record<string, InterceptedResponse> = {}; // Store intercepted responses
let allRequests: Record<string, InterceptedResponse> = {}; // Store all requests
// Variáveis globais para rastrear abas
let interceptorTabId: number | null = null;
let targetTabId: number | null = null;
let targetTabTitle = '';
let targetTabUrl = '';

// Background é a fonte de verdade da persistência. `persistRequest` grava
// no in-memory cache + IndexedDB e broadcasta `newRequest` para a UI; quando
// updates parciais chegam (ex.: duration assíncrono ou aprovação após dialog),
// `patchRequest` mescla, persiste e broadcasta `requestUpdated`. Não dependemos
// mais da UI estar montada para persistir — assim, navegar entre rotas durante
// interceptação não perde dado (era a causa raiz do "request interceptada some
// do histórico" e do issue #4).

function broadcastToUI(action: string, payload: Record<string, unknown>): void {
	if (interceptorTabId === null) return;
	chrome.tabs.sendMessage(interceptorTabId, { action, ...payload }).catch(() => {
		// UI fechada ou navegando — sem problema; o IndexedDB já tem o dado.
	});
}

async function persistRequest(requestId: string, request: InterceptedResponse): Promise<void> {
	allRequests[requestId] = request;
	try {
		await indexedDBService.saveRequest(requestId, request);
	} catch (err) {
		console.error(`Erro ao salvar requisição ${requestId} no IndexedDB:`, err);
	}
	broadcastToUI('newRequest', { requestId, request });
}

async function patchRequest(
	requestId: string,
	updates: Partial<InterceptedResponse>,
): Promise<void> {
	const existing = allRequests[requestId];
	if (!existing) return;
	const merged = { ...existing, ...updates };
	allRequests[requestId] = merged;
	try {
		await indexedDBService.saveRequest(requestId, merged);
	} catch (err) {
		console.error(`Erro ao atualizar requisição ${requestId} no IndexedDB:`, err);
	}
	broadcastToUI('requestUpdated', { requestId, updates });
}

const timingTracker = new NetworkTimingTracker((fetchRequestId, duration) => {
	patchRequest(fetchRequestId, { duration });
});

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
	console.log('Network Request Interceptor extension installed');
});

// Listener para mudanças no storage (para atualizar regras em tempo real)
chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === 'local') {
		// Verificar se as regras ou padrões de URL foram alterados
		if (changes.rules || changes.urlPatterns) {
			console.log('Regras ou padrões de URL foram alterados, atualizando...');

			// Atualizar as regras e padrões em memória
			if (changes.rules) {
				rules = changes.rules.newValue || [];
				console.log(`Regras atualizadas: ${rules.length} regras carregadas`);
			}

			if (changes.urlPatterns) {
				urlPatterns = changes.urlPatterns.newValue || [];
				console.log(`Padrões de URL atualizados: ${urlPatterns.length} padrões carregados`);
			}
		}
	}
});

// Carregar informações da aba alvo do armazenamento quando o background script é iniciado
chrome.storage.local.get(['targetTabInfo'], (result) => {
	if (result.targetTabInfo) {
		targetTabId = result.targetTabInfo.id;
		targetTabTitle = result.targetTabInfo.title || '';
		targetTabUrl = result.targetTabInfo.url || '';
		console.log('Informações da aba alvo carregadas do armazenamento:', result.targetTabInfo);
	}
});

// Support for hot reload during development
if (process.env.NODE_ENV !== 'production') {
	console.log('Running in development mode with hot reload support');
}

// Abrir a janela do interceptor quando o usuário clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
	chrome.tabs.create(
		{
			url: chrome.runtime.getURL('index.html'),
		},
		(tab) => {
			// Guardar o ID da aba do interceptor
			if (tab && tab.id) {
				interceptorTabId = tab.id;
				console.log(`Aba do interceptor criada com ID: ${interceptorTabId}`);
			}
		},
	);
});

// Quando uma aba é fechada, verificar se é a aba do interceptor
chrome.tabs.onRemoved.addListener((tabId) => {
	if (tabId === interceptorTabId) {
		console.log('Aba do interceptor fechada, parando debugging');
		interceptorTabId = null;

		// Parar debugging se estiver ativo
		if (isDebugging && attachedTabId !== null) {
			stopDebugging().catch(console.error);
		}
	}
});

// Listen for messages from the popup or hot reload
chrome.runtime.onMessage.addListener(
	(message: any, _sender, sendResponse: (response: MessageResponse) => void) => {
		// Apenas log mensagens que não são de verificação de status para reduzir ruído
		if (message.action !== 'getDebuggingStatus' && message.action !== 'getPendingResponses') {
			console.log('Received message:', message);
		}

		// Handle hot reload message
		if (message.action === 'hot_reload') {
			console.log('Hot reload triggered');
			// No need to do anything here, the extension will be reloaded by Chrome
			return false;
		}

		if (message.action === 'getMocks') {
			chrome.storage.local.get(['mocks'], (result: { mocks?: MockConfig[] }) => {
				sendResponse({ success: true, mocks: result.mocks || [] });
			});
			return true; // Indicates we'll respond asynchronously
		} else if (message.action === 'startDebugging') {
			// Usa o tabId armazenado ou o fornecido pelo usuário
			const tabIdToUse = message.tabId || targetTabId;
			if (tabIdToUse) {
				// Iniciar debugging diretamente sem verificar regras
				startDebugging(tabIdToUse)
					.then(() => sendResponse({ success: true }))
					.catch((error) => {
						console.error('Error starting debugging:', error);
						sendResponse({ success: false, error: error.message });
					});
				return true; // Indicates we'll respond asynchronously
			} else {
				sendResponse({
					success: false,
					error: 'Nenhuma aba selecionada. Selecione uma aba primeiro.',
				});
				return false;
			}
		} else if (message.action === 'stopDebugging') {
			stopDebugging()
				.then(() => sendResponse({ success: true }))
				.catch((error) => {
					console.error('Error stopping debugging:', error);
					sendResponse({ success: false, error: error.message });
				});
			return true; // Indicates we'll respond asynchronously
		} else if (message.action === 'getDebuggingStatus') {
			sendResponse({ isDebugging });
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'getPendingResponses') {
			sendResponse({ pendingResponses });
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'getAllRequests') {
			sendResponse({ allRequests });
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'getResponseDetails') {
			const { requestId } = message;
			if (requestId && pendingResponses[requestId]) {
				sendResponse({ success: true, response: pendingResponses[requestId] });
			} else {
				sendResponse({ success: false, error: 'Response not found' });
			}
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'selectTargetTab') {
			// Notificar a página principal para abrir o modal de seleção de aba
			if (interceptorTabId) {
				chrome.tabs
					.sendMessage(interceptorTabId, {
						action: 'openSelectTabDialog',
					})
					.catch(() => {
						// Ignora erros se a página principal não estiver aberta
					});
			}
			sendResponse({ success: true });
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'setTargetTab') {
			// Armazenar informações da aba selecionada
			if (message.tabId) {
				targetTabId = message.tabId;
				targetTabTitle = message.tabTitle || '';
				targetTabUrl = message.tabUrl || '';

				// Salvar informações da aba no Chrome Storage para persistência
				chrome.storage.local.set(
					{
						targetTabInfo: {
							id: targetTabId,
							title: targetTabTitle,
							url: targetTabUrl,
						},
					},
					() => {
						console.log('Informações da aba alvo salvas no armazenamento');
					},
				);

				// Notificar a página principal sobre a aba selecionada
				if (interceptorTabId) {
					chrome.tabs
						.sendMessage(interceptorTabId, {
							action: 'targetTabSelected',
							tabId: targetTabId,
							tabTitle: targetTabTitle,
							tabUrl: targetTabUrl,
						})
						.catch(() => {
							// Ignora erros se a página principal não estiver aberta
						});
				}

				sendResponse({ success: true });
			} else {
				sendResponse({ success: false, error: 'ID da aba não fornecido' });
			}
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'clearAllRequests') {
			allRequests = {};
			indexedDBService
				.clearAllRequests()
				.then(() => sendResponse({ success: true }))
				.catch((err) => {
					console.error('Erro ao limpar IndexedDB:', err);
					sendResponse({ success: false, error: String(err) });
				});
			return true; // resposta assíncrona
		} else if (message.action === 'approveResponse') {
			const { requestId, modifications } = message;

			console.log('background.ts - Received approveResponse message:', JSON.stringify(message));
			if (modifications && modifications.status) {
				console.log(
					`background.ts - Received status code: ${modifications.status}, type: ${typeof modifications.status}`,
				);
			}

			if (!requestId || !pendingResponses[requestId]) {
				sendResponse({ success: false, error: 'Response not found' });
				return false;
			}

			// Apply modifications if provided
			if (modifications) {
				// Garantir que o status code seja um número
				if (modifications.status) {
					modifications.status = Number(modifications.status);
					console.log(
						`background.ts - Converted status code: ${modifications.status}, type: ${typeof modifications.status}`,
					);
				}

				applyResponseModifications(requestId, modifications)
					.then(() => {
						delete pendingResponses[requestId];
						// Filtra undefined: spread cego do `modifications` poderia apagar
						// `headers`/`body` originais se o usuário só alterou `status`.
						const finalUpdates: Partial<InterceptedResponse> = { isWaiting: false };
						if (modifications.status !== undefined) finalUpdates.status = modifications.status;
						if (modifications.headers !== undefined) finalUpdates.headers = modifications.headers;
						if (modifications.body !== undefined) finalUpdates.body = modifications.body;
						patchRequest(requestId, finalUpdates);
						sendResponse({ success: true });
					})
					.catch((error) => {
						console.error('Error applying modifications:', error);
						sendResponse({ success: false, error: error.message });
					});
				return true; // Indicates we'll respond asynchronously
			} else {
				// No modifications, just continue the request (ignoring the response)
				console.log(
					`Ignoring response for request ${requestId} - continuing without modifications`,
				);
				const finalize = () => {
					delete pendingResponses[requestId];
					patchRequest(requestId, { isWaiting: false });
					sendResponse({ success: true });
				};
				continueRequest(requestId)
					.then(() => {
						console.log(`Request ${requestId} continued without modifications`);
						finalize();
					})
					.catch((error) => {
						console.error(`Erro ao ignorar resposta ${requestId}:`, error);
						sendResponse({ success: false, error: getErrorMessage(error) });
					});
				return true; // Indicates we'll respond asynchronously
			}
		}

		return false;
	},
);

function encodeBodyToBase64(body: string): string {
	return btoa(
		encodeURIComponent(body).replace(/%([0-9A-F]{2})/g, (_, p1) =>
			String.fromCharCode(Number.parseInt(p1, 16)),
		),
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sendDebuggerCommand<T = unknown>(
	method: string,
	params?: Record<string, unknown>,
): Promise<T> {
	if (attachedTabId === null) {
		return Promise.reject(new Error('Nenhuma sessão de depuração ativa'));
	}

	const tabId = attachedTabId;
	return new Promise((resolve, reject) => {
		const callback = (result?: T) => {
			const lastError = chrome.runtime.lastError;
			if (lastError) {
				reject(new Error(`${method} falhou: ${lastError.message}`));
				return;
			}

			resolve(result as T);
		};

		if (params === undefined) {
			chrome.debugger.sendCommand({ tabId }, method, callback);
		} else {
			chrome.debugger.sendCommand({ tabId }, method, params, callback);
		}
	});
}

async function getDecodedResponseBody(requestId: string): Promise<string> {
	const responseBody = await sendDebuggerCommand<{ body: string; base64Encoded: boolean }>(
		'Fetch.getResponseBody',
		{ requestId },
	);

	if (
		!responseBody ||
		typeof responseBody.body !== 'string' ||
		typeof responseBody.base64Encoded !== 'boolean'
	) {
		throw new Error(`CDP não retornou corpo da resposta para ${requestId}`);
	}

	if (!responseBody.base64Encoded) {
		return responseBody.body;
	}

	try {
		return atob(responseBody.body);
	} catch (error) {
		throw new Error(`Erro ao decodificar base64 para ${requestId}: ${getErrorMessage(error)}`);
	}
}

function getBodyUnavailableReason(method: string, statusCode: number): string | undefined {
	if (method === 'HEAD') {
		return 'Requisições HEAD não possuem corpo de resposta.';
	}

	if (statusCode >= 100 && statusCode < 200) {
		return `Respostas informativas ${statusCode} não possuem corpo disponível para captura.`;
	}

	if (statusCode === 204 || statusCode === 205 || statusCode === 304) {
		return `Resposta ${statusCode} não possui corpo disponível para captura.`;
	}

	if (statusCode >= 300 && statusCode < 400) {
		return `Redirect ${statusCode} não possui corpo disponível para captura via Fetch.getResponseBody.`;
	}

	return undefined;
}

// Apply modifications to a response
async function applyResponseModifications(
	requestId: string,
	modifications: ResponseModifications,
): Promise<boolean> {
	if (!attachedTabId) {
		throw new Error('No active debugging session');
	}

	const pendingResponse = pendingResponses[requestId];
	if (!pendingResponse) {
		throw new Error('Response not found');
	}

	// Verificar se precisamos adicionar headers de resposta conforme configurações
	const url = pendingResponse.url;
	const addResponseHeaders = getResponseHeadersToAdd(url);
	if (addResponseHeaders.length > 0) {
		if (!modifications.headers) {
			modifications.headers = pendingResponse.headers;
		}

		addResponseHeaders.forEach((header) => {
			if (modifications.headers) {
				modifications.headers[header.name] = header.value;
			}
		});
	}

	try {
		// Verificar se há alguma modificação (status, headers ou body)
		// Nota: Sempre tratamos como modificação se houver status, headers ou body definidos
		const hasModifications =
			modifications.status !== undefined ||
			modifications.headers !== undefined ||
			modifications.body !== undefined;

		console.log(`Has modifications: ${hasModifications}, status: ${modifications.status}`);

		if (hasModifications) {
			console.log('Modifications detected, attempting to apply changes');

			try {
				// Prepare the modified body in the correct format
				let modifiedBody: string | undefined;

				// Se o body foi modificado, use o novo body
				if (modifications.body !== undefined && modifications.body !== pendingResponse.body) {
					try {
						modifiedBody = encodeBodyToBase64(modifications.body);
					} catch (e) {
						console.error('Error encoding body to base64:', e);
						throw new Error(`Erro ao codificar corpo modificado para ${requestId}`);
					}
				}

				// Prepare response headers
				let responseHeaders = pendingResponse.headers;
				if (modifications.headers) {
					responseHeaders = modifications.headers;
				}

				// Convert headers object to array format required by Fetch API
				const headersArray: { name: string; value: string }[] = [];
				for (const [name, value] of Object.entries(responseHeaders)) {
					headersArray.push({ name, value });
				}

				// Prepare status code and phrase
				let statusCode = pendingResponse.status;
				let statusPhrase = getStatusText(statusCode);

				if (modifications.status) {
					console.log(`Original status code: ${statusCode}, type: ${typeof statusCode}`);
					console.log(
						`Modification status code: ${modifications.status}, type: ${typeof modifications.status}`,
					);

					// Garantir que o status code seja um número
					statusCode = Number(modifications.status);
					statusPhrase = getStatusText(statusCode);

					console.log(`Final status code: ${statusCode}, type: ${typeof statusCode}`);
					console.log(`Applying modified status code: ${statusCode} (${statusPhrase})`);
				}

				// Preparar os parâmetros para o comando
				const fulfillParams: {
					requestId: string;
					responseCode: number;
					responsePhrase: string;
					responseHeaders: { name: string; value: string }[];
					body?: string;
				} = {
					requestId,
					responseCode: statusCode,
					responsePhrase: statusPhrase,
					responseHeaders: headersArray,
				};

				if (modifiedBody !== undefined) {
					fulfillParams.body = modifiedBody;
				}

				console.log('Fetch.fulfillRequest params:', JSON.stringify(fulfillParams));

				// Fulfill the request with modified response
				await sendDebuggerCommand('Fetch.fulfillRequest', fulfillParams);

				console.log('Successfully applied modified response');
				return true;
			} catch (modError) {
				console.error('Error modifying response:', modError);
				throw modError;
			}
		} else {
			// No modifications, just continue the request
			await continueRequest(requestId);
			console.log(`Request ${requestId} continued without modifications`);
			return true;
		}
	} catch (error) {
		console.error('Error in applyResponseModifications:', error);
		throw error;
	}
}

// Start debugging
async function startDebugging(specificTabId: number | null = null): Promise<boolean> {
	// If already debugging, stop first
	if (isDebugging) {
		await stopDebugging();
	}

	// Get URL patterns and rules from storage
	const result = await chrome.storage.local.get(['urlPatterns', 'rules']);
	urlPatterns = result.urlPatterns || [];
	rules = result.rules || [];

	// Log the loaded patterns and rules (even if there are none)
	console.log(
		`Loaded ${urlPatterns.length} URL patterns and ${rules.length} rules for interception`,
	);

	// Use o tabId especificado ou tente encontrar uma aba ativa
	let tabId = specificTabId;

	if (!tabId) {
		try {
			// Primeiro, tentamos obter a aba ativa na janela atual
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
			if (tabs.length > 0 && tabs[0].id) {
				tabId = tabs[0].id;
			} else {
				// Se não encontrarmos, buscamos qualquer aba ativa
				const allTabs = await chrome.tabs.query({ active: true });
				if (allTabs.length > 0 && allTabs[0].id) {
					tabId = allTabs[0].id;
				} else {
					throw new Error('Nenhuma aba ativa encontrada');
				}
			}
		} catch (error) {
			console.error('Erro ao obter aba ativa:', error);
			throw new Error('Não foi possível determinar a aba para depuração');
		}
	}

	if (!tabId) {
		throw new Error('Não foi possível determinar a aba para depuração');
	}

	console.log(`Tentando anexar à aba ${tabId}`);

	// Attach debugger to the tab
	try {
		await chrome.debugger.attach({ tabId }, '1.3');
		console.log(`Debugger attached to tab ${tabId}`);

		// Habilita Network primeiro para que o requestId seja compartilhado com Fetch
		// e a gente consiga casar timing real de início/fim com a requisição interceptada.
		await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
		console.log('Network domain enabled for timing capture');

		// Enable Fetch domain for request interception
		// This is the key part - we're intercepting ALL requests at the Response stage
		await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
			patterns: [
				{
					urlPattern: '*',
					requestStage: 'Response',
					// Removed invalid resourceType: '*'
				},
			],
		});
		console.log('Fetch domain enabled for response interception');

		// Set up event listeners for debugger events
		chrome.debugger.onEvent.addListener(debuggerEventListener);

		// Set global state
		isDebugging = true;
		attachedTabId = tabId;
		pendingResponses = {};
		timingTracker.reset();

		console.log('Debugging started successfully');
		return true;
	} catch (error) {
		console.error('Error attaching debugger:', error);
		throw error;
	}
}

// Stop debugging
async function stopDebugging(): Promise<boolean> {
	if (!isDebugging || attachedTabId === null) {
		console.log('Not currently debugging');
		return true;
	}

	try {
		// Continue any pending requests before disabling
		const pendingRequestIds = Object.keys(pendingResponses);
		for (const requestId of pendingRequestIds) {
			try {
				await continueRequest(requestId);
				console.log(`Continued pending request ${requestId} before stopping`);
			} catch (error) {
				console.error(`Error continuing request ${requestId}:`, error);
			}
		}

		// Disable Fetch domain
		await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.disable');
		console.log('Fetch domain disabled');

		// Disable network tracking
		await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Network.disable');
		console.log('Network tracking disabled');

		// Detach debugger
		await chrome.debugger.detach({ tabId: attachedTabId });
		console.log(`Debugger detached from tab ${attachedTabId}`);

		// Remove event listener
		chrome.debugger.onEvent.removeListener(debuggerEventListener);

		// Reset global state
		isDebugging = false;
		attachedTabId = null;
		pendingResponses = {};
		allRequests = {};
		timingTracker.reset();

		console.log('Debugging stopped successfully');
		return true;
	} catch (error) {
		console.error('Error stopping debugging:', error);
		throw error;
	}
}

function debuggerEventListener(
	debuggeeId: chrome.debugger.Debuggee,
	message: string,
	params: any,
): void {
	if (debuggeeId.tabId !== attachedTabId) return;

	if (message.startsWith('Network.')) {
		timingTracker.handleNetworkEvent(message, params);
		return;
	}

	if (message === 'Fetch.requestPaused') {
		handleRequestPaused(params);
	}
}

// Handle paused request
async function handleRequestPaused(params: any): Promise<void> {
	const { requestId, request, responseStatusCode, responseHeaders, resourceType, networkId } =
		params;
	const url = request.url;
	const method = request.method || 'GET';
	const postData = request.postData || '';

	console.log(`🟡 REQUEST PAUSED: ${url}`);
	console.log('Request ID:', requestId);
	console.log('Method:', method);
	console.log('Resource Type:', resourceType);

	// Verificar se existe um mock configurado para essa requisição
	const mockResult = await checkForMock(url, method);
	if (mockResult) {
		console.log(`Applying mock for ${url}`);
		// Mock não viaja na rede; descarta o timing pendente.
		timingTracker.discardByNetworkId(networkId);
		await applyMockResponse(requestId, mockResult, {
			url,
			method,
			postData,
			responseStatusCode,
			responseHeaders,
			resourceType,
		});
		return;
	}

	// Verificar se existe uma regra de breakpoint para essa requisição
	const breakpointRule = await checkForBreakpoint(url, method);
	if (breakpointRule) {
		console.log(`Applying breakpoint for ${url}`);
		// Não precisamos fazer nada especial aqui, pois o fluxo normal já vai interceptar a requisição
		// e adicionar à lista de pendingResponses para o usuário interagir
	}

	// Nem toda resposta possui corpo disponível para captura (ex.: redirect/204/HEAD).
	let body: string | undefined;
	const bodyUnavailableReason = getBodyUnavailableReason(method, responseStatusCode);
	if (!bodyUnavailableReason) {
		try {
			body = await getDecodedResponseBody(requestId);
		} catch (error) {
			const captureError = getErrorMessage(error);
			console.error(`Falha ao capturar corpo da resposta para ${requestId}:`, error);

			// Network não pode esperar IndexedDB: continua a request antes de persistir.
			let continueErrorMessage: string | undefined;
			try {
				await continueRequest(requestId);
			} catch (continueError) {
				continueErrorMessage = getErrorMessage(continueError);
				console.error(
					`Falha ao continuar request ${requestId} após erro de captura:`,
					continueError,
				);
			}

			// linkFetchId após continueRequest: garante que o tracker sabe quem é o fetchId
			// caso o end (loadingFinished) ainda chegue mesmo sem corpo capturado.
			timingTracker.linkFetchId(networkId, requestId);

			const failedCaptureRequest: InterceptedResponse = {
				url,
				method,
				status: responseStatusCode,
				statusText: getStatusText(responseStatusCode),
				headers: responseHeadersToObject(responseHeaders),
				mimeType: getMimeTypeFromHeaders(responseHeaders),
				type: resourceType,
				timestamp: Date.now(),
				request: { postData },
				captureError: continueErrorMessage
					? `${captureError}; falha ao continuar request: ${continueErrorMessage}`
					: captureError,
			};

			persistRequest(requestId, failedCaptureRequest).catch((persistError) => {
				console.error(`Falha ao persistir erro de captura para ${requestId}:`, persistError);
			});
			return;
		}
	}

	// Criar objeto de resposta
	const responseObj: InterceptedResponse = {
		url,
		method,
		status: responseStatusCode,
		statusText: getStatusText(responseStatusCode),
		headers: responseHeadersToObject(responseHeaders),
		mimeType: getMimeTypeFromHeaders(responseHeaders),
		type: resourceType,
		timestamp: Date.now(),
		request: { postData },
	};
	if (body !== undefined) responseObj.body = body;
	if (bodyUnavailableReason) responseObj.bodyUnavailableReason = bodyUnavailableReason;

	// Quando Network.loadingFinished chegar (tipicamente depois do paused),
	// o tracker emitirá `requestUpdated` com a duration final.
	timingTracker.linkFetchId(networkId, requestId);

	const willIntercept = shouldInterceptUrl(url, request);
	const persistedRequest: InterceptedResponse = willIntercept
		? { ...responseObj, isWaiting: true }
		: responseObj;

	if (willIntercept) {
		await persistRequest(requestId, persistedRequest);
		console.log(`Intercepting response for ${url}`);
		pendingResponses[requestId] = persistedRequest;
		chrome.runtime.sendMessage({
			action: 'newPendingResponse',
			requestId,
			url,
			method,
			status: responseStatusCode,
			statusText: getStatusText(responseStatusCode),
			type: resourceType,
			mimeType: getMimeTypeFromHeaders(responseHeaders),
		});
		console.log(`Response for ${url} is now pending user approval`);
	} else {
		// Pass-through: a rede tem prioridade sobre IndexedDB. Continua a request primeiro
		// e só depois dispara persistência (fire-and-forget) — assim páginas com muitas
		// requests/IndexedDB lento não acumulam latência artificial no tráfego não-interceptado.
		let continueErrorMessage: string | undefined;
		try {
			await continueRequest(requestId);
		} catch (error) {
			continueErrorMessage = getErrorMessage(error);
			console.error(`Falha ao continuar request ${requestId}:`, error);
		}

		const toPersist: InterceptedResponse = continueErrorMessage
			? { ...persistedRequest, captureError: continueErrorMessage }
			: persistedRequest;

		persistRequest(requestId, toPersist).catch((persistError) => {
			console.error(`Falha ao persistir request ${requestId}:`, persistError);
		});
	}
}

// Helper function to continue a request
async function continueRequest(requestId: string): Promise<void> {
	await sendDebuggerCommand('Fetch.continueRequest', { requestId });
	console.log(`Continued request ${requestId}`);
}

// Helper function to get status text from status code
function getStatusText(statusCode: number): string {
	const statusTexts: Record<number, string> = {
		200: 'OK',
		201: 'Created',
		204: 'No Content',
		301: 'Moved Permanently',
		302: 'Found',
		304: 'Not Modified',
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		500: 'Internal Server Error',
		502: 'Bad Gateway',
		503: 'Service Unavailable',
	};

	return statusTexts[statusCode] || 'Unknown';
}

// Helper function to convert response headers array to object
function responseHeadersToObject(
	headers: { name: string; value: string }[],
): Record<string, string> {
	const result: Record<string, string> = {};
	if (Array.isArray(headers)) {
		headers.forEach((header) => {
			result[header.name] = header.value;
		});
	}
	return result;
}

// Helper function to get MIME type from headers
function getMimeTypeFromHeaders(headers: { name: string; value: string }[]): string {
	if (Array.isArray(headers)) {
		const contentType = headers.find((h) => h.name.toLowerCase() === 'content-type');
		if (contentType) {
			return contentType.value.split(';')[0].trim();
		}
	}
	return 'text/plain';
}

// Obter headers de resposta para adicionar com base nas configurações
function getResponseHeadersToAdd(url: string): { name: string; value: string }[] {
	const responseHeaders: { name: string; value: string }[] = [];

	// Procurar por configurações que correspondam a esta URL e tenham headers de resposta
	urlPatterns.forEach((pattern) => {
		if (typeof pattern !== 'string' && pattern.url && url.includes(pattern.url)) {
			// Verificar se a regra está habilitada
			if (pattern.enabled === false) return;

			// Se for uma configuração com header de resposta
			if (pattern.headerName && pattern.headerValue && pattern.headerType === 'response') {
				responseHeaders.push({
					name: pattern.headerName,
					value: pattern.headerValue,
				});
			}
		}
	});

	return responseHeaders;
}

// Check if a URL should be intercepted based on our patterns
function shouldInterceptUrl(url: string, request: any): boolean {
	if (!url) return false;

	// Obter as regras e padrões mais recentes do storage
	// Isso garante que estamos sempre usando as regras mais atualizadas
	const currentUrlPatterns = urlPatterns;
	const currentRules = rules;

	// Se não houver regras ou padrões configurados, não interceptamos nada
	// Isso permite que o usuário inicie a interceptação sem regras
	if (currentUrlPatterns.length === 0 && currentRules.length === 0) {
		return false;
	}

	// Primeiro, verificar as regras antigas (urlPatterns)
	const matchesOldPattern = currentUrlPatterns.some((pattern) => {
		// Verificar se é um objeto de configuração ou uma string (compatibilidade)
		if (typeof pattern === 'string') {
			// String simples (contém)
			return url.includes(pattern);
		} else {
			// Verificar se a regra está habilitada
			if (pattern.enabled === false) return false;

			// Verificar se a URL corresponde
			let urlMatches = false;

			if (pattern.isRegex) {
				// Usar expressão regular para verificar a correspondência
				try {
					const regex = new RegExp(pattern.url);
					urlMatches = regex.test(url);
				} catch (error) {
					console.error(`Erro ao processar expressão regular '${pattern.url}':`, error);
					return false; // Se a expressão regular for inválida, não intercepta
				}
			} else {
				// Usar método includes para verificação simples
				urlMatches = url.includes(pattern.url);
			}

			if (!urlMatches) return false;

			// Verificar o método HTTP, se especificado
			if (pattern.method && pattern.method !== 'ANY') {
				if (request.method !== pattern.method) return false;
			}

			// Verificar headers na request, se especificados
			if (pattern.headerName && pattern.headerValue && pattern.headerType === 'request') {
				// Verificar se o header na request corresponde
				const headerValue = request.headers.find(
					(h: { name: string; value: string }) =>
						h.name.toLowerCase() === pattern.headerName?.toLowerCase(),
				)?.value;

				if (!headerValue || headerValue !== pattern.headerValue) return false;
			}

			// Todos os critérios foram satisfeitos
			return true;
		}
	});

	// Se corresponder a um padrão antigo, interceptar
	if (matchesOldPattern) {
		return true;
	}

	// Verificar as novas regras
	return currentRules.some((rule) => {
		// Verificar se a regra está habilitada
		if (!rule.enabled) return false;

		// Verificar se todos os matchers habilitados correspondem
		const allMatchersMatch = rule.matchers.every((matcher) => {
			// Ignorar matchers desabilitados
			if (!matcher.enabled) return true;

			switch (matcher.type) {
				case 'url':
					if (!matcher.pattern) return false;

					if (matcher.isRegex) {
						try {
							const regex = new RegExp(matcher.pattern);
							return regex.test(url);
						} catch (error) {
							console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
							return false;
						}
					} else {
						return url.includes(matcher.pattern);
					}

				case 'method':
					if (!matcher.method) return true; // Se não tiver método, considera como correspondente
					return matcher.method === 'ANY' || matcher.method === request.method;

				case 'header': {
					if (!matcher.name || !matcher.value || !matcher.headerType) return false;
					if (matcher.headerType !== 'request') return true; // Ignorar headers de resposta neste ponto

					// Verificar se o header na request corresponde
					const headerValue = request.headers.find(
						(h: { name: string; value: string }) =>
							h.name.toLowerCase() === matcher.name.toLowerCase(),
					)?.value;

					return !!headerValue && headerValue === matcher.value;
				}

				case 'body':
					// Não podemos verificar o corpo da requisição neste ponto
					// Sempre retorna true para não bloquear a interceptação
					return true;

				default:
					return false;
			}
		});

		// Verificar se a ação está habilitada
		if (!rule.action.enabled) return false;

		// Se todos os matchers corresponderem e a ação estiver habilitada, interceptar
		// Interceptamos tanto regras de mock quanto de breakpoint
		return allMatchersMatch && (rule.action.type === 'mock' || rule.action.type === 'breakpoint');
	});
}

// Verifica se existe um mock configurado para a URL
async function checkForMock(url: string, method: string): Promise<MockConfig | undefined> {
	return new Promise((resolve) => {
		// Usar as regras e mocks em memória para resposta mais rápida
		// Isso garante que estamos usando as regras mais atualizadas
		const currentRules = rules;
		const mocks = []; // Vamos buscar os mocks do storage para garantir que estão atualizados

		chrome.storage.local.get(['mocks'], (result: { mocks?: MockConfig[] }) => {
			const storageMocks = result.mocks || [];

			// Procura por um mock que corresponda à URL e método e esteja habilitado
			const mock = storageMocks.find((m) => {
				// Verificar se o mock está habilitado
				const isEnabled = m.enabled !== undefined ? m.enabled : true; // Se não tiver a propriedade, considera como habilitado
				if (!isEnabled) return false;

				// Verificar se o método corresponde
				const methodMatches = m.method === 'ANY' || m.method === method;
				if (!methodMatches) return false;

				// Verificar se a URL corresponde
				let urlMatches = false;

				// Verificar se o padrão de URL é uma expressão regular
				if (
					m.urlPattern.startsWith('^') ||
					m.urlPattern.includes('.*') ||
					m.urlPattern.endsWith('$')
				) {
					try {
						const regex = new RegExp(m.urlPattern);
						urlMatches = regex.test(url);
					} catch (error) {
						console.error(`Erro ao processar expressão regular '${m.urlPattern}' no mock:`, error);
						return false;
					}
				} else {
					// Usar método includes para verificação simples
					urlMatches = url.includes(m.urlPattern);
				}

				return urlMatches && methodMatches && isEnabled;
			});

			// Se encontrou um mock antigo, retorna
			if (mock) {
				console.log(`Mock encontrado para ${url} no formato antigo`);
				resolve(mock);
				return;
			}

			// Procurar por uma regra com ação de mock que corresponda à URL e método
			for (const rule of currentRules) {
				// Verificar se a regra está habilitada
				if (!rule.enabled) continue;

				// Verificar se a ação é do tipo mock e está habilitada
				if (rule.action.type !== 'mock' || !rule.action.enabled) continue;

				// Verificar se todos os matchers habilitados correspondem
				const allMatchersMatch = rule.matchers.every((matcher) => {
					// Ignorar matchers desabilitados
					if (!matcher.enabled) return true;

					switch (matcher.type) {
						case 'url':
							if (!matcher.pattern) return false;

							if (matcher.isRegex) {
								try {
									const regex = new RegExp(matcher.pattern);
									return regex.test(url);
								} catch (error) {
									console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
									return false;
								}
							} else {
								return url.includes(matcher.pattern);
							}

						case 'method':
							if (!matcher.method) return true; // Se não tiver método, considera como correspondente
							return matcher.method === 'ANY' || matcher.method === method;

						case 'header':
							// Não podemos verificar headers neste ponto
							// Sempre retorna true para não bloquear o mock
							return true;

						case 'body':
							// Não podemos verificar o corpo da requisição neste ponto
							// Sempre retorna true para não bloquear o mock
							return true;

						default:
							return false;
					}
				});

				// Se todos os matchers corresponderem, criar um mock a partir da regra
				if (allMatchersMatch) {
					console.log(`Mock encontrado para ${url} no novo formato de regras`);

					// Converter a ação de mock para o formato de MockConfig
					const mockFromRule: MockConfig = {
						urlPattern: rule.matchers.find((m) => m.type === 'url')?.pattern || url,
						method: rule.matchers.find((m) => m.type === 'method')?.method || 'ANY',
						status: rule.action.status || 200,
						headers: rule.action.headers || {},
						body: rule.action.body || '',
						createdAt: rule.createdAt,
						enabled: true,
					};

					resolve(mockFromRule);
					return;
				}
			}

			// Se não encontrou nenhum mock, retorna undefined
			resolve(undefined);
		});
	});
}

// Verifica se existe uma regra de breakpoint configurada para a URL
async function checkForBreakpoint(url: string, method: string): Promise<boolean> {
	return new Promise((resolve) => {
		// Usar as regras em memória para resposta mais rápida
		// Isso garante que estamos usando as regras mais atualizadas
		const currentRules = rules;

		// Procurar por uma regra com ação de breakpoint que corresponda à URL e método
		for (const rule of currentRules) {
			// Verificar se a regra está habilitada
			if (!rule.enabled) continue;

			// Verificar se a ação é do tipo breakpoint e está habilitada
			if (rule.action.type !== 'breakpoint' || !rule.action.enabled) continue;

			// Verificar se todos os matchers habilitados correspondem
			const allMatchersMatch = rule.matchers.every((matcher) => {
				// Ignorar matchers desabilitados
				if (!matcher.enabled) return true;

				switch (matcher.type) {
					case 'url':
						if (!matcher.pattern) return false;

						if (matcher.isRegex) {
							try {
								const regex = new RegExp(matcher.pattern);
								return regex.test(url);
							} catch (error) {
								console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
								return false;
							}
						} else {
							return url.includes(matcher.pattern);
						}

					case 'method':
						if (!matcher.method) return true; // Se não tiver método, considera como correspondente
						return matcher.method === 'ANY' || matcher.method === method;

					case 'header':
						// Não podemos verificar headers neste ponto
						// Sempre retorna true para não bloquear o breakpoint
						return true;

					case 'body':
						// Não podemos verificar o corpo da requisição neste ponto
						// Sempre retorna true para não bloquear o breakpoint
						return true;

					default:
						return false;
				}
			});

			// Se todos os matchers corresponderem, encontramos uma regra de breakpoint
			if (allMatchersMatch) {
				console.log(`Breakpoint encontrado para ${url} na regra: ${rule.name}`);
				resolve(true);
				return;
			}
		}

		// Se não encontrou nenhuma regra de breakpoint, retorna false
		resolve(false);
	});
}

// Aplica um mock como resposta para uma requisição
async function applyMockResponse(
	requestId: string,
	mock: MockConfig,
	originalRequest: {
		url: string;
		method: string;
		postData?: string;
		responseStatusCode: number;
		responseHeaders: { name: string; value: string }[];
		resourceType: string;
	},
): Promise<void> {
	if (!mock) {
		throw new Error(`Mock não informado para ${requestId}`);
	}

	try {
		// Converte headers de objeto para array (formato esperado pelo API Fetch)
		const headerArray: { name: string; value: string }[] = [];
		for (const [name, value] of Object.entries(mock.headers)) {
			headerArray.push({ name, value });
		}

		// Importante: O Chrome espera que o body seja codificado como base64
		// quando passado para fulfillRequest
		let base64Body: string;
		try {
			// Tenta codificar o corpo como base64
			base64Body = encodeBodyToBase64(mock.body);
			console.log('Body codificado em base64:', base64Body);
		} catch (encodeError) {
			console.error('Erro ao codificar corpo em base64:', encodeError);
			throw new Error(`Erro ao codificar corpo do mock para ${requestId}`);
		}

		// Obter o texto do status para o código
		const statusPhrase = getStatusText(mock.status);

		// Criar objeto de resposta para armazenar no histórico
		const responseObj: InterceptedResponse = {
			url: originalRequest.url,
			method: originalRequest.method,
			status: mock.status,
			statusText: statusPhrase,
			headers: mock.headers,
			mimeType: getMimeTypeFromHeaders(headerArray),
			type: 'mock',
			timestamp: Date.now(),
			body: mock.body,
			isMocked: true,
			request: { postData: originalRequest.postData },
		};

		// Envia a resposta mockada com o body corretamente codificado
		await sendDebuggerCommand('Fetch.fulfillRequest', {
			requestId,
			responseCode: mock.status,
			responsePhrase: statusPhrase,
			responseHeaders: headerArray,
			body: base64Body,
		});

		await persistRequest(requestId, responseObj);
		console.log(`Mock aplicado com sucesso para ${requestId}`);
	} catch (error) {
		const captureError = `Falha ao aplicar mock: ${getErrorMessage(error)}`;
		console.error(captureError, error);

		const failedMockRequest: InterceptedResponse = {
			url: originalRequest.url,
			method: originalRequest.method,
			status: originalRequest.responseStatusCode,
			statusText: getStatusText(originalRequest.responseStatusCode),
			headers: responseHeadersToObject(originalRequest.responseHeaders),
			mimeType: getMimeTypeFromHeaders(originalRequest.responseHeaders),
			type: originalRequest.resourceType,
			timestamp: Date.now(),
			request: { postData: originalRequest.postData },
			captureError,
		};

		await persistRequest(requestId, failedMockRequest);

		// Em caso de erro, tenta continuar a requisição original
		try {
			await continueRequest(requestId);
		} catch (continueError) {
			const continueMessage = getErrorMessage(continueError);
			console.error('Erro ao continuar requisição após falha do mock:', continueError);
			await patchRequest(requestId, {
				captureError: `${captureError}; falha ao continuar request: ${continueMessage}`,
			});
		}
	}
}

// Handle debugger detached event
chrome.debugger.onDetach.addListener((debuggeeId: chrome.debugger.Debuggee, reason: string) => {
	if (debuggeeId.tabId === attachedTabId) {
		console.log(`Debugger detached: ${reason}`);
		isDebugging = false;
		attachedTabId = null;
	}
});
