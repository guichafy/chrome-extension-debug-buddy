import type { Protocol } from 'devtools-protocol/types/protocol';
import { indexedDBService } from '@/lib/indexedDB';
import {
	runEnabledBackfillMigration,
	runLegacyMigration,
	runModifyToTransformMigration,
} from '@/lib/legacyMigration';
import { NetworkTimingTracker } from '@/lib/networkTiming';
import { recorder } from '@/lib/session/recorder';
import { serializeSession } from '@/lib/session/exporter';
import { parseDbsession } from '@/lib/session/importer';
import { getRecordingDisabled, setRecordingDisabled } from '@/lib/session/recordingPreference';
import { stripBodyFields } from '@/lib/session/sessionNetworkAdapter';
import { resolveCallsite } from '@/lib/session/sourceMap';
import { sessionStore } from '@/lib/session/storage';
import { purgeOldSessions } from '@/lib/session/privacy/autoPurge';
import { redactBody } from '@/lib/session/privacy/bodyRedactor';
import { getPrivacyConfig, setPrivacyConfig } from '@/lib/session/privacy/config';
import { redactConsoleArgs } from '@/lib/session/privacy/consoleRedactor';
import { redactHeaders } from '@/lib/session/privacy/headerRedactor';
import { truncatePath } from '@/lib/session/privacy/pathTruncator';
import { redactState } from '@/lib/session/privacy/stateRedactor';
import { shouldIgnoreUrl } from '@/lib/session/privacy/urlGate';
import type {
	AntipatternHit,
	ConsoleArgPreview,
	ConsoleLevel,
	ConsoleStackFrame,
	PageDetection,
	RedactionConfig,
	RrwebEvent,
	Session,
	SessionEvent,
} from '@/lib/session/types';
import type {
	AppliedType,
	InterceptedResponse,
	MessageResponse,
	MockAction,
	ResponseModifications,
	Rule,
	TransformAction,
} from '@/types';
import type { MatchedRuleAction } from '@/domain/ruleMatching';
import { EMPTY_SESSION_MARKER, type SessionMarker } from '@/types/sessionMarker';
import {
	encodeBodyToBase64,
	getCaptureBodyUnavailableReason,
	getHeaderValue,
	getHttpStatusPhrase,
	getOptionalMimeTypeFromHeaders,
	headersArrayToRecord,
	headersRecordToArray,
	requestHeadersToRecord,
	validateMockBody,
} from '@/domain/http';
import { resolveMockLatencyMs, wait } from '@/domain/mockLatency';
import { findMatchingRuleAction } from '@/domain/ruleMatching';
import { applyTransformToBody } from '@/domain/transformExecutor';

// Global variables
let isDebugging = false;
let attachedTabId: number | null = null;
let rules: Rule[] = [];
let pendingResponses: Record<string, InterceptedResponse> = {}; // Store intercepted responses
let allRequests: Record<string, InterceptedResponse> = {}; // Store all requests
// Variáveis globais para rastrear abas
let interceptorTabId: number | null = null;
let targetTabId: number | null = null;
let targetTabTitle = '';
let targetTabUrl = '';
// `targetTabClosed` é true quando a aba alvo foi fechada (pelo usuário, navegador
// ou por descarte) e ainda não foi substituída. Mantemos title/url do último
// estado conhecido para que a UI possa mostrar "Aba indisponível: <título>".
let targetTabClosed = false;

// SessionMarker: dois pontos de tempo que delimitam as janelas "Sessão" e
// "Página atual" exibidas pelo NetworkMetricsBar do header. Persistido em
// chrome.storage.local pra sobreviver ao reload do service worker (MV3).
let sessionMarker: SessionMarker = { ...EMPTY_SESSION_MARKER };

// privacyConfig em cache local. Carregado de chrome.storage.local no boot e
// recarregado em chrome.storage.onChanged. Quando null (boot ainda não
// terminou), os capture sites pulam a redação — best-effort, não falha.
let livePrivacyConfig: RedactionConfig | null = null;

async function reloadPrivacyConfig(): Promise<void> {
	try {
		livePrivacyConfig = await getPrivacyConfig();
	} catch (err) {
		console.warn('[privacy] reloadPrivacyConfig falhou:', err);
	}
}

void reloadPrivacyConfig();

// --- Session Replay — helpers CDP Runtime/Log ---

function mapConsoleApiType(type: Protocol.Runtime.ConsoleAPICalledEvent['type']): ConsoleLevel {
	const map: Record<string, ConsoleLevel> = {
		log: 'log',
		debug: 'debug',
		info: 'info',
		error: 'error',
		warning: 'warn',
		dir: 'dir',
		dirxml: 'dir',
		table: 'table',
		trace: 'trace',
		clear: 'clear',
		startGroup: 'group',
		startGroupCollapsed: 'groupCollapsed',
		endGroup: 'groupEnd',
		assert: 'assert',
		profile: 'log',
		profileEnd: 'log',
		count: 'count',
		timeEnd: 'timeEnd',
	};
	return map[type] ?? 'log';
}

function toArgPreview(obj: Protocol.Runtime.RemoteObject): ConsoleArgPreview {
	const out: ConsoleArgPreview = {
		type: (obj.type ?? 'string') as ConsoleArgPreview['type'],
		description: obj.description ?? String(obj.value ?? ''),
	};
	if (obj.preview) {
		out.preview = {
			properties: obj.preview.properties.map((p) => ({
				name: p.name,
				type: p.type,
				value: p.value,
			})),
			overflow: obj.preview.overflow ?? false,
		};
	}
	return out;
}

function toStackFrames(
	stack?: Protocol.Runtime.StackTrace,
): { frames: ConsoleStackFrame[] } | undefined {
	if (!stack) return undefined;
	return {
		frames: stack.callFrames.map((f) => ({
			url: f.url,
			lineNumber: f.lineNumber,
			columnNumber: f.columnNumber,
			functionName: f.functionName,
		})),
	};
}

function currentPhaseId(session: Session): string {
	const last = session.detectionPhases[session.detectionPhases.length - 1];
	if (!last) {
		throw new Error(
			`Session ${session.id}: nenhuma DetectionPhase ainda — evento sendo emitido antes da primeira pageDetected`,
		);
	}
	return last.id;
}

function mapLogLevel(level: Protocol.Log.LogEntry['level']): ConsoleLevel {
	if (level === 'error') return 'error';
	if (level === 'warning') return 'warn';
	if (level === 'info') return 'info';
	return 'debug';
}

function mapLogSource(source: Protocol.Log.LogEntry['source']): 'browser' | 'security' {
	return source === 'security' ? 'security' : 'browser';
}

async function handleConsoleAPI(
	session: Session,
	params: Protocol.Runtime.ConsoleAPICalledEvent,
): Promise<void> {
	const event: SessionEvent = {
		type: 'console',
		// CDP timestamp em segundos com fração; multiplicamos por 1 (ms compatível com Date.now da app).
		timestamp: params.timestamp,
		phaseId: currentPhaseId(session),
		source: 'app',
		level: mapConsoleApiType(params.type),
		args: params.args.map(toArgPreview),
		stackTrace: toStackFrames(params.stackTrace),
	};
	if (livePrivacyConfig) {
		event.args = redactConsoleArgs(event.args, livePrivacyConfig);
		if (event.stackTrace && livePrivacyConfig.truncateUserPaths) {
			event.stackTrace.frames = event.stackTrace.frames.map((f) => ({
				...f,
				url: truncatePath(f.url),
			}));
		}
	}
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent console falhou:', err);
	}
}

async function handleExceptionThrown(
	session: Session,
	params: Protocol.Runtime.ExceptionThrownEvent,
): Promise<void> {
	const det = params.exceptionDetails;
	const rawMessage = det.exception?.description ?? det.text ?? 'Exception';
	// Phase 6: aplica bodyRedactor na mensagem da exception. Mensagens de erro
	// frequentemente carregam payload sensível ("Error: invalid token eyJ...",
	// "SQLException: SELECT ... password='abc'"). Sem isso, a redaction de
	// network/console deixaria um vazamento via stack-trace error events.
	const message =
		livePrivacyConfig && livePrivacyConfig.enabled
			? redactBody(rawMessage, livePrivacyConfig)
			: rawMessage;
	const event: SessionEvent = {
		type: 'error',
		timestamp: params.timestamp,
		phaseId: currentPhaseId(session),
		message,
		stackTrace: toStackFrames(det.stackTrace),
	};
	if (livePrivacyConfig?.truncateUserPaths && event.stackTrace) {
		event.stackTrace.frames = event.stackTrace.frames.map((f) => ({
			...f,
			url: truncatePath(f.url),
		}));
	}
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent error falhou:', err);
	}
}

async function handleLogEntry(
	session: Session,
	params: Protocol.Log.EntryAddedEvent,
): Promise<void> {
	const e = params.entry;
	const event: SessionEvent = {
		type: 'console',
		timestamp: e.timestamp,
		phaseId: currentPhaseId(session),
		source: mapLogSource(e.source),
		level: mapLogLevel(e.level),
		args: [{ type: 'string', description: e.text }],
		stackTrace: toStackFrames(e.stackTrace),
	};
	if (livePrivacyConfig) {
		event.args = redactConsoleArgs(event.args, livePrivacyConfig);
		if (event.stackTrace && livePrivacyConfig.truncateUserPaths) {
			event.stackTrace.frames = event.stackTrace.frames.map((f) => ({
				...f,
				url: truncatePath(f.url),
			}));
		}
	}
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent log falhou:', err);
	}
}

// --- fim helpers CDP Runtime/Log ---

// --- Session Replay — network event helper ---

// Resolve callsite via source map quando o detector populou hit.context.callsite
// com o raw frame. Falha silenciosamente (mantém o raw) — é informativo, não
// bloqueante. NÃO inventa valores: se resolveCallsite lança, o callsite original
// já está intacto na hit (sem fallback).
async function tryResolveHitCallsite(hit: AntipatternHit): Promise<void> {
	if (!hit.context.callsite?.raw) return;
	try {
		hit.context.callsite = await resolveCallsite(hit.context.callsite.raw);
	} catch (err) {
		console.warn('[antipattern] resolveCallsite falhou:', err);
	}
	// Pós-resolução: trunca paths absolutos com username (Phase 6).
	if (livePrivacyConfig?.truncateUserPaths && hit.context.callsite) {
		hit.context.callsite.raw.file = truncatePath(hit.context.callsite.raw.file);
		if (hit.context.callsite.resolved) {
			hit.context.callsite.resolved.file = truncatePath(hit.context.callsite.resolved.file);
		}
	}
}

// Aplica redação em headers (resposta + requisição) e body de um InterceptedResponse.
// Muta in-place para minimizar custo — a InterceptedResponse já é construída neste
// frame (não há leitor concorrente). Chamado antes de persistRequest e
// emitNetworkEventForSession nos pontos de captura.
function applyPrivacyToInterceptedResponse(resp: InterceptedResponse): void {
	const cfg = livePrivacyConfig;
	if (!cfg || !cfg.enabled) return;
	resp.headers = redactHeaders(resp.headers, cfg);
	if (resp.response?.headers) {
		resp.response.headers = redactHeaders(resp.response.headers, cfg);
	}
	if (resp.request?.headers) {
		resp.request.headers = redactHeaders(resp.request.headers, cfg);
	}
	if (typeof resp.body === 'string') {
		resp.body = redactBody(resp.body, cfg);
	}
	if (typeof resp.response?.body === 'string') {
		resp.response.body = redactBody(resp.response.body, cfg);
	}
	if (typeof resp.request?.postData === 'string') {
		resp.request.postData = redactBody(resp.request.postData, cfg);
	}
}

async function emitNetworkEventForSession(
	tabId: number,
	requestId: string,
	request: InterceptedResponse,
): Promise<void> {
	if (!request.method) {
		console.warn(`[session] NetworkEvent: method ausente para ${requestId}, ignorando`);
		return;
	}

	const session = await recorder.getActiveByTab(tabId);

	// Construímos o NetworkEvent uma vez. phaseId só faz sentido quando há sessão
	// gravada (modo passivo não tem detection phases) — usamos string vazia como
	// marcador "sem fase" no buffer da engine; detectores não dependem de phaseId
	// para detecção, apenas para popular o hit.
	const event: SessionEvent = {
		type: 'network',
		timestamp: request.timestamp,
		phaseId: session ? currentPhaseId(session) : '',
		requestId,
		method: request.method,
		url: request.url,
		status: request.status,
		durationMs: request.duration,
		// Snapshot SLIM (sem body) — Replay table só usa metadata. Body completo
		// inflaria a sessão até crash em ~120 requests pesadas. Ver stripBodyFields
		// para detalhe. applyPrivacyToInterceptedResponse já rodou em persistRequest.
		request: stripBodyFields(request),
	};

	if (session) {
		try {
			await recorder.addEvent(session.id, event);
		} catch (err) {
			console.warn('[session] addEvent network falhou:', err);
		}
	}

	// Antipattern engine — gravado vs passivo. Esta é uma HOT path; nenhum erro
	// aqui pode quebrar a interceptação. Tudo é envolvido em try/catch defensivo.
	try {
		if (session) {
			const hits = recorder.pushNetworkForAntipatterns(session.id, event);
			for (const hit of hits) {
				await tryResolveHitCallsite(hit);
				try {
					await recorder.addAntipatternHit(session.id, hit);
				} catch (err) {
					console.warn('[antipattern] addAntipatternHit falhou:', err);
				}
				broadcastToUI('liveAntipatternHit', { tabId, antipatternHit: hit });
			}
		} else {
			// Modo passivo: roda engine só se interceptação está ativa nesta tab.
			if (isDebugging && attachedTabId === tabId) {
				const eng = recorder.getOrCreatePassiveEngineForTab(tabId);
				const hits = eng.pushEvent(event);
				for (const hit of hits) {
					await tryResolveHitCallsite(hit);
					broadcastToUI('liveAntipatternHit', { tabId, antipatternHit: hit });
				}
			}
		}
	} catch (err) {
		console.warn('[antipattern] engine pipeline error:', err);
	}
}

// --- fim network event helper ---

function broadcastSessionMarker(): void {
	broadcastToUI('sessionMarkerUpdated', { sessionMarker });
}

async function persistSessionMarker(): Promise<void> {
	try {
		await chrome.storage.local.set({ sessionMarker });
	} catch (err) {
		console.error('Erro ao persistir sessionMarker:', err);
	}
}

async function loadSessionMarker(): Promise<void> {
	try {
		const result = await chrome.storage.local.get(['sessionMarker']);
		if (result.sessionMarker) {
			sessionMarker = result.sessionMarker;
		}
	} catch (err) {
		console.error('Erro ao carregar sessionMarker:', err);
	}
}

// Background é a fonte de verdade da persistência. `persistRequest` grava
// no in-memory cache + IndexedDB e broadcasta `newRequest` para a UI; quando
// updates parciais chegam (ex.: duration assíncrono ou aprovação após dialog),
// `patchRequest` mescla, persiste e broadcasta `requestUpdated`. Não dependemos
// mais da UI estar montada para persistir — assim, navegar entre rotas durante
// interceptação não perde dado (era a causa raiz do "request interceptada some
// do histórico" e do issue #4).

// Prioridade de matching: o array `rules` é a ordem oficial de avaliação.
// `findMatchingRuleAction` (em `domain/ruleMatching`) itera nessa mesma
// ordem e devolve a PRIMEIRA regra cuja matcher casa o request — "primeira
// que casa vence". A ordem do array reflete o que o usuário vê e arrasta na
// UI; `chrome.storage.onChanged` reabsorve a nova ordem em tempo real.
// Regras com `enabled === false` ou `action.enabled === false` são puladas
// e não bloqueiam regras subsequentes.

function broadcastToUI(action: string, payload: Record<string, unknown>): void {
	if (interceptorTabId === null) return;
	chrome.tabs.sendMessage(interceptorTabId, { action, ...payload }).catch(() => {
		// UI fechada ou navegando — sem problema; o IndexedDB já tem o dado.
	});
}

// Eventos de ciclo de vida da aba alvo precisam alcançar tanto a página de
// opções quanto o side panel. `broadcastToUI` só atinge o `interceptorTabId`,
// então também emitimos via `chrome.runtime.sendMessage` para que qualquer
// extension page aberta (options + sidepanel) receba o update.
function broadcastTargetTabState(
	action: 'targetTabSelected' | 'targetTabUpdated' | 'targetTabClosed',
): void {
	const payload = {
		tabId: targetTabId,
		tabTitle: targetTabTitle,
		tabUrl: targetTabUrl,
	};
	broadcastToUI(action, payload);
	chrome.runtime.sendMessage({ action, ...payload }).catch(() => {
		// Sem listener ativo (todas as UIs fechadas) — o storage permanece como
		// fonte de verdade e o próximo mount lerá `targetTabInfo`.
	});
}

// Igual a `broadcastTargetTabState`: alcança options + sidepanel via
// runtime.sendMessage além de tabs.sendMessage(interceptorTabId).
function broadcastRecordingState(payload: {
	tabId: number;
	active: boolean;
	sessionId?: string;
}): void {
	broadcastToUI('recordingStateChanged', payload);
	chrome.runtime.sendMessage({ action: 'recordingStateChanged', ...payload }).catch(() => {
		// Sem listener ativo — o polling de 1s do useRecording cobre.
	});
}

function persistTargetTabInfo(): void {
	chrome.storage.local.set({
		targetTabInfo: {
			id: targetTabId,
			title: targetTabTitle,
			url: targetTabUrl,
			closed: targetTabClosed,
		},
	});
}

async function persistRequest(requestId: string, request: InterceptedResponse): Promise<void> {
	// Aplica redaction defensiva — todos os caminhos de captura passam por aqui
	// (handleRequestPaused, applyMockResponse, applyTransformResponse, approve).
	// In-place, idempotente — repetir é seguro porque [REDACTED] não casa as regex.
	applyPrivacyToInterceptedResponse(request);
	allRequests[requestId] = request;
	// IMPORTANTE: broadcast ANTES do await IDB. UI precisa de reatividade
	// instantânea — sessions store (que cresce com cada request) cria
	// contenção na conexão IDB compartilhada e atrasa o saveRequest. Sem
	// este reorder, requests aparecem em lote no Command Center.
	// Trade-off: extensão recarregada entre broadcast e save = request fica
	// só em memória (allRequests[id]) e não em IDB. Aceitável — recarga
	// durante debug é raro e o dado em memória já é mostrado ao usuário.
	broadcastToUI('newRequest', { requestId, request });
	try {
		await indexedDBService.saveRequest(requestId, request);
	} catch (err) {
		console.error(`Erro ao salvar requisição ${requestId} no IndexedDB:`, err);
	}
}

async function patchRequest(
	requestId: string,
	updates: Partial<InterceptedResponse>,
): Promise<void> {
	const existing = allRequests[requestId];
	if (!existing) return;
	const merged = { ...existing, ...updates };
	allRequests[requestId] = merged;
	// Mesmo padrão de persistRequest: broadcast ANTES do await IDB pra
	// preservar reatividade no Command Center sob contenção do sessions store.
	broadcastToUI('requestUpdated', { requestId, updates });
	try {
		await indexedDBService.saveRequest(requestId, merged);
	} catch (err) {
		console.error(`Erro ao atualizar requisição ${requestId} no IndexedDB:`, err);
	}

	// Espelhar updates relevantes no snapshot da sessão ativa. Necessário porque
	// approve/modify de breakpoint chega DEPOIS do emitNetworkEventForSession —
	// sem este espelhamento, o Replay viewer mostraria forever-pending com body
	// original. Cobre também duration assíncrono (NetworkTimingTracker callback).
	// Roda detached do main flow (não bloqueia a resposta UI), e é idempotente.
	if (attachedTabId !== null) {
		const tabId = attachedTabId;
		(async () => {
			try {
				const session = await recorder.getActiveByTab(tabId);
				if (!session) return;
				await recorder.patchNetworkEventRequest(session.id, requestId, updates);
			} catch (err) {
				console.warn('[session] patchNetworkEventRequest falhou:', err);
			}
		})();
	}
}

const timingTracker = new NetworkTimingTracker(
	(fetchRequestId, duration) => {
		patchRequest(fetchRequestId, { duration, durationSource: 'network' });
	},
	(fetchRequestId, networkTiming) => {
		patchRequest(fetchRequestId, { networkTiming });
	},
);

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
	console.log(`[background] onInstalled: ${details.reason}`);
	const result = await runLegacyMigration();
	if (result.migrated) {
		console.log('[background] Legacy storage migrated to rules format.');
	}
	const transformResult = await runModifyToTransformMigration();
	if (transformResult.migrated) {
		console.log(`[background] Renamed ${transformResult.renamed} modify rules to transform.`);
	}
	const enabledResult = await runEnabledBackfillMigration();
	if (enabledResult.migrated) {
		console.log(`[background] Backfilled enabled em ${enabledResult.backfilled} regras.`);
	}
	try {
		const cfg = await getPrivacyConfig();
		if (cfg.autoPurgeEnabled) {
			const deleted = await purgeOldSessions(cfg.autoPurgeRetentionDays);
			console.log(`[debug-buddy] auto-purge (onInstalled): ${deleted} sessões deletadas`);
		}
	} catch (err) {
		console.warn('[debug-buddy] auto-purge (onInstalled) falhou:', err);
	}
});

// Roda a migração também no startup do navegador (extensão já instalada).
// Idempotente — cada runner checa seu próprio flag antes de agir.
chrome.runtime.onStartup.addListener(async () => {
	console.log('[background] onStartup');
	await runLegacyMigration();
	await runModifyToTransformMigration();
	await runEnabledBackfillMigration();
	try {
		const cfg = await getPrivacyConfig();
		if (cfg.autoPurgeEnabled) {
			const deleted = await purgeOldSessions(cfg.autoPurgeRetentionDays);
			console.log(`[debug-buddy] auto-purge: ${deleted} sessões deletadas`);
		}
	} catch (err) {
		console.warn('[debug-buddy] auto-purge (onStartup) falhou:', err);
	}
});

// Listener para mudanças no storage (para atualizar regras em tempo real)
chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace !== 'local') return;
	if (changes.rules) {
		rules = changes.rules.newValue || [];
		console.log(`Regras atualizadas: ${rules.length} regras carregadas`);
	}
	if (changes.privacyConfig) {
		void reloadPrivacyConfig();
	}
});

// Carregar informações da aba alvo do armazenamento quando o background script é iniciado
chrome.storage.local.get(['targetTabInfo'], async (result) => {
	if (!result.targetTabInfo) return;
	const info = result.targetTabInfo as {
		id: number | null;
		title?: string;
		url?: string;
		closed?: boolean;
	};
	targetTabTitle = info.title || '';
	targetTabUrl = info.url || '';
	console.log('Informações da aba alvo carregadas do armazenamento:', info);

	// Se já estava marcada como fechada, mantemos o estado e não revalidamos.
	if (info.closed === true || typeof info.id !== 'number') {
		targetTabId = null;
		targetTabClosed = info.closed === true;
		return;
	}

	// Revalida com o navegador: o service worker pode ter sido reiniciado
	// enquanto a aba era fechada, e nesse caso `chrome.tabs.onRemoved` não
	// rodou para o nosso listener. Sem essa checagem, a UI mostraria a aba
	// antiga como disponível e `Iniciar Interceptação` falharia mais tarde.
	//
	// Setamos `targetTabId` ANTES do await para que `chrome.tabs.onRemoved`
	// (registrado no top-level deste módulo) consiga detectar fechamento
	// concorrente durante a janela `chrome.tabs.get`. Após o await, checamos
	// se `targetTabClosed` foi flipado durante a espera — se sim, o estado
	// do listener vence e não sobrescrevemos.
	const candidateId = info.id;
	targetTabId = candidateId;
	try {
		const tab = await chrome.tabs.get(candidateId);
		if (targetTabClosed || targetTabId !== candidateId) {
			// `onRemoved` (ou outro evento) já tomou conta do estado; não sobrescreve.
			return;
		}
		if (tab.title) targetTabTitle = tab.title;
		if (tab.url) targetTabUrl = tab.url;
		persistTargetTabInfo();
	} catch {
		console.log(`Aba alvo persistida (id=${candidateId}) não existe mais — marcando como fechada`);
		// Se `onRemoved` já tratou, não duplica trabalho; senão, marca como fechada.
		if (targetTabClosed) return;
		targetTabId = null;
		targetTabClosed = true;
		persistTargetTabInfo();
	}
});

// Restaura o sessionMarker persistido para que a UI veja os números congelados
// da última sessão mesmo após o SW ser reciclado.
loadSessionMarker();

// Support for hot reload during development
if (import.meta.env.MODE !== 'production') {
	console.log('Running in development mode with hot reload support');
}

// Abrir a janela do interceptor quando o usuário clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
	chrome.tabs.create(
		{
			url: chrome.runtime.getURL('options.html'),
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

// Quando uma aba é fechada, verificar se é a aba do interceptor ou a aba alvo.
chrome.tabs.onRemoved.addListener((tabId) => {
	// Engines passivas são por-tab; ao fechar a tab, libera memória mesmo se a
	// tab fechada não era a target — é no-op se nunca houve engine pra ela.
	recorder.clearPassiveEngineForTab(tabId);

	if (tabId === interceptorTabId) {
		console.log('Aba do interceptor fechada, parando debugging');
		interceptorTabId = null;

		// Parar debugging se estiver ativo
		if (isDebugging && attachedTabId !== null) {
			stopDebugging().catch(console.error);
		}
	}

	if (tabId === targetTabId) {
		console.log(`Aba alvo (id=${tabId}) foi fechada — sinalizando indisponibilidade à UI`);
		targetTabId = null;
		targetTabClosed = true;
		persistTargetTabInfo();
		broadcastTargetTabState('targetTabClosed');
		// `chrome.debugger.onDetach` cuidará de limpar `isDebugging`/`attachedTabId`
		// quando a aba alvo era a que estava com o debugger anexado.
	}
});

// Manter title/url em sincronia conforme o usuário navega na aba alvo.
// Sem isso, o botão de seleção exibe um título/URL congelados da hora do pick.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (tabId !== targetTabId) return;

	let changed = false;
	const nextUrl = changeInfo.url ?? (tab.url && tab.url !== targetTabUrl ? tab.url : undefined);
	if (nextUrl && nextUrl !== targetTabUrl) {
		targetTabUrl = nextUrl;
		changed = true;
	}

	const nextTitle =
		changeInfo.title ?? (tab.title && tab.title !== targetTabTitle ? tab.title : undefined);
	if (nextTitle && nextTitle !== targetTabTitle) {
		targetTabTitle = nextTitle;
		changed = true;
	}

	if (changed) {
		persistTargetTabInfo();
		broadcastTargetTabState('targetTabUpdated');
	}
});

// Re-detecção em navegação real: quando o usuário navega na tab alvo (full page load
// ou SPA que dispara onCommitted), sinaliza o probe para emitir uma nova detection
// com triggerType='navigation'. O probe já foi re-injetado pelo content_script via
// document_start; o sendMessage apenas dispara o início do scan.
chrome.webNavigation.onCommitted.addListener(async (details) => {
	if (details.frameId !== 0) return; // só top frame — ignora iframes
	const session = await recorder.getActiveByTab(details.tabId);
	if (!session) return;

	// 1. Emite RouteChangeEvent para a sessão ativa.
	try {
		const routeEvent: SessionEvent = {
			type: 'route',
			timestamp: details.timeStamp,
			phaseId: currentPhaseId(session),
			url: details.url,
			triggerType: 'navigation',
		};
		await recorder.addEvent(session.id, routeEvent);
	} catch (err) {
		console.warn('[session] addEvent route (webNavigation) falhou:', err);
	}

	// 2. Sinaliza o probe daquela tab pra começar a emitir detections.
	try {
		await chrome.tabs.sendMessage(details.tabId, {
			action: 'probeStartDetection',
			reason: 'navigation',
		});
	} catch (err) {
		// Casos esperados: tab fechada entre evento e sendMessage, OR bridge ainda
		// não injetado (race com document_start). Ambos não-actionables.
		const msg = String(err);
		if (
			msg.includes('Could not establish connection') ||
			msg.includes('The tab was closed') ||
			msg.includes('No tab with id')
		) {
			// Esperado e silencioso.
			return;
		}
		console.warn(`[session] probeStartDetection inesperado em tab ${details.tabId}:`, err);
	}

	// 3. Re-inicia rrweb no novo documento — content_script é re-injetado pelo Chrome
	// em document_start, mas precisa receber __rrweb_start de novo (probe é idle até
	// receber a mensagem). recordCanvas vem da metadata da sessão ativa.
	try {
		await chrome.tabs.sendMessage(details.tabId, {
			action: '__rrweb_start',
			sessionId: session.id,
			recordCanvas: session.metadata.canvasCaptureEnabled,
			maskTextSelector: livePrivacyConfig?.rrwebMaskTextSelector,
			maskAllInputs: livePrivacyConfig?.rrwebMaskAllInputs,
		});
	} catch (err) {
		const msg = String(err);
		if (
			msg.includes('Could not establish connection') ||
			msg.includes('The tab was closed') ||
			msg.includes('No tab with id')
		) {
			return;
		}
		console.warn(`[session] __rrweb_start em navegação inesperado em tab ${details.tabId}:`, err);
	}
});

// Listen for messages from the popup or hot reload
chrome.runtime.onMessage.addListener(
	(message: any, sender, sendResponse: (response: MessageResponse) => void) => {
		// Mensagens roteadas para o offscreen document não devem ser tratadas
		// pelo service worker — o offscreen tem seu próprio listener e disputa
		// pelo sendResponse causaria respostas perdidas/duplicadas.
		if (message && typeof message === 'object' && message.target === 'offscreen') {
			return false;
		}

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

		if (message.action === 'startDebugging') {
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
				targetTabClosed = false;

				persistTargetTabInfo();
				broadcastTargetTabState('targetTabSelected');

				sendResponse({ success: true });
			} else {
				sendResponse({ success: false, error: 'ID da aba não fornecido' });
			}
			return false; // Indicates we've responded synchronously
		} else if (message.action === 'clearAllRequests') {
			allRequests = {};
			// Se ainda estamos debugando, re-anchora a sessão para "agora": o usuário
			// quer ver as próximas requests, não congelar o histórico em branco.
			// Quando não há debug ativo, zera tudo (próximo startDebugging seta novamente).
			if (isDebugging) {
				sessionMarker = {
					sessionStartedAt: Date.now(),
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				};
			} else {
				sessionMarker = { ...EMPTY_SESSION_MARKER };
			}
			persistSessionMarker();
			broadcastSessionMarker();
			indexedDBService
				.clearAllRequests()
				.then(() => sendResponse({ success: true }))
				.catch((err) => {
					console.error('Erro ao limpar IndexedDB:', err);
					sendResponse({ success: false, error: String(err) });
				});
			return true; // resposta assíncrona
		} else if (message.action === 'getSessionMarker') {
			sendResponse({ sessionMarker });
			return false;
		} else if (message.action === 'approveResponse') {
			const { requestId, modifications } = message;

			console.log('background.ts - Received approveResponse message:', JSON.stringify(message));
			if (modifications && modifications.status !== undefined) {
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
				if (modifications.status !== undefined) {
					modifications.status = Number(modifications.status);
					console.log(
						`background.ts - Converted status code: ${modifications.status}, type: ${typeof modifications.status}`,
					);
				}

				applyResponseModifications(requestId, modifications)
					.then(() => {
						const pendingResponse = pendingResponses[requestId];
						delete pendingResponses[requestId];
						// Filtra undefined: spread cego do `modifications` poderia apagar
						// `headers`/`body` originais se o usuário só alterou `status`.
						// Marcamos editedAtRuntime para que o histórico distinga
						// "aprovada com modificação" de "aprovada/ignorada passthrough".
						const finalUpdates: Partial<InterceptedResponse> = {
							isWaiting: false,
							editedAtRuntime: true,
						};
						if (modifications.status !== undefined) {
							finalUpdates.status = modifications.status;
							finalUpdates.statusText = getHttpStatusPhrase(modifications.status);
						}
						if (modifications.headers !== undefined) {
							finalUpdates.headers = modifications.headers;
						}
						if (modifications.body !== undefined) finalUpdates.body = modifications.body;
						if (modifications.headers !== undefined || modifications.body !== undefined) {
							const previousResponse = pendingResponse.response;
							const responseHeaders =
								modifications.headers ?? previousResponse?.headers ?? pendingResponse.headers;
							finalUpdates.response = {
								headers: responseHeaders,
								...(modifications.body !== undefined
									? { body: modifications.body }
									: previousResponse?.body !== undefined
										? { body: previousResponse.body }
										: {}),
							};
						}
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
		} else if (message.action === 'approveResponseWithEdit') {
			// Edição one-shot: o usuário ajusta status/headers/body de uma response
			// pausada via EditResponseSheet e devolvemos via Fetch.fulfillRequest.
			// Diferente de approveResponse: não há fallback para continueRequest se
			// fulfill falhar — a edição precisa ser visível como erro na UI.
			const { requestId, status, headers, body } = message as {
				requestId?: string;
				status?: number;
				headers?: Record<string, string>;
				body?: string;
			};

			if (!requestId || !pendingResponses[requestId]) {
				sendResponse({ success: false, error: 'Response not found' });
				return false;
			}
			if (typeof status !== 'number') {
				sendResponse({
					success: false,
					error: 'Status code obrigatório para edição one-shot',
				});
				return false;
			}
			if (!headers) {
				sendResponse({
					success: false,
					error: 'Headers obrigatórios para edição one-shot',
				});
				return false;
			}
			if (typeof body !== 'string') {
				sendResponse({
					success: false,
					error: 'Body obrigatório para edição one-shot',
				});
				return false;
			}

			applyEditedResponse(requestId, { status, headers, body })
				.then(() => {
					delete pendingResponses[requestId];
					patchRequest(requestId, {
						isWaiting: false,
						editedAtRuntime: true,
						status,
						statusText: getHttpStatusPhrase(status),
						headers,
						body,
						response: { headers, body },
					});
					sendResponse({ success: true });
				})
				.catch((error) => {
					console.error(`Erro ao aplicar edição one-shot em ${requestId}:`, error);
					sendResponse({ success: false, error: getErrorMessage(error) });
				});
			return true; // Indicates we'll respond asynchronously
		}

		// --- Session Replay — Phase 1a ---

		if (message.action === 'startRecording') {
			(async () => {
				try {
					// Valida que interceptação está ativa nesta tab antes de iniciar a sessão.
					const targets = await chrome.debugger.getTargets();
					const attached = targets.find((t) => t.tabId === message.tabId && t.attached);
					if (!attached) {
						sendResponse({ ok: false, error: 'Interceptação não está ativa nesta tab' });
						return;
					}

					const tab = await chrome.tabs.get(message.tabId);
					const id = await recorder.startSession({
						tabId: message.tabId,
						initialUrl: tab.url ?? '',
						userAgent: navigator.userAgent,
						viewportSize: { w: tab.width ?? 0, h: tab.height ?? 0 },
						canvasCaptureEnabled: message.canvasCaptureEnabled ?? false,
					});

					// Ativa Runtime e Log para captura de console/exceptions.
					// Se falhar (debugger detachou entre check e enable), propaga.
					await chrome.debugger.sendCommand({ tabId: message.tabId }, 'Runtime.enable');
					await chrome.debugger.sendCommand({ tabId: message.tabId }, 'Log.enable');

					// Sinaliza o probe daquela tab pra começar a emitir detections.
					// Se sendMessage falhar (probe não injetado), propaga erro via sendResponse.
					await chrome.tabs.sendMessage(message.tabId, {
						action: 'probeStartDetection',
						reason: 'initial',
					});

					// Inicia rrweb no content script ISOLATED da tab alvo. Falha aqui propaga
					// erro pro caller (no-fallbacks): sem rrweb a sessão não tem captura visual.
					await chrome.tabs.sendMessage(message.tabId, {
						action: '__rrweb_start',
						sessionId: id,
						recordCanvas: message.canvasCaptureEnabled ?? false,
						maskTextSelector: livePrivacyConfig?.rrwebMaskTextSelector,
						maskAllInputs: livePrivacyConfig?.rrwebMaskAllInputs,
					});
					sendResponse({ ok: true, sessionId: id });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'stopRecording') {
			(async () => {
				try {
					// Lê tabId da session ANTES de stopSession (depois disso, getActiveByTab
					// não retorna mais essa session porque endedAt foi setado).
					const session = await sessionStore.get(message.sessionId as string);
					await recorder.stopSession(message.sessionId as string);
					if (session?.tabId !== undefined) {
						// Desativa Runtime e Log antes do probeIdle.
						try {
							await chrome.debugger.sendCommand({ tabId: session.tabId }, 'Runtime.disable');
							await chrome.debugger.sendCommand({ tabId: session.tabId }, 'Log.disable');
						} catch {
							// Debugger pode ter detached entre stopSession e disable; ignorar.
						}
						try {
							await chrome.tabs.sendMessage(session.tabId, { action: '__rrweb_stop' });
						} catch {
							// Tab pode ter fechado; ignorar (probe idle cobre o resto).
						}
						try {
							await chrome.tabs.sendMessage(session.tabId, { action: 'probeIdle' });
						} catch {
							// Tab pode ter fechado; ignorar.
						}
					}
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'pageDetected') {
			(async () => {
				const tabId = sender?.tab?.id;
				if (tabId === undefined) {
					sendResponse({ ok: false, reason: 'no tab id in sender' });
					return;
				}
				const session = await recorder.getActiveByTab(tabId);
				if (!session) {
					sendResponse({ ok: false, reason: 'no active session for tab' });
					return;
				}
				try {
					const detection: PageDetection = {
						url: message.payload!.url,
						timestamp: message.payload!.timestamp,
						fingerprint: message.payload!.fingerprint,
						triggerType: message.payload!.triggerType,
					};
					await recorder.addPage(session.id, detection);
					// Emite RouteChangeEvent com o mesmo trigger do probe, relendo a sessão
					// para que currentPhaseId retorne a phase recém-criada (ou atualizada).
					const updated = await recorder.getActiveByTab(tabId);
					if (updated) {
						const routeEvent: SessionEvent = {
							type: 'route',
							timestamp: message.payload!.timestamp,
							phaseId: currentPhaseId(updated),
							url: message.payload!.url,
							triggerType: message.payload!.triggerType,
						};
						await recorder.addEvent(updated.id, routeEvent);
					}
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'getActiveSession') {
			(async () => {
				try {
					const session = await recorder.getActiveByTab(message.tabId as number);
					sendResponse({ ok: true, session });
				} catch (err) {
					sendResponse({ ok: false, session: null, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'getRecordingStatus') {
			(async () => {
				try {
					const session = await recorder.getActiveByTab(message.tabId as number);
					if (!session) {
						sendResponse({ ok: true, active: false });
						return;
					}
					const status = recorder.getRuntimeStatus(session.id);
					// `status` ser null significa "session existe no IDB mas não no runtime cache"
					// (post service worker recycle). Devolvemos zeros — UI re-mede no próximo
					// polling quando runtime for reconstruído pelo próximo addEvent.
					sendResponse({
						ok: true,
						active: true,
						sessionId: session.id,
						sizeBytes: status?.sizeBytes ?? 0,
						durationMs: status?.durationMs ?? 0,
					});
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'deleteSession') {
			(async () => {
				try {
					await sessionStore.delete(message.sessionId as string);
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'exportSession') {
			(async () => {
				try {
					const session = await sessionStore.get(message.sessionId as string);
					if (!session) {
						sendResponse({ ok: false, error: 'Sessão não encontrada' });
						return;
					}
					const data = await serializeSession(session);
					sendResponse({ ok: true, data });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'importSession') {
			(async () => {
				try {
					const session = await parseDbsession(message.data as ArrayBuffer);
					await sessionStore.put(session);
					sendResponse({ ok: true, sessionId: session.id });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'rrwebBatch') {
			(async () => {
				try {
					const sid = message.sessionId;
					const events = message.rrwebEvents;
					if (!sid || !Array.isArray(events)) {
						sendResponse({ ok: false, error: 'rrwebBatch: sessionId/rrwebEvents inválidos' });
						return;
					}
					// Validação estrutural rasa: cada item precisa ter o shape mínimo de RrwebEvent.
					// Probe bugado ou remetente externo malicioso poderia enfiar lixo no IDB
					// se o handler só checasse Array.isArray. No-fallbacks: rejeita o batch inteiro.
					const valid = events.every(
						(e): e is RrwebEvent =>
							!!e && typeof e.type === 'number' && typeof e.timestamp === 'number',
					);
					if (!valid) {
						sendResponse({ ok: false, error: 'rrwebBatch: payload com items inválidos' });
						return;
					}
					await recorder.addRrwebEvents(sid, events);
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'stateChange') {
			(async () => {
				try {
					const tabId = sender?.tab?.id;
					if (typeof tabId !== 'number') {
						sendResponse({ ok: false, error: 'stateChange sem tabId no sender' });
						return;
					}
					const session = await sessionStore.findActiveByTab(tabId);
					if (!session) {
						// Sem sessão — modo passivo não persiste state changes (spec: state
						// só com gravação ON).
						sendResponse({ ok: false, error: 'Sem sessão ativa para a tab remetente' });
						return;
					}
					const rawPayload = message.statePayload;
					if (!rawPayload) {
						sendResponse({ ok: false, error: 'stateChange sem statePayload' });
						return;
					}
					const payload = livePrivacyConfig
						? {
								...rawPayload,
								prev: redactState(rawPayload.prev, livePrivacyConfig),
								next: redactState(rawPayload.next, livePrivacyConfig),
							}
						: rawPayload;
					await recorder.addStateChange(session.id, payload);
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		// Phase 6 — privacyConfig CRUD + autoPurge on demand.
		if (message.action === 'getPrivacyConfig') {
			(async () => {
				try {
					const cfg = await getPrivacyConfig();
					sendResponse({ ok: true, privacyConfig: cfg });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'setPrivacyConfig') {
			(async () => {
				try {
					if (!message.config) {
						sendResponse({ ok: false, error: 'config ausente' });
						return;
					}
					await setPrivacyConfig(message.config);
					await reloadPrivacyConfig();
					sendResponse({ ok: true });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'purgeOldSessions') {
			(async () => {
				try {
					const cfg = await getPrivacyConfig();
					const purgedCount = await purgeOldSessions(cfg.autoPurgeRetentionDays);
					sendResponse({ ok: true, purgedCount });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'setRecordingLive') {
			(async () => {
				try {
					if (typeof message.tabId !== 'number') {
						sendResponse({ ok: false, error: 'tabId ausente' });
						return;
					}
					const targetTabId = message.tabId;
					if (message.active === true) {
						// Liga gravação live: inicia sessão se interceptação rodando
						// e ainda não há sessão pra essa tab.
						const existing = await recorder.getActiveByTab(targetTabId);
						if (existing) {
							sendResponse({ ok: true, sessionId: existing.id });
							return;
						}
						if (!isDebugging || attachedTabId !== targetTabId) {
							sendResponse({
								ok: false,
								error: 'Interceptação não está ativa nesta tab',
							});
							return;
						}
						// Reusa fluxo de auto-start: chama tryAutoStartRecording. Mas essa
						// função respeita recordingDisabled — antes de chamar, garante flag=false.
						await setRecordingDisabled(false);
						await tryAutoStartRecording(targetTabId);
						const created = await recorder.getActiveByTab(targetTabId);
						sendResponse({ ok: true, sessionId: created?.id });
					} else {
						// Desliga: stopa sessão ativa (se houver). NÃO detacha debugger.
						const existing = await recorder.getActiveByTab(targetTabId);
						if (!existing) {
							sendResponse({ ok: true });
							return;
						}
						try {
							await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Runtime.disable');
							await chrome.debugger.sendCommand({ tabId: targetTabId }, 'Log.disable');
						} catch {
							// Debugger pode ter sido detached por outro caminho — ignorar.
						}
						try {
							await chrome.tabs.sendMessage(targetTabId, { action: '__rrweb_stop' });
						} catch {
							// Tab pode ter fechado.
						}
						try {
							await chrome.tabs.sendMessage(targetTabId, { action: 'probeIdle' });
						} catch {
							// Tab pode ter fechado.
						}
						await recorder.stopSession(existing.id);
						broadcastRecordingState({
							tabId: targetTabId,
							active: false,
							sessionId: existing.id,
						});
						sendResponse({ ok: true });
					}
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}

		if (message.action === 'angularHttpTag') {
			const tag = message.angularHttpTag;
			if (!tag) return false;
			// Match heurístico: mesma URL+method e timestamp do request dentro de
			// 250ms da tag. Sem fallback: se nada casar, log de debug — não tagueamos
			// uma request arbitrária.
			const cutoff = tag.timestampHint - 250;
			const candidates = Object.values(allRequests).filter(
				(req) =>
					req.url === tag.url &&
					req.method === tag.method &&
					typeof req.timestamp === 'number' &&
					req.timestamp >= cutoff &&
					req.timestamp <= tag.timestampHint + 250,
			);
			if (candidates.length === 0) {
				console.debug(
					`[probe] angularHttpTag sem match: ${tag.method} ${tag.url} (timestampHint=${tag.timestampHint})`,
				);
				return false;
			}
			// Pega a candidata com timestamp mais próximo do hint. NOTA: o campo
			// `client` ainda NÃO existe em InterceptedResponse — quando for adicionado
			// ao schema (futura phase), trocar este log por
			// `patchRequest(matched.id ?? key, { client: 'angular-http' })`.
			const matched = candidates.reduce((best, cur) =>
				Math.abs(cur.timestamp - tag.timestampHint) < Math.abs(best.timestamp - tag.timestampHint)
					? cur
					: best,
			);
			console.debug(
				`[probe] angularHttpTag match: ${tag.method} ${tag.url} → request@${matched.timestamp} (client=angular-http; aguardando InterceptedResponse.client)`,
			);
			return false;
		}

		return false;
	},
);

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
		const callback = (result?: unknown) => {
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

// Edição one-shot: aplica status/headers/body editados pelo usuário via
// EditResponseSheet. Ao contrário de `applyResponseModifications`, NÃO faz
// fallback para `continueRequest` em caso de erro — a regra "no fallbacks" do
// projeto exige que a falha seja propagada para a UI (toast). O body é sempre
// re-encodado em base64 antes do envio (CDP aceita texto plano via base64Encoded
// também, mas usamos base64 unificado para evitar perder caracteres não-ASCII).
async function applyEditedResponse(
	requestId: string,
	edited: { status: number; headers: Record<string, string>; body: string },
): Promise<void> {
	if (!attachedTabId) {
		throw new Error('Nenhuma sessão de depuração ativa');
	}
	const pendingResponse = pendingResponses[requestId];
	if (!pendingResponse) {
		throw new Error('Response not found');
	}

	const statusPhrase = getHttpStatusPhrase(edited.status);
	const headersArray = headersRecordToArray(edited.headers);
	const encodedBody = encodeBodyToBase64(edited.body);

	await sendDebuggerCommand('Fetch.fulfillRequest', {
		requestId,
		responseCode: edited.status,
		responsePhrase: statusPhrase,
		responseHeaders: headersArray,
		body: encodedBody,
	});
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
				let responseHeaders = pendingResponse.response?.headers ?? pendingResponse.headers;
				if (modifications.headers !== undefined) {
					responseHeaders = modifications.headers;
				}

				// Convert headers object to array format required by Fetch API
				const headersArray = headersRecordToArray(responseHeaders);

				// Prepare status code and phrase
				let statusCode = pendingResponse.status;
				let statusPhrase = getHttpStatusPhrase(statusCode, pendingResponse.statusText);

				if (modifications.status !== undefined) {
					console.log(`Original status code: ${statusCode}, type: ${typeof statusCode}`);
					console.log(
						`Modification status code: ${modifications.status}, type: ${typeof modifications.status}`,
					);

					// Garantir que o status code seja um número
					statusCode = Number(modifications.status);
					statusPhrase = getHttpStatusPhrase(statusCode);

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

// Auto-start de gravação acoplado à interceptação (Bug 1).
//
// Encapsulado em função própria para permitir `return` cedo em caso de falha
// parcial sem afetar o fluxo de `startDebugging` (que precisa retornar `true`
// mesmo quando a gravação não inicia). O `return` aqui sai apenas desta
// função, mantendo a interceptação ativa.
//
// No-fallback: se `Runtime.enable` ou `Log.enable` falham depois de
// `startSession` ter sucesso, fazemos rollback da sessão (stopSession) para
// não vazar uma sessão "fake-ativa" para a UI — sessão sem console/exceptions
// é silenciosamente quebrada e violaria a regra de no-fallbacks.
async function tryAutoStartRecording(tabId: number): Promise<void> {
	const recordingDisabled = await getRecordingDisabled();
	if (recordingDisabled) return;
	const tab = await chrome.tabs.get(tabId);
	const sessionId = await recorder.startSession({
		tabId,
		initialUrl: tab.url ?? '',
		userAgent: navigator.userAgent,
		viewportSize: { w: tab.width ?? 0, h: tab.height ?? 0 },
		// TODO(session): captura de canvas é decisão por-sessão e hoje
		// não há UI para isso após a remoção do dialog. Follow-up: trazer
		// opt-in via menu/settings se houver demanda.
		canvasCaptureEnabled: false,
	});
	// Habilita Runtime/Log para captura de console/exceptions. Falha aqui
	// significa debugger desanexado entre attach e enable — sessão recém-criada
	// não capturaria console nenhum, então fazemos rollback antes de seguir.
	try {
		await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
		await chrome.debugger.sendCommand({ tabId }, 'Log.enable');
	} catch (enableErr) {
		console.warn('[session] Runtime/Log.enable falhou apos startSession; rollback:', enableErr);
		try {
			await recorder.stopSession(sessionId);
		} catch (rollbackErr) {
			console.warn('[session] rollback de stopSession falhou:', rollbackErr);
		}
		// Sai sem broadcast — UI nao vai mostrar "Gravando" indevidamente.
		return;
	}
	// Sinaliza probe + rrweb. Falhas aqui são fatais para a gravação
	// mas não para a interceptação — log e seguir.
	try {
		await chrome.tabs.sendMessage(tabId, {
			action: 'probeStartDetection',
			reason: 'initial',
		});
		await chrome.tabs.sendMessage(tabId, {
			action: '__rrweb_start',
			sessionId,
			recordCanvas: false,
			maskTextSelector: livePrivacyConfig?.rrwebMaskTextSelector,
			maskAllInputs: livePrivacyConfig?.rrwebMaskAllInputs,
		});
	} catch (err) {
		console.warn(
			'[session] gravação iniciada mas probe/rrweb falhou (provavelmente content script não injetado):',
			err,
		);
	}
	broadcastRecordingState({ tabId, active: true, sessionId });
}

// Start debugging
async function startDebugging(specificTabId: number | null = null): Promise<boolean> {
	// If already debugging, stop first
	if (isDebugging) {
		await stopDebugging();
	}

	// Get rules from storage
	const result = await chrome.storage.local.get(['rules']);
	rules = result.rules || [];

	// Log the loaded rules (even if there are none)
	console.log(`Loaded ${rules.length} rules for interception`);

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

		// Reset do SessionMarker: nova sessão começa agora; "Página" zera até a
		// próxima Page.frameNavigated do main frame.
		sessionMarker = {
			sessionStartedAt: Date.now(),
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		await persistSessionMarker();
		broadcastSessionMarker();

		// Habilita Network primeiro para que o requestId seja compartilhado com Fetch
		// e a gente consiga casar timing real de início/fim com a requisição interceptada.
		await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
		console.log('Network domain enabled for timing capture');

		// Habilita Page domain para receber Page.frameNavigated do main frame e
		// resetar a janela "Página atual" do NetworkMetricsBar a cada navegação.
		// Falha aqui não bloqueia a interceptação — a UI apenas vê tab "Página"
		// desabilitada (currentPageNavigatedAt continua null).
		try {
			await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
			console.log('Page domain enabled for navigation tracking');
		} catch (error) {
			console.error('Erro ao habilitar Page domain:', error);
		}

		// Enable Fetch domain for request interception.
		// Dois stages são necessários:
		// - Request: permite aplicar mocks com latência *antes* de a request sair para a rede,
		//   fazendo o Chrome DevTools registrar o delay total na coluna "Time". Mocks sem
		//   latência e requests normais são continuadas imediatamente neste stage.
		// - Response: intercepta todas as respostas para captura, breakpoints e mocks sem latência.
		await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
			patterns: [
				{ urlPattern: '*', requestStage: 'Request' },
				{ urlPattern: '*', requestStage: 'Response' },
			],
		});
		console.log('Fetch domain enabled for request+response interception');

		// Set up event listeners for debugger events
		chrome.debugger.onEvent.addListener(debuggerEventListener);

		// Set global state
		isDebugging = true;
		attachedTabId = tabId;
		pendingResponses = {};
		timingTracker.reset();

		// --- Acoplamento gravação ↔ interceptação (Bug 1) ---
		// Default: ao iniciar interceptação, iniciamos uma sessão de gravação.
		// Usuário pode desligar via switch "Gravação" da SiteHeader, que persiste
		// `recordingDisabled=true` em chrome.storage.local.
		// Falhas aqui são logadas e ignoradas — a interceptação continua mesmo se
		// gravação não puder começar (ex.: storage corrompido, content script
		// ausente para probe/rrweb).
		try {
			await tryAutoStartRecording(tabId);
		} catch (err) {
			// Não-fatal: interceptação continua mesmo se gravação falha (ex.: aba
			// sem permissão de probe). Erro é logado para depuração.
			console.warn('[session] auto-start de gravação falhou:', err);
		}

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

		// Disable Page domain (não bloqueia se já estava desabilitado).
		try {
			await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Page.disable');
		} catch (error) {
			console.error('Erro ao desabilitar Page domain:', error);
		}

		// Disable network tracking
		await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Network.disable');
		console.log('Network tracking disabled');

		// --- Acoplamento gravação ↔ interceptação (Bug 1) ---
		// Encerra qualquer sessão ativa associada à tab antes de detacharmos.
		// stopSession é idempotente; se a sessão já foi parada (usuário clicou
		// "Parar Gravação" sozinho — fluxo legado), o segundo call no-op.
		try {
			const activeSession = await recorder.getActiveByTab(attachedTabId);
			if (activeSession) {
				try {
					await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Runtime.disable');
					await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Log.disable');
				} catch {
					// Debugger pode ter sido detached por outro caminho — ignorar.
				}
				try {
					await chrome.tabs.sendMessage(attachedTabId, { action: '__rrweb_stop' });
				} catch {
					// Tab pode ter fechado.
				}
				try {
					await chrome.tabs.sendMessage(attachedTabId, { action: 'probeIdle' });
				} catch {
					// Tab pode ter fechado.
				}
				await recorder.stopSession(activeSession.id);
				broadcastRecordingState({
					tabId: attachedTabId,
					active: false,
					sessionId: activeSession.id,
				});
			}
		} catch (err) {
			console.warn('[session] auto-stop de gravação falhou:', err);
		}

		// Detach debugger
		await chrome.debugger.detach({ tabId: attachedTabId });
		console.log(`Debugger detached from tab ${attachedTabId}`);

		// Remove event listener
		chrome.debugger.onEvent.removeListener(debuggerEventListener);

		// Reset global state. `timingTracker.reset()` antes de zerar `allRequests`
		// fecha a janela em que callbacks pendentes (onDurationReady/onMetricsReady)
		// poderiam chamar `patchRequest` e cair em `allRequests[id] === undefined`.
		const previousAttachedTabId = attachedTabId;
		isDebugging = false;
		attachedTabId = null;
		pendingResponses = {};
		timingTracker.reset();
		allRequests = {};
		if (previousAttachedTabId !== null) {
			recorder.clearPassiveEngineForTab(previousAttachedTabId);
		}

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

	if (message === 'Page.frameNavigated') {
		const frame = params?.frame;
		// Filtra: só main frame (parentId == null). Iframes têm parentId.
		if (frame && frame.parentId == null && typeof frame.url === 'string') {
			sessionMarker = {
				...sessionMarker,
				currentPageUrl: frame.url,
				currentPageNavigatedAt: Date.now(),
			};
			persistSessionMarker();
			broadcastSessionMarker();
		}
		return;
	}

	if (message.startsWith('Network.')) {
		timingTracker.handleNetworkEvent(message, params);
		return;
	}

	if (message === 'Fetch.requestPaused') {
		handleRequestPaused(params).catch((error) => {
			console.error('Erro ao processar Fetch.requestPaused:', error);
			const requestId = params?.requestId;
			if (!requestId) return;
			sendDebuggerCommand('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(
				(failError) => {
					console.error('Erro ao sinalizar falha para request pausada:', failError);
				},
			);
		});
		return;
	}

	// Eventos de Session Replay: encaminha para o recorder se há sessão ativa.
	// attachedTabId é garantidamente number aqui: o outer guard (tabId !== attachedTabId)
	// elimina undefined antes deste ponto, mas o TypeScript não infere o narrowing — usamos
	// attachedTabId diretamente, que já é number | null e narrowed pelo outer guard.
	if (
		message === 'Runtime.consoleAPICalled' ||
		message === 'Runtime.exceptionThrown' ||
		message === 'Log.entryAdded'
	) {
		const tabId = debuggeeId.tabId as number;
		recorder.getActiveByTab(tabId).then((session) => {
			if (!session) return;
			if (message === 'Runtime.consoleAPICalled') {
				handleConsoleAPI(session, params as Protocol.Runtime.ConsoleAPICalledEvent).catch((err) => {
					console.warn('[session] handleConsoleAPI falhou:', err);
				});
			} else if (message === 'Runtime.exceptionThrown') {
				handleExceptionThrown(session, params as Protocol.Runtime.ExceptionThrownEvent).catch(
					(err) => {
						console.warn('[session] handleExceptionThrown falhou:', err);
					},
				);
			} else {
				handleLogEntry(session, params as Protocol.Log.EntryAddedEvent).catch((err) => {
					console.warn('[session] handleLogEntry falhou:', err);
				});
			}
		});
	}
}

// Mapeia o `MatchedRuleAction` retornado pelo matcher para a lista de tipos
// que serão exibidos na coluna "Tipo" do histórico. `mock`/`transform` são
// derivados nos próprios `applyMockResponse`/`applyTransformResponse` (que
// têm acesso a metadados extras como `latency`); aqui tratamos os casos de
// pass-through e capture failure no Response stage.
function deriveAppliedTypesFromMatch(match: MatchedRuleAction | undefined): AppliedType[] {
	if (!match) return ['proxy'];
	switch (match.type) {
		case 'breakpoint':
			return ['breakpoint'];
		case 'delay':
			return ['latency'];
		case 'mock':
			return match.action.latency ? ['mock', 'latency'] : ['mock'];
		case 'transform':
			return ['transform'];
	}
}

// Handle paused request
async function handleRequestPaused(params: any): Promise<void> {
	const {
		requestId,
		request,
		responseStatusCode,
		responseStatusText,
		responseHeaders,
		resourceType,
		networkId,
	} = params;
	const url = request.url;
	const method = request.method;
	if (!method) {
		throw new Error(`CDP nao informou metodo HTTP para ${requestId}`);
	}
	if (!resourceType) {
		throw new Error(`CDP nao informou resourceType para ${requestId}`);
	}

	// Privacy URL gate: domínios em blacklist passam pela rede sem persistência
	// nem emissão de NetworkEvent — captura zero. networkId fica órfão no tracker
	// (descartamos para liberar memória). Sem fallback: se continueRequest falhar,
	// erro propaga normalmente.
	if (livePrivacyConfig && shouldIgnoreUrl(url, livePrivacyConfig)) {
		timingTracker.discardByNetworkId(networkId);
		await continueRequest(requestId);
		return;
	}

	// Request stage: responseStatusCode é undefined (a request ainda não foi para a rede).
	// Response stage: responseStatusCode é sempre um número.
	const isResponseStage = typeof responseStatusCode === 'number';

	const requestHeaders = requestHeadersToRecord(request.headers);
	const postData = typeof request.postData === 'string' ? request.postData : undefined;

	if (!isResponseStage) {
		// Request stage: só intercepta mocks com latência aqui.
		// Motivo: Fetch.fulfillRequest no Response stage reusa o timing de rede original —
		// o Chrome DevTools exibe o TTFB real, ignorando qualquer `await wait(latencyMs)`
		// aplicado depois. Interceptando no Request stage, antes de a request sair para a rede,
		// o Chrome contabiliza os 5s de delay na coluna "Time" do Network panel.
		const matchedAction = findMatchingRuleAction(rules, {
			url,
			method,
			headers: requestHeaders,
		});

		if (matchedAction?.type === 'mock' && matchedAction.action.latency) {
			console.log(`Aplicando mock com latência via Request stage: ${url}`);
			// Não haverá Network.loadingFinished para esta request — descarta o tracker.
			timingTracker.discardByNetworkId(networkId);
			await applyMockResponse(requestId, matchedAction.action, {
				url,
				method,
				requestHeaders,
				postData,
				responseStatusCode: 0,
				responseStatusText: '',
				responseHeaders: [],
				resourceType,
			});
			return;
		}

		// DelayAction (Latência standalone): aguarda no Request stage para que o
		// Chrome DevTools contabilize o atraso na coluna "Time" do Network panel
		// (mesma técnica do mock+latência). Após o wait, libera a request — ela
		// ainda passará pelo Response stage normalmente.
		if (matchedAction?.type === 'delay') {
			const timeMs = matchedAction.action.timeMs;
			console.log(`Aplicando delay de ${timeMs}ms via Request stage: ${url}`);
			await wait(timeMs);
			await continueRequest(requestId);
			return;
		}

		// Demais casos (sem mock ou mock sem latência): deixa a request seguir normalmente.
		// O Response stage irá interceptá-la depois.
		await continueRequest(requestId);
		return;
	}

	// A partir daqui: Response stage — `isResponseStage` foi true, então
	// responseStatusCode é garantidamente um número.
	const responseHeaderArray = responseHeaders ?? [];
	const responseHeadersRecord = headersArrayToRecord(responseHeaderArray);
	const statusText = getHttpStatusPhrase(responseStatusCode, responseStatusText);
	const mimeType = getOptionalMimeTypeFromHeaders(responseHeadersRecord);
	const requestInfo: InterceptedResponse['request'] = {
		headers: requestHeaders,
		...(postData !== undefined ? { postData } : {}),
	};
	const responseInfo: InterceptedResponse['response'] = {
		headers: responseHeadersRecord,
	};

	console.log(`🟡 REQUEST PAUSED (Response stage): ${url}`);
	console.log('Request ID:', requestId);
	console.log('Method:', method);
	console.log('Resource Type:', resourceType);

	const matchedAction = findMatchingRuleAction(rules, {
		url,
		method,
		headers: requestHeaders,
	});

	if (matchedAction?.type === 'mock') {
		console.log(`Applying mock for ${url}`);
		// Mock sem latência no Response stage (latência já foi tratada no Request stage).
		// Descarta o timing pendente — mock não viaja na rede.
		timingTracker.discardByNetworkId(networkId);
		await applyMockResponse(requestId, matchedAction.action, {
			url,
			method,
			requestHeaders,
			postData,
			responseStatusCode,
			responseStatusText: statusText,
			responseHeaders: responseHeaderArray,
			resourceType,
		});
		return;
	}

	// Verificar se existe uma regra de breakpoint para essa requisição
	if (matchedAction?.type === 'breakpoint') {
		console.log(`Applying breakpoint for ${url}`);
		// Não precisamos fazer nada especial aqui, pois o fluxo normal já vai interceptar a requisição
		// e adicionar à lista de pendingResponses para o usuário interagir
	}

	// Nem toda resposta possui corpo disponível para captura (ex.: redirect/204/HEAD).
	let body: string | undefined;
	const bodyUnavailableReason = getCaptureBodyUnavailableReason(method, responseStatusCode);
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
				statusText,
				headers: responseHeadersRecord,
				...(mimeType !== undefined ? { mimeType } : {}),
				type: resourceType,
				timestamp: Date.now(),
				request: requestInfo,
				response: responseInfo,
				captureError: continueErrorMessage
					? `${captureError}; falha ao continuar request: ${continueErrorMessage}`
					: captureError,
				appliedTypes: deriveAppliedTypesFromMatch(matchedAction),
			};

			applyPrivacyToInterceptedResponse(failedCaptureRequest);

			persistRequest(requestId, failedCaptureRequest).catch((persistError) => {
				console.error(`Falha ao persistir erro de captura para ${requestId}:`, persistError);
			});
			if (attachedTabId !== null) {
				emitNetworkEventForSession(attachedTabId, requestId, failedCaptureRequest).catch((err) => {
					console.warn('[session] emitNetworkEventForSession (captureError) falhou:', err);
				});
			}
			return;
		}
	}

	// Criar objeto de resposta
	const responseObj: InterceptedResponse = {
		url,
		method,
		status: responseStatusCode,
		statusText,
		headers: responseHeadersRecord,
		...(mimeType !== undefined ? { mimeType } : {}),
		type: resourceType,
		timestamp: Date.now(),
		request: requestInfo,
		response: responseInfo,
	};
	if (body !== undefined) {
		responseObj.body = body;
		responseObj.response = { ...responseInfo, body };
	}
	if (bodyUnavailableReason) responseObj.bodyUnavailableReason = bodyUnavailableReason;

	// Quando Network.loadingFinished chegar (tipicamente depois do paused),
	// o tracker emitirá `requestUpdated` com a duration final.
	timingTracker.linkFetchId(networkId, requestId);

	if (matchedAction?.type === 'transform') {
		await applyTransformResponse(requestId, matchedAction.action, body, responseObj);
		return;
	}

	const willIntercept = matchedAction?.type === 'breakpoint';
	const appliedTypes = deriveAppliedTypesFromMatch(matchedAction);
	const delayMs = matchedAction?.type === 'delay' ? matchedAction.action.timeMs : undefined;
	const persistedRequest: InterceptedResponse = willIntercept
		? { ...responseObj, isWaiting: true, appliedTypes }
		: {
				...responseObj,
				appliedTypes,
				...(delayMs !== undefined ? { delayMs } : {}),
			};

	applyPrivacyToInterceptedResponse(persistedRequest);

	if (willIntercept) {
		await persistRequest(requestId, persistedRequest);
		if (attachedTabId !== null) {
			emitNetworkEventForSession(attachedTabId, requestId, persistedRequest).catch((err) => {
				console.warn('[session] emitNetworkEventForSession (breakpoint) falhou:', err);
			});
		}
		console.log(`Intercepting response for ${url}`);
		pendingResponses[requestId] = persistedRequest;
		chrome.runtime.sendMessage({
			action: 'newPendingResponse',
			requestId,
			url,
			method,
			status: responseStatusCode,
			statusText,
			type: resourceType,
			mimeType,
			response: persistedRequest,
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
		if (attachedTabId !== null) {
			emitNetworkEventForSession(attachedTabId, requestId, toPersist).catch((err) => {
				console.warn('[session] emitNetworkEventForSession (pass-through) falhou:', err);
			});
		}
	}
}

// Helper function to continue a request
async function continueRequest(requestId: string): Promise<void> {
	await sendDebuggerCommand('Fetch.continueRequest', { requestId });
	console.log(`Continued request ${requestId}`);
}

// Aplica um mock como resposta para uma requisição
async function applyMockResponse(
	requestId: string,
	mock: MockAction,
	originalRequest: {
		url: string;
		method: string;
		requestHeaders: Record<string, string>;
		postData?: string;
		responseStatusCode: number;
		responseStatusText: string;
		responseHeaders: { name: string; value: string }[];
		resourceType: string;
	},
): Promise<void> {
	const startedAt = Date.now();
	try {
		const responseHeaders = { ...mock.headers };
		if (mock.contentType && !getHeaderValue(responseHeaders, 'content-type')) {
			responseHeaders['Content-Type'] = mock.contentType;
		}

		const headerArray = headersRecordToArray(responseHeaders);
		const bodyValidation = validateMockBody(originalRequest.method, mock.status, mock.body);
		const latencyMs = resolveMockLatencyMs(mock.latency);
		// Mocks com `latency` são roteados para o Request stage (ver handleRequestPaused),
		// onde o `await wait(latencyMs)` ocorre antes do Fetch.fulfillRequest e é refletido
		// pelo Chrome DevTools na coluna "Time".
		await wait(latencyMs);

		// Obter o texto do status para o código
		const statusPhrase = getHttpStatusPhrase(mock.status, mock.statusPhrase);
		const mimeType = getOptionalMimeTypeFromHeaders(responseHeaders);

		// Criar objeto de resposta para armazenar no histórico
		const mockAppliedTypes: AppliedType[] = latencyMs > 0 ? ['mock', 'latency'] : ['mock'];
		const responseObj: InterceptedResponse = {
			url: originalRequest.url,
			method: originalRequest.method,
			status: mock.status,
			statusText: statusPhrase,
			headers: responseHeaders,
			...(mimeType !== undefined ? { mimeType } : {}),
			type: 'mock',
			timestamp: Date.now(),
			isMocked: true,
			request: {
				headers: originalRequest.requestHeaders,
				...(originalRequest.postData !== undefined ? { postData: originalRequest.postData } : {}),
			},
			response: {
				headers: responseHeaders,
				...(bodyValidation.shouldSendBody ? { body: bodyValidation.body } : {}),
			},
			mockLatencyMs: latencyMs,
			appliedTypes: mockAppliedTypes,
		};
		if (bodyValidation.shouldSendBody) responseObj.body = bodyValidation.body;

		const fulfillParams: {
			requestId: string;
			responseCode: number;
			responsePhrase: string;
			responseHeaders: { name: string; value: string }[];
			body?: string;
		} = {
			requestId,
			responseCode: mock.status,
			responsePhrase: statusPhrase,
			responseHeaders: headerArray,
		};
		if (bodyValidation.shouldSendBody) {
			fulfillParams.body = encodeBodyToBase64(bodyValidation.body);
		}

		await sendDebuggerCommand('Fetch.fulfillRequest', fulfillParams);

		responseObj.duration = Date.now() - startedAt;
		responseObj.durationSource = 'mock';
		await persistRequest(requestId, responseObj);
		console.log(`Mock aplicado com sucesso para ${requestId}`);
	} catch (error) {
		const captureError = `Falha ao aplicar mock: ${getErrorMessage(error)}`;
		console.error(captureError, error);

		const failedMockRequest: InterceptedResponse = {
			url: originalRequest.url,
			method: originalRequest.method,
			status: originalRequest.responseStatusCode,
			statusText: originalRequest.responseStatusText,
			headers: headersArrayToRecord(originalRequest.responseHeaders),
			...(getOptionalMimeTypeFromHeaders(originalRequest.responseHeaders) !== undefined
				? { mimeType: getOptionalMimeTypeFromHeaders(originalRequest.responseHeaders) }
				: {}),
			type: originalRequest.resourceType,
			timestamp: Date.now(),
			request: {
				headers: originalRequest.requestHeaders,
				...(originalRequest.postData !== undefined ? { postData: originalRequest.postData } : {}),
			},
			response: {
				headers: headersArrayToRecord(originalRequest.responseHeaders),
			},
			captureError,
			appliedTypes: ['mock'],
		};

		await persistRequest(requestId, failedMockRequest);

		try {
			await sendDebuggerCommand('Fetch.failRequest', { requestId, errorReason: 'Failed' });
		} catch (failError) {
			const failMessage = getErrorMessage(failError);
			console.error('Erro ao falhar requisição após falha do mock:', failError);
			await patchRequest(requestId, {
				captureError: `${captureError}; falha ao sinalizar erro para o navegador: ${failMessage}`,
			});
		}
	}
}

// Garante que o offscreen document está vivo. O service worker MV3 não tem
// `document` nem pode usar `new Function` (CSP), por isso o transform
// avançado (JS) é executado num iframe sandbox hospedado dentro de um
// offscreen document. Esta função é idempotente — se o documento já existe,
// não cria de novo.
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let offscreenCreating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
	const offscreenApi = (
		chrome as unknown as {
			offscreen?: {
				hasDocument?: () => Promise<boolean>;
				createDocument: (options: {
					url: string;
					reasons: string[];
					justification: string;
				}) => Promise<void>;
				closeDocument?: () => Promise<void>;
			};
		}
	).offscreen;
	if (!offscreenApi || typeof offscreenApi.createDocument !== 'function') {
		throw new Error(
			'chrome.offscreen API indisponível — Transform avançado requer Chrome 109+ com permissão "offscreen".',
		);
	}
	if (offscreenApi.hasDocument && (await offscreenApi.hasDocument())) {
		return;
	}
	if (offscreenCreating) {
		await offscreenCreating;
		return;
	}
	offscreenCreating = offscreenApi
		.createDocument({
			url: OFFSCREEN_DOCUMENT_PATH,
			reasons: ['DOM_PARSER'],
			justification:
				'Executar JavaScript do usuário em sandbox isolado para regras de Transform avançadas (US-017).',
		})
		.finally(() => {
			offscreenCreating = null;
		});
	await offscreenCreating;
}

interface AdvancedTransformReply {
	ok: boolean;
	output?: unknown;
	error?: string;
}

async function runAdvancedTransformInOffscreen(
	script: string,
	parsedResponse: unknown,
	timeoutMs = 5000,
): Promise<AdvancedTransformReply> {
	await ensureOffscreenDocument();
	const id = `adv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const reply = (await chrome.runtime.sendMessage({
		target: 'offscreen',
		action: 'runAdvancedTransform',
		id,
		script,
		response: parsedResponse,
		timeoutMs,
	})) as AdvancedTransformReply | undefined;
	if (!reply || typeof reply !== 'object') {
		return { ok: false, error: 'Offscreen não retornou resposta para runAdvancedTransform' };
	}
	return reply;
}

// Aplica uma regra de Transform (declarativo ou advanced) ao body capturado e
// devolve a resposta modificada via Fetch.fulfillRequest. Diferente de mock,
// aqui a request já passou pela rede — o body original é insumo do transform.
// Em qualquer falha (body indisponível, JSON inválido, operação errada,
// advanced ainda não suportado), a request falha via Fetch.failRequest e o
// erro é persistido em captureError — sem fallbacks silenciosos.
async function applyTransformResponse(
	requestId: string,
	action: TransformAction,
	originalBody: string | undefined,
	baseResponse: InterceptedResponse,
): Promise<void> {
	const failWith = async (reason: string): Promise<void> => {
		const captureError = `Transform falhou: ${reason}`;
		console.error(captureError);
		await persistRequest(requestId, {
			...baseResponse,
			captureError,
			appliedTypes: ['transform'],
		});
		try {
			await sendDebuggerCommand('Fetch.failRequest', { requestId, errorReason: 'Failed' });
		} catch (failError) {
			const failMessage = getErrorMessage(failError);
			console.error('Erro ao falhar requisição após falha do transform:', failError);
			await patchRequest(requestId, {
				captureError: `${captureError}; falha ao sinalizar erro para o navegador: ${failMessage}`,
			});
		}
	};

	if (originalBody === undefined) {
		const reason = baseResponse.bodyUnavailableReason
			? `corpo da resposta não disponível (${baseResponse.bodyUnavailableReason})`
			: 'corpo da resposta não disponível';
		await failWith(reason);
		return;
	}

	const mode = action.mode ?? 'declarative';

	let transformedBody: string;
	if (mode === 'advanced') {
		const script = action.advancedScript ?? '';
		if (script.trim().length === 0) {
			await failWith('script avançado vazio — escreva o corpo da função antes de salvar.');
			return;
		}
		let parsedResponse: unknown;
		try {
			parsedResponse = JSON.parse(originalBody);
		} catch (err) {
			await failWith(`body não é JSON válido: ${(err as Error).message}`);
			return;
		}
		try {
			const reply = await runAdvancedTransformInOffscreen(script, parsedResponse);
			if (!reply.ok) {
				await failWith(reply.error ?? 'erro desconhecido no sandbox advanced');
				return;
			}
			transformedBody = JSON.stringify(reply.output);
		} catch (err) {
			await failWith(`offscreen indisponível: ${getErrorMessage(err)}`);
			return;
		}
	} else {
		const result = applyTransformToBody(action, originalBody);
		if (!result.ok) {
			await failWith(result.error);
			return;
		}
		transformedBody = result.body;
	}

	const responseHeaderArray = headersRecordToArray(baseResponse.headers);
	const fulfilledResponse: InterceptedResponse = {
		...baseResponse,
		body: transformedBody,
		response: {
			...(baseResponse.response ?? { headers: baseResponse.headers }),
			body: transformedBody,
		},
		isTransformed: true,
		appliedTypes: ['transform'],
	};

	try {
		await sendDebuggerCommand('Fetch.fulfillRequest', {
			requestId,
			responseCode: baseResponse.status,
			responsePhrase: baseResponse.statusText,
			responseHeaders: responseHeaderArray,
			body: encodeBodyToBase64(transformedBody),
		});
		// TODO(session): transform requests não emitem NetworkEvent ainda (follow-up).
		await persistRequest(requestId, fulfilledResponse);
		console.log(`Transform aplicado com sucesso para ${requestId}`);
	} catch (error) {
		const captureError = `Transform: falha ao devolver resposta modificada: ${getErrorMessage(error)}`;
		console.error(captureError, error);
		await persistRequest(requestId, {
			...baseResponse,
			captureError,
			appliedTypes: ['transform'],
		});
		try {
			await sendDebuggerCommand('Fetch.failRequest', { requestId, errorReason: 'Failed' });
		} catch (failError) {
			console.error('Erro ao falhar requisição após falha de fulfill no transform:', failError);
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

// --- helpers de teste (não usar em produção) ---
export const _testStartDebugging = startDebugging;
export const _testStopDebugging = stopDebugging;
export const _testPersistRequest = persistRequest;
export const _testPatchRequest = patchRequest;
