import { fingerprintsEqual } from './fingerprint';
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

function newPhaseId(): string {
	return `phase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
		if (s.endedAt !== null) return;
		s.endedAt = Date.now();
		await sessionStore.put(s);
	},

	async addPage(sessionId: string, detection: PageDetection): Promise<void> {
		const s = await sessionStore.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
		const last = s.detectionPhases[s.detectionPhases.length - 1];
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

	async getActiveByTab(tabId: number): Promise<Session | null> {
		return sessionStore.findActiveByTab(tabId);
	},
};
