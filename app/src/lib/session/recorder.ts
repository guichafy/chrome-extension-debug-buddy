import type { InterceptedResponse } from '@/types/intercepted';
import { AntipatternEngine } from './antipattern/engine';
import { tryCoalesceConsole } from './coalesce';
import { fingerprintsEqual, newPhaseId } from './fingerprint';
import { getPrivacyConfig, toRedactionApplied } from './privacy/config';
import { applyBodyPolicy } from './sessionNetworkAdapter';
import { estimateEventBytes, estimateRrwebBytes } from './sizeEstimate';
import { compressDiff, compressSnapshot, computeDiff } from './state/diff';
import { sessionStore } from './storage';
import type {
	AntipatternHit,
	DetectionPhase,
	PageDetection,
	RrwebEvent,
	Session,
	SessionEvent,
	SessionMetadata,
	StateKeyframe,
	StoreKind,
} from './types';

interface StartArgs extends SessionMetadata {
	tabId: number;
}

function newSessionId(): string {
	return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makePhase(detection: PageDetection): DetectionPhase {
	return {
		id: newPhaseId(),
		startTimestamp: detection.timestamp,
		endTimestamp: detection.timestamp,
		fingerprint: detection.fingerprint,
		pages: [detection],
	};
}

function makeDetectionEvent(timestamp: number, phaseId: string): SessionEvent {
	return { type: 'detection', timestamp, phaseId };
}

const DEFAULT_SIZE_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_DURATION_LIMIT_MS = 10 * 60 * 1000; // 10 min

let sizeLimitBytes = DEFAULT_SIZE_LIMIT_BYTES;
let durationLimitMs = DEFAULT_DURATION_LIMIT_MS;

interface SessionRuntime {
	bytes: number;
	startedAt: number;
	navigationCount: number;
}
const runtime = new Map<string, SessionRuntime>();

// Phase 4 — limites de keyframe de state.
const DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS = 10;
const DEFAULT_STATE_KEYFRAME_EVERY_T_MS = 30_000;

let stateKeyframeEveryN = DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS;
let stateKeyframeEveryT = DEFAULT_STATE_KEYFRAME_EVERY_T_MS;

interface StoreRuntime {
	currentState: unknown;
	diffsSinceKeyframe: number;
	lastKeyframeAt: number;
	sequenceNum: number;
}

interface SessionStateRuntime {
	stores: Map<string, StoreRuntime>; // key: phaseId+storeId
}

const stateRuntime = new Map<string, SessionStateRuntime>();

function stateRuntimeFor(sessionId: string): SessionStateRuntime {
	let r = stateRuntime.get(sessionId);
	if (!r) {
		r = { stores: new Map() };
		stateRuntime.set(sessionId, r);
	}
	return r;
}

export interface StateChangePayload {
	storeId: string;
	storeKind: StoreKind;
	timestamp: number;
	prev: unknown;
	next: unknown;
}

// Engines de antipatterns: um por sessão gravada, um por tab passiva (modo ao
// vivo sem session). Mantidos em memória — descartados em stopSession /
// stopDebugging / tab.onRemoved.
const sessionEngines = new Map<string, AntipatternEngine>();
const tabEngines = new Map<number, AntipatternEngine>();

/**
 * Cadeia de promises por sessionId para serializar mutations.
 *
 * Necessário porque `chrome.runtime.onMessage` callbacks rodam concorrentes em
 * service workers MV3 — `addPage`/`addEvent`/`addRrwebEvents` (e na Phase 4 o
 * `addStateChange`) fazem `get → mutate → put` async. Sem ordenação, o último
 * `put` sobrescreve writes intermediários (last-write-wins).
 *
 * `serializeBySessionId` enfileira `fn` no `.then()` da promise anterior dessa
 * sessão. Erros são contidos para que uma falha não envenene as próximas.
 * Memory: cleanup quando a entrada atual ainda for a última no mapa.
 */
const mutationChain = new Map<string, Promise<void>>();

function serializeBySessionId<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
	const previous = mutationChain.get(sessionId) ?? Promise.resolve();
	const next = previous.catch(() => undefined).then(fn);
	// Para o slot do mapa usamos a versão never-rejecting — uma falha em fn
	// não deve impedir o próximo call de avançar.
	const slotEntry: Promise<void> = next.then(
		() => undefined,
		() => undefined,
	);
	mutationChain.set(sessionId, slotEntry);
	// Cleanup: quando essa entrada terminar, se ninguém enfileirou depois, libera.
	void slotEntry.then(() => {
		if (mutationChain.get(sessionId) === slotEntry) {
			mutationChain.delete(sessionId);
		}
	});
	return next;
}

/**
 * Cache in-memory por sessionId pra evitar `sessionStore.get` em cada add*.
 * Sessões grandes (eventos acumulados) custam ~500KB de JSON.parse por get.
 * Cache é populado no primeiro get e mantido até `stopSession` ou flush final.
 *
 * Combinado com `pendingFlushes` (debounce dos puts), reduz write amplification
 * de O(N²) (cada event reescreve sessão crescendo) pra O(N) amortizado.
 */
const sessionCache = new Map<string, Session>();

const FLUSH_DEBOUNCE_MS = 200;
const pendingFlushes = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleFlush(sessionId: string): void {
	const existing = pendingFlushes.get(sessionId);
	if (existing) clearTimeout(existing);
	const timer = setTimeout(() => {
		void flushSession(sessionId);
	}, FLUSH_DEBOUNCE_MS);
	pendingFlushes.set(sessionId, timer);
}

async function flushSession(sessionId: string): Promise<void> {
	pendingFlushes.delete(sessionId);
	const cached = sessionCache.get(sessionId);
	if (!cached) return;
	try {
		await sessionStore.put(cached);
	} catch (err) {
		console.error('[session] flush put falhou:', err);
	}
}

async function flushAndForget(sessionId: string): Promise<void> {
	const existing = pendingFlushes.get(sessionId);
	if (existing) {
		clearTimeout(existing);
		pendingFlushes.delete(sessionId);
	}
	await flushSession(sessionId);
}

async function getCachedOrLoad(sessionId: string): Promise<Session | null> {
	const cached = sessionCache.get(sessionId);
	if (cached) return cached;
	const fresh = await sessionStore.get(sessionId);
	if (fresh) sessionCache.set(sessionId, fresh);
	return fresh;
}

function getOrInitRuntime(sessionId: string, session: Session): SessionRuntime {
	let r = runtime.get(sessionId);
	if (!r) {
		// Reconstruir após service worker recycle
		r = {
			bytes: JSON.stringify(session).length,
			startedAt: session.startedAt,
			navigationCount: session.events.filter((e) => e.type === 'route').length,
		};
		runtime.set(sessionId, r);
	}
	return r;
}

// Procura sessão ativa para `tabId` priorizando cache in-memory antes do IDB.
// Eventos in-flight podem estar mutados no cache mas ainda não flushed (debounce
// de 200ms) — `sessionStore.findActiveByTab` leria stale. Compartilhado entre
// `startSession` (defesa contra dupla-criação) e `getActiveByTab` (read path).
function findCachedActiveByTab(tabId: number): Session | null {
	for (const session of sessionCache.values()) {
		if (session.tabId === tabId && session.endedAt === null) return session;
	}
	return null;
}

async function autoStop(
	session: Session,
	reason: 'size' | 'time',
	r: SessionRuntime,
): Promise<void> {
	session.endedAt = Date.now();
	session.telemetry = {
		hitHardLimit: true,
		hardLimitReason: reason,
		endedSizeBytes: r.bytes,
		endedDurationMs: session.endedAt - r.startedAt,
		navigationCount: r.navigationCount,
	};
	// Hard limit hit é a última oportunidade de persistir — força flush sincrono
	// e descarta cache pra que próximos reads não vejam estado pós-encerramento.
	// `session` é o mesmo objeto referenciado pelo cache (getCachedOrLoad retorna
	// a mesma referência), então flushAndForget já persiste todas as mutações
	// acima. Não precisamos de put redundante.
	await flushAndForget(session.id);
	sessionCache.delete(session.id);
	runtime.delete(session.id);
}

export const recorder = {
	async startSession(args: StartArgs): Promise<string> {
		// Defesa em profundidade: também checa cache in-memory antes do IDB.
		// Cobre janela em que sessão recém-criada ainda não foi flushed mas já
		// existe (raro, gated por click do usuário, mas evita race em paths
		// programáticos como auto-start ao iniciar interceptação).
		const cached = findCachedActiveByTab(args.tabId);
		if (cached) {
			throw new Error(`Já existe session ativa para tab ${args.tabId} (${cached.id})`);
		}
		const existing = await sessionStore.findActiveByTab(args.tabId);
		if (existing) {
			throw new Error(`Já existe session ativa para tab ${args.tabId} (${existing.id})`);
		}
		const id = newSessionId();
		const startedAt = Date.now();
		// Bootstrap DetectionPhase: garante que `currentPhaseId(session)` nunca
		// lança e que eventos (console/error/network) capturados antes do primeiro
		// `pageDetected` real são preservados. addPage substitui esta fase in-place
		// na primeira detection real (kind === 'bootstrap' branch).
		const bootstrap: DetectionPhase = {
			id: `bootstrap-${id}`,
			startTimestamp: startedAt,
			endTimestamp: startedAt,
			// Fingerprint vazio temporário — será sobrescrito pela primeira
			// detection real. Não é fallback porque é substituído sincronamente
			// quando a probe envia o pageDetected.
			fingerprint: {
				framework: { name: 'vanilla' },
				httpClients: [],
				dataFetching: [],
				stateManagers: [],
				detectedAt: startedAt,
				isProductionBuild: false,
			},
			pages: [],
			kind: 'bootstrap',
		};
		const session: Session = {
			id,
			schemaVersion: 1,
			startedAt,
			endedAt: null,
			origin: 'recorded',
			tabId: args.tabId,
			metadata: {
				initialUrl: args.initialUrl,
				userAgent: args.userAgent,
				viewportSize: args.viewportSize,
				canvasCaptureEnabled: args.canvasCaptureEnabled,
			},
			detectionPhases: [bootstrap],
			events: [],
		};
		await sessionStore.put(session);
		sessionCache.set(session.id, session);
		return session.id;
	},

	stopSession(id: string): Promise<void> {
		return serializeBySessionId(id, async () => {
			// Cancela qualquer flush pendente — vamos consolidar em put síncrono final.
			const pendingTimer = pendingFlushes.get(id);
			if (pendingTimer) {
				clearTimeout(pendingTimer);
				pendingFlushes.delete(id);
			}
			const s = await getCachedOrLoad(id);
			if (!s) throw new Error(`Session ${id} não encontrada`);
			// Idempotente por design: background pode chamar stopSession em tab close
			// sem precisar saber se a sessão já foi encerrada antes (ex: usuário ja
			// clicou em "Parar gravação"). Não-encontrada continua erro.
			if (s.endedAt !== null) return;
			s.endedAt = Date.now();
			// Phase 6: snapshot do que foi (potencialmente) redigido nesta sessão.
			// Usamos toRedactionApplied para evitar vazar regex específicas — só
			// preservamos chaves de header e contagem de regex.
			try {
				const cfg = await getPrivacyConfig();
				s.redactionApplied = toRedactionApplied(cfg);
			} catch (err) {
				console.warn('[session] stopSession: falha ao ler privacyConfig:', err);
			}
			sessionEngines.delete(id);
			runtime.delete(id);
			stateRuntime.delete(id);
			// Put síncrono final é a última oportunidade de persistir — cache descartado
			// depois pra próximos reads sempre lerem do IDB (evita stale).
			await sessionStore.put(s);
			sessionCache.delete(id);
		});
	},

	addPage(sessionId: string, detection: PageDetection): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
			const last = s.detectionPhases[s.detectionPhases.length - 1];

			// Promoção da bootstrap phase: a primeira detection real preenche o
			// fingerprint/pages e marca kind='detected'. Mantemos o phase.id para
			// preservar o vínculo com eventos já indexados (eventos pré-detection
			// que entraram via currentPhaseId apontam para `bootstrap-${sessionId}`).
			if (last && last.kind === 'bootstrap') {
				last.kind = 'detected';
				last.fingerprint = detection.fingerprint;
				last.pages.push(detection);
				last.endTimestamp = detection.timestamp;
				s.events.push(makeDetectionEvent(detection.timestamp, last.id));
				scheduleFlush(sessionId);
				return;
			}

			// Mutação in-place segura: serializeBySessionId garante que apenas uma
			// mutation por sessão roda por vez (get → mutate → put atômico do ponto
			// de vista do recorder).
			if (last && fingerprintsEqual(last.fingerprint, detection.fingerprint)) {
				last.pages.push(detection);
				last.endTimestamp = detection.timestamp;
			} else {
				const phase = makePhase(detection);
				phase.kind = 'detected';
				s.detectionPhases.push(phase);
				s.events.push(makeDetectionEvent(detection.timestamp, phase.id));
			}
			scheduleFlush(sessionId);
		});
	},

	addEvent(sessionId: string, event: SessionEvent): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);

			const r = getOrInitRuntime(sessionId, s);

			// Coalesce console idênticos consecutivos
			if (event.type === 'console') {
				const last = s.events[s.events.length - 1];
				if (last) {
					const result = tryCoalesceConsole(last, event);
					if (result.coalesced) {
						s.events[s.events.length - 1] = result.event;
						// Não cresce bytes (coalesce só atualiza count na entrada existente)
						scheduleFlush(sessionId);
						return;
					}
				}
			}

			s.events.push(event);
			if (event.type === 'route') r.navigationCount++;
			r.bytes += estimateEventBytes(event);

			// Hard limit checks (ordem: size primeiro porque é o mais comum)
			if (r.bytes >= sizeLimitBytes) {
				await autoStop(s, 'size', r);
				return;
			}
			const duration = Date.now() - r.startedAt;
			if (duration >= durationLimitMs) {
				await autoStop(s, 'time', r);
				return;
			}

			scheduleFlush(sessionId);
		});
	},

	/**
	 * Atualiza o snapshot `request: InterceptedResponse` de um evento network
	 * já persistido — necessário porque approve/modify de breakpoint roda DEPOIS
	 * que o evento foi emitido para a sessão. Sem isso, o Replay viewer mostra
	 * o estado pré-aprovação (isWaiting=true, body original).
	 *
	 * Encontra evento por requestId. Idempotente — se nenhum evento casar (ex:
	 * patch chegou após session encerrada e nova começou), no-op silencioso.
	 */
	patchNetworkEventRequest(
		sessionId: string,
		requestId: string,
		updates: Partial<InterceptedResponse>,
	): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) return; // sessão removida — no-op
			let mutated = false;
			for (const ev of s.events) {
				if (ev.type !== 'network') continue;
				if (ev.requestId !== requestId) continue;
				if (!ev.request) continue;
				// Aplica policy de body no merge: bodies textuais pequenos sobrevivem
				// (drawer de Replay renderiza), grandes/binários são descartados com
				// bodyUnavailableReason. Sem strip cego — Phase 7 introduziu inspeção
				// completa no replay.
				const merged = applyBodyPolicy({ ...ev.request, ...updates });
				ev.request = merged;
				// Espelhar campos top-level que dependem de updates
				if (updates.duration !== undefined) ev.durationMs = updates.duration;
				if (updates.status !== undefined) ev.status = updates.status;
				mutated = true;
			}
			if (mutated) scheduleFlush(sessionId);
		});
	},

	addRrwebEvents(sessionId: string, events: RrwebEvent[]): Promise<void> {
		if (events.length === 0) return Promise.resolve();
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);

			const r = getOrInitRuntime(sessionId, s);

			if (!s.rrwebEvents) s.rrwebEvents = [];
			s.rrwebEvents.push(...events);
			r.bytes += estimateRrwebBytes(events);

			// Hard limit — mesma lógica de addEvent (size primeiro, depois time).
			if (r.bytes >= sizeLimitBytes) {
				await autoStop(s, 'size', r);
				return;
			}
			const duration = Date.now() - r.startedAt;
			if (duration >= durationLimitMs) {
				await autoStop(s, 'time', r);
				return;
			}

			scheduleFlush(sessionId);
		});
	},

	addStateChange(sessionId: string, payload: StateChangePayload): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
			const phase = s.detectionPhases[s.detectionPhases.length - 1];
			if (!phase) {
				throw new Error(
					`Session ${sessionId}: state-change recebido antes da primeira DetectionPhase`,
				);
			}

			const r = getOrInitRuntime(sessionId, s);
			const sr = stateRuntimeFor(sessionId);
			const runtimeKey = `${phase.id}:${payload.storeId}`;
			let storeR = sr.stores.get(runtimeKey);

			// Baseline: primeira mudança observada do storeId nesta fase.
			let isFirstObservation = false;
			if (!storeR) {
				if (!phase.stateBaseline) phase.stateBaseline = {};
				phase.stateBaseline[payload.storeId] = {
					storeId: payload.storeId,
					storeKind: payload.storeKind,
					data: payload.prev,
					timestamp: payload.timestamp,
				};
				storeR = {
					currentState: payload.prev,
					diffsSinceKeyframe: 0,
					lastKeyframeAt: payload.timestamp,
					sequenceNum: 0,
				};
				sr.stores.set(runtimeKey, storeR);
				isFirstObservation = true;
			}

			const ops = computeDiff(storeR.currentState, payload.next);
			if (ops.length === 0) {
				// Sem mudança real — não fabricamos evento. Persistimos só se foi a
				// primeira observação (pra registrar baseline).
				if (isFirstObservation) scheduleFlush(sessionId);
				return;
			}

			const diffCompressed = compressDiff(ops);
			storeR.sequenceNum++;
			const ev: SessionEvent = {
				type: 'state',
				timestamp: payload.timestamp,
				phaseId: phase.id,
				storeId: payload.storeId,
				storeKind: payload.storeKind,
				diffCompressed,
				sequenceNum: storeR.sequenceNum,
			};
			s.events.push(ev);
			r.bytes += estimateEventBytes(ev);

			storeR.currentState = payload.next;
			storeR.diffsSinceKeyframe++;

			// Keyframe a cada N diffs OU T ms.
			const elapsedSinceKeyframe = payload.timestamp - storeR.lastKeyframeAt;
			if (
				storeR.diffsSinceKeyframe >= stateKeyframeEveryN ||
				elapsedSinceKeyframe >= stateKeyframeEveryT
			) {
				if (!phase.stateKeyframes) phase.stateKeyframes = [];
				const keyframe: StateKeyframe = {
					storeId: payload.storeId,
					storeKind: payload.storeKind,
					timestamp: payload.timestamp,
					phaseId: phase.id,
					snapshotCompressed: compressSnapshot(payload.next),
				};
				phase.stateKeyframes.push(keyframe);
				r.bytes += keyframe.snapshotCompressed.length;
				storeR.diffsSinceKeyframe = 0;
				storeR.lastKeyframeAt = payload.timestamp;
			}

			// Hard limit
			if (r.bytes >= sizeLimitBytes) {
				await autoStop(s, 'size', r);
				return;
			}
			const duration = Date.now() - r.startedAt;
			if (duration >= durationLimitMs) {
				await autoStop(s, 'time', r);
				return;
			}

			scheduleFlush(sessionId);
		});
	},

	addAntipatternHit(sessionId: string, hit: AntipatternHit): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await getCachedOrLoad(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
			if (!s.antipatternHits) s.antipatternHits = [];
			const dedupKey = `${hit.patternId}|${hit.startTimestamp}|${hit.endTimestamp}|${hit.context.summary}`;
			const exists = s.antipatternHits.some(
				(h) =>
					`${h.patternId}|${h.startTimestamp}|${h.endTimestamp}|${h.context.summary}` === dedupKey,
			);
			if (exists) return;
			s.antipatternHits.push(hit);
			scheduleFlush(sessionId);
		});
	},

	pushNetworkForAntipatterns(sessionId: string, ev: SessionEvent): AntipatternHit[] {
		let eng = sessionEngines.get(sessionId);
		if (!eng) {
			eng = new AntipatternEngine();
			sessionEngines.set(sessionId, eng);
		}
		return eng.pushEvent(ev);
	},

	getOrCreatePassiveEngineForTab(tabId: number): AntipatternEngine {
		let eng = tabEngines.get(tabId);
		if (!eng) {
			eng = new AntipatternEngine();
			tabEngines.set(tabId, eng);
		}
		return eng;
	},

	clearPassiveEngineForTab(tabId: number): void {
		tabEngines.delete(tabId);
	},

	_resetEnginesForTests(): void {
		sessionEngines.clear();
		tabEngines.clear();
		sessionCache.clear();
		for (const t of pendingFlushes.values()) clearTimeout(t);
		pendingFlushes.clear();
	},

	async _flushForTests(sessionId: string): Promise<void> {
		await flushAndForget(sessionId);
	},

	async getActiveByTab(tabId: number): Promise<Session | null> {
		// Prioriza cache (live reference, não snapshot — consumers não devem mutar).
		// Cache cobre janela 200ms entre mutate e flush; IDB é fallback pós-restart.
		const cached = findCachedActiveByTab(tabId);
		if (cached) return cached;
		return sessionStore.findActiveByTab(tabId);
	},

	getRuntimeStatus(sessionId: string): { sizeBytes: number; durationMs: number } | null {
		const r = runtime.get(sessionId);
		if (!r) return null;
		return {
			sizeBytes: r.bytes,
			durationMs: Date.now() - r.startedAt,
		};
	},

	_setLimitsForTests(limits: { sizeBytes: number; durationMs: number }): void {
		sizeLimitBytes = limits.sizeBytes;
		durationLimitMs = limits.durationMs;
	},

	_resetLimitsForTests(): void {
		sizeLimitBytes = DEFAULT_SIZE_LIMIT_BYTES;
		durationLimitMs = DEFAULT_DURATION_LIMIT_MS;
		runtime.clear();
		mutationChain.clear();
		sessionEngines.clear();
		tabEngines.clear();
		stateRuntime.clear();
		sessionCache.clear();
		for (const t of pendingFlushes.values()) clearTimeout(t);
		pendingFlushes.clear();
		stateKeyframeEveryN = DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS;
		stateKeyframeEveryT = DEFAULT_STATE_KEYFRAME_EVERY_T_MS;
	},

	_setStateLimitsForTests(limits: { everyNDiffs: number; everyTMs: number }): void {
		stateKeyframeEveryN = limits.everyNDiffs;
		stateKeyframeEveryT = limits.everyTMs;
	},

	_resetStateLimitsForTests(): void {
		stateKeyframeEveryN = DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS;
		stateKeyframeEveryT = DEFAULT_STATE_KEYFRAME_EVERY_T_MS;
		stateRuntime.clear();
	},
};
