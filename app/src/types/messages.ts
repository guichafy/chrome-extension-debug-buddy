// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';
import type { SessionMarker } from './sessionMarker';
import type {
	EnvironmentFingerprint,
	PageDetectionTrigger,
	Recommendation,
	RrwebEvent,
	Session,
} from '@/lib/session/types';
import type { TechHit } from '@/lib/insights/types';

export type MessageAction =
	| 'startDebugging'
	| 'stopDebugging'
	| 'getDebuggingStatus'
	| 'getPendingResponses'
	// Phase 5 (dual-stage): fila unificada substitui pendingResponses.
	// Mantemos as duas durante a transição; getPendingResponses some quando
	// Phase 5 portar todos os consumidores.
	| 'getPendingInterceptions'
	| 'getAllRequests'
	| 'clearAllRequests'
	| 'getResponseDetails'
	| 'approveResponse'
	| 'approveResponseWithEdit'
	// Phase 5: aprovação genérica que funciona para Request e Response stages.
	| 'approveInterception'
	| 'approveInterceptionWithEdit'
	| 'newPendingResponse'
	// Phase 5: notificação genérica de interceptação pendente (qualquer stage).
	| 'newPendingInterception'
	| 'newRequest'
	| 'requestUpdated'
	| 'selectTargetTab'
	| 'setTargetTab'
	| 'targetTabSelected'
	| 'targetTabUpdated'
	| 'targetTabClosed'
	| 'openSelectTabDialog'
	| 'getSessionMarker'
	| 'sessionMarkerUpdated'
	// Session Replay — Phase 1a / 1c / 1d
	| 'startRecording'
	| 'stopRecording'
	| 'getRecordingStatus'
	| 'deleteSession'
	| 'pageDetected'
	| 'getActiveSession'
	| 'exportSession'
	| 'importSession'
	// Session Replay — Bug 1 (lifecycle binding)
	| 'recordingStateChanged'
	// Session Replay — Phase 2 (rrweb)
	| 'rrwebBatch'
	// Session Replay — Phase E (recommendations ao vivo)
	| 'liveRecommendation'
	// Bug 4 — fingerprint detectado em modo passivo (broadcast quando
	// pageDetected chega sem session ativa). Permite UI mostrar framework
	// + libs detectados na página atual durante linting de runtime.
	| 'liveDetection'
	// Session Replay — Phase 5 (Angular HttpClient tag)
	| 'angularHttpTag'
	// Session Replay — Phase 6 (privacyConfig + autoPurge)
	| 'getPrivacyConfig'
	| 'setPrivacyConfig'
	| 'purgeOldSessions'
	// Bug 3 — live toggle gravacao durante interceptacao
	| 'setRecordingLive'
	// Phase M — hidratação do drawer Live Insights ao abrir
	| 'getLiveSnapshot';

export interface Message {
	action: MessageAction;
	tabId?: number;
	tabTitle?: string;
	tabUrl?: string;
	requestId?: string;
	url?: string;
	status?: number;
	statusText?: string;
	type?: string;
	mimeType?: string;
	body?: string;
	response?: InterceptedResponse;
	modifications?: ResponseModifications;
	updates?: Partial<InterceptedResponse>;
	sessionMarker?: SessionMarker;
	// Session Replay — Phase 1a / 1d
	sessionId?: string;
	canvasCaptureEnabled?: boolean;
	payload?: {
		url: string;
		timestamp: number;
		triggerType: PageDetectionTrigger;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[]; // sub-projeto 2 — opcional
	};
	// exportSession / importSession (Phase 1d) — string base64 do .dbsession.
	// chrome.runtime.sendMessage não preserva ArrayBuffer no transporte (vira
	// {} via JSON serializacao), entao encodamos na origem e decodamos no
	// destino (UI->background pra import, background->UI pra export).
	data?: string;
	filename?: string;
	// rrweb (Phase 2)
	rrwebEvents?: RrwebEvent[];
	recordCanvas?: boolean;
	// rrweb mascaramento (Phase 6 — Task 10)
	maskTextSelector?: string;
	maskAllInputs?: boolean;
	// Recommendation (Phase E)
	recommendation?: Recommendation;
	// Angular HttpClient tag (Phase 5)
	angularHttpTag?: {
		url: string;
		method: string;
		timestampHint: number;
		confidence: 'high' | 'medium' | 'low';
	};
	// Phase 6 — privacyConfig
	config?: import('@/lib/session/types').RedactionConfig;
	// Bug 3 — live toggle gravacao durante interceptacao
	active?: boolean;
	// probeStartDetection metadata. Background envia probe via bridge:
	// `reason` casa com PageDetectionTrigger (initial/navigation/pushstate/...).
	reason?: PageDetectionTrigger;
	// Sub-projeto 3 — broadcast extendido de liveDetection. UI atual ignora
	// graciosamente; Sub-projeto 4 consome.
	techsUpdates?: Array<{
		host: string;
		techs: TechHit[];
	}>;
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
	// Phase 3 (dual-stage): fila unificada de interceptações pendentes. Cobre
	// ambos os stages (Request e Response). Consumida pelo hook
	// `usePendingInterceptions` (Phase 5). Mantemos `pendingResponses`
	// paralelo durante a transição.
	pendingInterceptions?: Record<string, import('@/lib/interceptionPipeline').PendingInterception>;
	allRequests?: Record<string, InterceptedResponse>;
	response?: InterceptedResponse;
	mocks?: MockConfig[];
	sessionMarker?: SessionMarker;
	// Session Replay — Phase 1a / 1c / 1d
	ok?: boolean;
	reason?: string;
	sessionId?: string;
	session?: Session | null;
	active?: boolean;
	sizeBytes?: number;
	durationMs?: number;
	// exportSession (Phase 1d) — string base64 do .dbsession (zip).
	// chrome.runtime.sendMessage não preserva ArrayBuffer no transporte, então
	// codificamos no background e decodamos na UI antes do new Blob().
	data?: string;
	// Phase 6 — privacyConfig + autoPurge
	privacyConfig?: import('@/lib/session/types').RedactionConfig;
	purgedCount?: number;
	// Phase M — snapshot Live Insights pra hidratar UI ao mount.
	// `detections` é uma lista por host (DNS) preservando ordem de visita
	// mais-recente-primeiro. Permite acumular framework/libs de todos os hosts
	// visitados na sessão de interceptação atual sem perder contexto ao navegar.
	liveSnapshot?: {
		detections: Array<{
			host: string;
			url: string;
			timestamp: number;
			fingerprint: EnvironmentFingerprint;
		}>;
		recommendations: Recommendation[];
	};
}
