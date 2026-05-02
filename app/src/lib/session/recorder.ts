import { AntipatternEngine } from './antipattern/engine';
import { tryCoalesceConsole } from './coalesce';
import { fingerprintsEqual, newPhaseId } from './fingerprint';
import { estimateEventBytes, estimateRrwebBytes } from './sizeEstimate';
import { sessionStore } from './storage';
import type {
	AntipatternHit,
	DetectionPhase,
	PageDetection,
	RrwebEvent,
	Session,
	SessionEvent,
	SessionMetadata,
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
	await sessionStore.put(session);
	runtime.delete(session.id);
}

export const recorder = {
	async startSession(args: StartArgs): Promise<string> {
		const existing = await sessionStore.findActiveByTab(args.tabId);
		if (existing) {
			throw new Error(`Já existe session ativa para tab ${args.tabId} (${existing.id})`);
		}
		const session: Session = {
			id: newSessionId(),
			schemaVersion: 1,
			startedAt: Date.now(),
			endedAt: null,
			origin: 'recorded',
			tabId: args.tabId,
			metadata: {
				initialUrl: args.initialUrl,
				userAgent: args.userAgent,
				viewportSize: args.viewportSize,
				canvasCaptureEnabled: args.canvasCaptureEnabled,
			},
			detectionPhases: [],
			events: [],
		};
		await sessionStore.put(session);
		return session.id;
	},

	stopSession(id: string): Promise<void> {
		return serializeBySessionId(id, async () => {
			const s = await sessionStore.get(id);
			if (!s) throw new Error(`Session ${id} não encontrada`);
			// Idempotente por design: background pode chamar stopSession em tab close
			// sem precisar saber se a sessão já foi encerrada antes (ex: usuário ja
			// clicou em "Parar gravação"). Não-encontrada continua erro.
			if (s.endedAt !== null) return;
			s.endedAt = Date.now();
			sessionEngines.delete(id);
			runtime.delete(id);
			await sessionStore.put(s);
		});
	},

	addPage(sessionId: string, detection: PageDetection): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await sessionStore.get(sessionId);
			if (!s) throw new Error(`Session ${sessionId} não encontrada`);
			if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
			const last = s.detectionPhases[s.detectionPhases.length - 1];
			// Mutação in-place segura: serializeBySessionId garante que apenas uma
			// mutation por sessão roda por vez (get → mutate → put atômico do ponto
			// de vista do recorder).
			if (last && fingerprintsEqual(last.fingerprint, detection.fingerprint)) {
				last.pages.push(detection);
				last.endTimestamp = detection.timestamp;
			} else {
				const phase = makePhase(detection);
				s.detectionPhases.push(phase);
				s.events.push(makeDetectionEvent(detection.timestamp, phase.id));
			}
			await sessionStore.put(s);
		});
	},

	addEvent(sessionId: string, event: SessionEvent): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await sessionStore.get(sessionId);
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
						await sessionStore.put(s);
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

			await sessionStore.put(s);
		});
	},

	addRrwebEvents(sessionId: string, events: RrwebEvent[]): Promise<void> {
		if (events.length === 0) return Promise.resolve();
		return serializeBySessionId(sessionId, async () => {
			const s = await sessionStore.get(sessionId);
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

			await sessionStore.put(s);
		});
	},

	addAntipatternHit(sessionId: string, hit: AntipatternHit): Promise<void> {
		return serializeBySessionId(sessionId, async () => {
			const s = await sessionStore.get(sessionId);
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
			await sessionStore.put(s);
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
	},

	async getActiveByTab(tabId: number): Promise<Session | null> {
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
	},
};
