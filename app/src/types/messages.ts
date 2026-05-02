// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';
import type { SessionMarker } from './sessionMarker';
import type { EnvironmentFingerprint, PageDetectionTrigger, Session } from '@/lib/session/types';

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
	// Session Replay — Phase 1a / 1c
	| 'startRecording'
	| 'stopRecording'
	| 'getRecordingStatus'
	| 'deleteSession'
	| 'pageDetected'
	| 'getActiveSession';

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
	// Session Replay — Phase 1a
	sessionId?: string;
	canvasCaptureEnabled?: boolean;
	payload?: {
		url: string;
		timestamp: number;
		triggerType: PageDetectionTrigger;
		fingerprint: EnvironmentFingerprint;
	};
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
	// Session Replay — Phase 1a / 1c
	ok?: boolean;
	reason?: string;
	sessionId?: string;
	session?: Session | null;
	active?: boolean;
	sizeBytes?: number;
	durationMs?: number;
}
