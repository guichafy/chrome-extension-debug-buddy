import { tryCoalesceConsole } from './coalesce';
import { fingerprintsEqual, newPhaseId } from './fingerprint';
import { estimateEventBytes } from './sizeEstimate';
import { sessionStore } from './storage';
import type {
	DetectionPhase,
	PageDetection,
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

	async stopSession(id: string): Promise<void> {
		const s = await sessionStore.get(id);
		if (!s) throw new Error(`Session ${id} não encontrada`);
		// Idempotente por design: background pode chamar stopSession em tab close
		// sem precisar saber se a sessão já foi encerrada antes (ex: usuário ja
		// clicou em "Parar gravação"). Não-encontrada continua erro.
		if (s.endedAt !== null) return;
		s.endedAt = Date.now();
		runtime.delete(id);
		await sessionStore.put(s);
	},

	async addPage(sessionId: string, detection: PageDetection): Promise<void> {
		const s = await sessionStore.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
		const last = s.detectionPhases[s.detectionPhases.length - 1];
		// Mutação in-place de `last` é segura aqui porque o background processa
		// chrome.runtime.onMessage serialmente (event loop single-threaded).
		// Se addPage passar a ter múltiplos callers concorrentes, precisará de
		// lock otimista (compare-and-swap em endedAt ou versão).
		if (last && fingerprintsEqual(last.fingerprint, detection.fingerprint)) {
			last.pages.push(detection);
			last.endTimestamp = detection.timestamp;
		} else {
			const phase = makePhase(detection);
			s.detectionPhases.push(phase);
			s.events.push(makeDetectionEvent(detection.timestamp, phase.id));
		}
		await sessionStore.put(s);
	},

	async addEvent(sessionId: string, event: SessionEvent): Promise<void> {
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
	},

	async getActiveByTab(tabId: number): Promise<Session | null> {
		return sessionStore.findActiveByTab(tabId);
	},

	_setLimitsForTests(limits: { sizeBytes: number; durationMs: number }): void {
		sizeLimitBytes = limits.sizeBytes;
		durationLimitMs = limits.durationMs;
	},

	_resetLimitsForTests(): void {
		sizeLimitBytes = DEFAULT_SIZE_LIMIT_BYTES;
		durationLimitMs = DEFAULT_DURATION_LIMIT_MS;
		runtime.clear();
	},
};
