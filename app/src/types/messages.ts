// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';
import type { SessionMarker } from './sessionMarker';
import type { ProbeStateChangePayload } from '@/probe/protocol';
import type {
	AntipatternHit,
	EnvironmentFingerprint,
	PageDetectionTrigger,
	RrwebEvent,
	Session,
} from '@/lib/session/types';

export type MessageAction =
	| 'startDebugging'
	| 'stopDebugging'
	| 'getDebuggingStatus'
	| 'getPendingResponses'
	| 'getAllRequests'
	| 'clearAllRequests'
	| 'getResponseDetails'
	| 'approveResponse'
	| 'approveResponseWithEdit'
	| 'newPendingResponse'
	| 'responseBodyReady'
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
	// Session Replay — Phase 3 (antipatterns ao vivo)
	| 'liveAntipatternHit'
	// Session Replay — Phase 4 (state change capture)
	| 'stateChange'
	// Session Replay — Phase 5 (Angular HttpClient tag)
	| 'angularHttpTag'
	// Session Replay — Phase 6 (privacyConfig + autoPurge)
	| 'getPrivacyConfig'
	| 'setPrivacyConfig'
	| 'purgeOldSessions'
	// Bug 3 — live toggle gravacao durante interceptacao
	| 'setRecordingLive';

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
	};
	// exportSession / importSession (Phase 1d)
	data?: ArrayBuffer;
	filename?: string;
	// rrweb (Phase 2)
	rrwebEvents?: RrwebEvent[];
	recordCanvas?: boolean;
	// rrweb mascaramento (Phase 6 — Task 10)
	maskTextSelector?: string;
	maskAllInputs?: boolean;
	// Antipattern (Phase 3)
	antipatternHit?: AntipatternHit;
	// State change (Phase 4)
	statePayload?: ProbeStateChangePayload;
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
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
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
	// exportSession (Phase 1d)
	data?: ArrayBuffer;
	// Antipattern (Phase 3)
	antipatternHits?: AntipatternHit[];
	// Phase 6 — privacyConfig + autoPurge
	privacyConfig?: import('@/lib/session/types').RedactionConfig;
	purgedCount?: number;
}
