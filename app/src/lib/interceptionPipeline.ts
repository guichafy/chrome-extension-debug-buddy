// Pipeline de execução das chains casadas pela engine de matching (Phase 3
// da feature dual-stage). Cada applier encapsula UMA action e seus
// side-effects no CDP; `executeChain` orquestra um `PlannedAction[]` parando
// no primeiro terminal. Os appliers recebem um `ExecutionContext` injetado
// para que os testes mockem `sendDebuggerCommand`/`wait` sem precisar de
// `chrome.debugger`.
//
// Regra do projeto "no fallbacks" vale aqui: nenhum applier engole erros do
// CDP. Falha de fulfillRequest/failRequest/continueRequest sobe pro caller.

import { applyBodyOperations, applyHeaderOps, type PlannedAction } from '@/domain/intercepted';
import {
	encodeBodyToBase64,
	getHeaderValue,
	getHttpStatusPhrase,
	headersRecordToArray,
	validateMockBody,
} from '@/domain/http';
import type { AppliedType } from '@/types/intercepted';
import type {
	BlockAction,
	BreakpointAction,
	MockAction,
	RequestDelayAction,
	RequestModifyAction,
	ResponseModifyAction,
	Rule,
	RuleStage,
} from '@/types/rules';

export type Stage = RuleStage;

// Snapshot mutável que atravessa o chain no Request stage. Reflete o estado
// "vivo" da requisição após cada modifier — `applyRequestModify` retorna um
// snapshot novo que substitui o anterior dentro do `executeChain`.
export interface RequestSnapshot {
	url: string;
	method: string;
	headers: Record<string, string>;
	postData?: string;
}

// Snapshot equivalente para Response stage. `applyResponseModify` e os
// terminais que produzem resposta (mock) substituem o snapshot.
export interface ResponseSnapshot {
	status: number;
	statusPhrase: string;
	headers: Record<string, string>;
	body?: string;
}

// Entrada na fila de interceptações pendentes — gerada por breakpoint em
// qualquer stage. Substitui o `pendingResponses` legado e carrega contexto
// suficiente pra UI montar EditRequestSheet (stage='request') ou
// EditResponseSheet (stage='response'). Phase 5 finaliza a migração.
export interface PendingInterception {
	stage: Stage;
	requestId: string;
	ruleId: string;
	description?: string;
	url: string;
	method: string;
	request: {
		headers: Record<string, string>;
		postData?: string;
	};
	response?: ResponseSnapshot;
}

// Dependências externas que cada applier precisa. Injetadas para testabilidade.
// `sendDebuggerCommand` é o wrapper sobre `chrome.debugger.sendCommand`.
// `wait` é Promise<void> baseada em setTimeout.
// `enqueuePendingInterception` empurra pra fila do background (e dispara
// broadcast `newPendingInterception`).
export interface ExecutionContext {
	sendDebuggerCommand: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
	wait: (ms: number) => Promise<void>;
	enqueuePendingInterception: (entry: PendingInterception) => void;
}

export type TerminalKind = 'mock' | 'block' | 'breakpoint';

export interface ChainResult {
	terminated: boolean;
	terminalKind: TerminalKind | null;
	appliedTypes: AppliedType[];
	requestSnapshot: RequestSnapshot;
	responseSnapshot?: ResponseSnapshot;
	// Indica se algum applier (ou o release final do executor) já entregou um
	// comando CDP que libera o request pausado — useful para o caller decidir
	// se ainda precisa orquestrar pass-through.
	cdpReleased: boolean;
}

// ============================================================================
// Appliers — cada um lida com UMA action.
// ============================================================================

export async function applyRequestDelay(
	action: RequestDelayAction,
	ctx: ExecutionContext,
): Promise<void> {
	await ctx.wait(action.timeMs);
}

export function applyRequestModify(
	action: RequestModifyAction,
	snapshot: RequestSnapshot,
): RequestSnapshot {
	const url = action.url ?? snapshot.url;
	const method = action.method ?? snapshot.method;
	const headers = applyHeaderOps(snapshot.headers, action);

	let postData = snapshot.postData;
	if (action.body !== undefined) {
		postData = action.body;
	} else if (action.bodyOperations && action.bodyOperations.length > 0) {
		const result = applyBodyOperations(postData, action.bodyOperations);
		if (!result.ok) {
			throw new Error(result.error);
		}
		postData = result.body;
	}

	const next: RequestSnapshot = {
		url,
		method,
		headers,
		...(postData !== undefined ? { postData } : {}),
	};
	return next;
}

export async function applyRequestBlock(
	action: BlockAction,
	requestId: string,
	ctx: ExecutionContext,
): Promise<void> {
	await ctx.sendDebuggerCommand('Fetch.failRequest', {
		requestId,
		errorReason: action.errorReason,
	});
}

// Aplica mock no Request stage (curto-circuita a rede). Reusa a mesma lógica
// de Response stage pois a CDP Fetch.fulfillRequest é igual em ambos.
export async function applyRequestMock(
	action: MockAction,
	requestId: string,
	requestMethod: string,
	ctx: ExecutionContext,
): Promise<ResponseSnapshot> {
	return emitMockFulfill(action, requestId, requestMethod, ctx);
}

export function applyRequestBreakpoint(
	action: BreakpointAction,
	requestId: string,
	snapshot: RequestSnapshot,
	rule: Rule,
	ctx: ExecutionContext,
): void {
	const entry: PendingInterception = {
		stage: 'request',
		requestId,
		ruleId: rule.id,
		...(action.description ? { description: action.description } : {}),
		url: snapshot.url,
		method: snapshot.method,
		request: {
			headers: snapshot.headers,
			...(snapshot.postData !== undefined ? { postData: snapshot.postData } : {}),
		},
	};
	ctx.enqueuePendingInterception(entry);
}

export function applyResponseModify(
	action: ResponseModifyAction,
	snapshot: ResponseSnapshot,
): ResponseSnapshot {
	const status = action.status ?? snapshot.status;
	let statusPhrase: string;
	if (action.statusPhrase !== undefined) {
		statusPhrase = action.statusPhrase;
	} else if (action.status !== undefined) {
		statusPhrase = getHttpStatusPhrase(status);
	} else {
		statusPhrase = snapshot.statusPhrase;
	}
	const headers = applyHeaderOps(snapshot.headers, action);

	let body = snapshot.body;
	if (action.body !== undefined) {
		body = action.body;
	} else if (action.bodyOperations && action.bodyOperations.length > 0) {
		const result = applyBodyOperations(body, action.bodyOperations);
		if (!result.ok) {
			throw new Error(result.error);
		}
		body = result.body;
	}

	const next: ResponseSnapshot = {
		status,
		statusPhrase,
		headers,
		...(body !== undefined ? { body } : {}),
	};
	return next;
}

export async function applyResponseMock(
	action: MockAction,
	requestId: string,
	requestMethod: string,
	ctx: ExecutionContext,
): Promise<ResponseSnapshot> {
	return emitMockFulfill(action, requestId, requestMethod, ctx);
}

export function applyResponseBreakpoint(
	action: BreakpointAction,
	requestId: string,
	requestSnapshot: RequestSnapshot,
	responseSnapshot: ResponseSnapshot,
	rule: Rule,
	ctx: ExecutionContext,
): void {
	const entry: PendingInterception = {
		stage: 'response',
		requestId,
		ruleId: rule.id,
		...(action.description ? { description: action.description } : {}),
		url: requestSnapshot.url,
		method: requestSnapshot.method,
		request: {
			headers: requestSnapshot.headers,
			...(requestSnapshot.postData !== undefined ? { postData: requestSnapshot.postData } : {}),
		},
		response: responseSnapshot,
	};
	ctx.enqueuePendingInterception(entry);
}

// ============================================================================
// Helpers internos
// ============================================================================

async function emitMockFulfill(
	action: MockAction,
	requestId: string,
	requestMethod: string,
	ctx: ExecutionContext,
): Promise<ResponseSnapshot> {
	const headers = { ...action.headers };
	if (action.contentType && !getHeaderValue(headers, 'content-type')) {
		headers['Content-Type'] = action.contentType;
	}
	const headerArray = headersRecordToArray(headers);
	const bodyValidation = validateMockBody(requestMethod, action.status, action.body);
	const statusPhrase = getHttpStatusPhrase(action.status, action.statusPhrase);

	const params: Record<string, unknown> = {
		requestId,
		responseCode: action.status,
		responsePhrase: statusPhrase,
		responseHeaders: headerArray,
	};
	if (bodyValidation.shouldSendBody) {
		params.body = encodeBodyToBase64(bodyValidation.body);
	}

	await ctx.sendDebuggerCommand('Fetch.fulfillRequest', params);

	return {
		status: action.status,
		statusPhrase,
		headers,
		...(bodyValidation.shouldSendBody ? { body: bodyValidation.body } : {}),
	};
}

async function emitResponseFulfill(
	requestId: string,
	snapshot: ResponseSnapshot,
	ctx: ExecutionContext,
): Promise<void> {
	const params: Record<string, unknown> = {
		requestId,
		responseCode: snapshot.status,
		responsePhrase: snapshot.statusPhrase,
		responseHeaders: headersRecordToArray(snapshot.headers),
	};
	if (snapshot.body !== undefined) {
		params.body = encodeBodyToBase64(snapshot.body);
	}
	await ctx.sendDebuggerCommand('Fetch.fulfillRequest', params);
}

// Comparação rasa de records. Usada para decidir se enviamos o campo
// `headers` no payload de Fetch.continueRequest (CDP só aceita headers se
// realmente mudaram — enviar mesma lista é desperdício e dispara o CDP a
// reprocessar a request paused).
function shallowEqualHeaders(
	a: Record<string, string>,
	b: Record<string, string>,
): boolean {
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (const k of ka) {
		if (a[k] !== b[k]) return false;
	}
	return true;
}

// ============================================================================
// Orchestrator
// ============================================================================

export async function executeChain(
	plan: PlannedAction[],
	requestId: string,
	stage: Stage,
	initial: { request: RequestSnapshot; response?: ResponseSnapshot },
	ctx: ExecutionContext,
): Promise<ChainResult> {
	let requestSnapshot = initial.request;
	let responseSnapshot = initial.response;
	const appliedTypes: AppliedType[] = [];
	let terminated = false;
	let terminalKind: TerminalKind | null = null;
	let cdpReleased = false;
	let responseTouchedByModify = false;

	for (const planned of plan) {
		if (terminated) break;
		const { action, rule } = planned;

		switch (action.type) {
			case 'requestDelay': {
				await applyRequestDelay(action, ctx);
				appliedTypes.push('latency');
				break;
			}
			case 'requestModify': {
				requestSnapshot = applyRequestModify(action, requestSnapshot);
				appliedTypes.push('requestModify');
				break;
			}
			case 'block': {
				await applyRequestBlock(action, requestId, ctx);
				appliedTypes.push('block');
				terminated = true;
				terminalKind = 'block';
				cdpReleased = true;
				break;
			}
			case 'mock': {
				const mockSnap =
					stage === 'request'
						? await applyRequestMock(action, requestId, requestSnapshot.method, ctx)
						: await applyResponseMock(action, requestId, requestSnapshot.method, ctx);
				responseSnapshot = mockSnap;
				appliedTypes.push('mock');
				terminated = true;
				terminalKind = 'mock';
				cdpReleased = true;
				break;
			}
			case 'breakpoint': {
				if (stage === 'request') {
					applyRequestBreakpoint(action, requestId, requestSnapshot, rule, ctx);
					appliedTypes.push('requestBreakpoint');
				} else {
					if (!responseSnapshot) {
						throw new Error(
							'executeChain: response snapshot ausente — breakpoint no Response stage exige resposta capturada.',
						);
					}
					applyResponseBreakpoint(action, requestId, requestSnapshot, responseSnapshot, rule, ctx);
					appliedTypes.push('responseBreakpoint');
				}
				terminated = true;
				terminalKind = 'breakpoint';
				// cdpReleased fica false — quem libera é a UI ao aprovar.
				break;
			}
			case 'responseModify': {
				if (!responseSnapshot) {
					throw new Error(
						'executeChain: response snapshot ausente — responseModify exige resposta capturada.',
					);
				}
				responseSnapshot = applyResponseModify(action, responseSnapshot);
				appliedTypes.push('responseModify');
				responseTouchedByModify = true;
				break;
			}
			case 'transform': {
				// Phase 3: transform continua tratado pelo `applyTransformResponse`
				// existente no background. Mantemos a porta aberta — quando o caller
				// integrar transform no chain, este case deixará de jogar.
				throw new Error(
					'executeChain: transform ainda é orquestrado pelo applyTransformResponse legado.',
				);
			}
		}
	}

	// Plan vazio = caller orquestra pass-through (continueRequest sem mods no
	// Request stage, continueRequest no Response stage). Executor não emite
	// nada para não duplicar.
	if (!terminated && !cdpReleased && plan.length > 0) {
		if (stage === 'request') {
			const params: Record<string, unknown> = { requestId };
			if (requestSnapshot.url !== initial.request.url) params.url = requestSnapshot.url;
			if (requestSnapshot.method !== initial.request.method) params.method = requestSnapshot.method;
			if (requestSnapshot.postData !== initial.request.postData) {
				params.postData = requestSnapshot.postData;
			}
			if (!shallowEqualHeaders(requestSnapshot.headers, initial.request.headers)) {
				params.headers = headersRecordToArray(requestSnapshot.headers);
			}
			await ctx.sendDebuggerCommand('Fetch.continueRequest', params);
			cdpReleased = true;
		} else if (responseTouchedByModify && responseSnapshot) {
			await emitResponseFulfill(requestId, responseSnapshot, ctx);
			cdpReleased = true;
		}
	}

	return {
		terminated,
		terminalKind,
		appliedTypes,
		requestSnapshot,
		...(responseSnapshot !== undefined ? { responseSnapshot } : {}),
		cdpReleased,
	};
}
