// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';

export type MessageAction =
	| 'startDebugging'
	| 'stopDebugging'
	| 'getDebuggingStatus'
	| 'getPendingResponses'
	| 'getAllRequests'
	| 'clearAllRequests'
	| 'getResponseDetails'
	| 'approveResponse'
	| 'newPendingResponse'
	| 'responseBodyReady'
	| 'newRequest'
	| 'requestUpdated'
	| 'selectTargetTab'
	| 'setTargetTab'
	| 'targetTabSelected'
	| 'openSelectTabDialog';

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
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
	allRequests?: Record<string, InterceptedResponse>;
	response?: InterceptedResponse;
	mocks?: MockConfig[];
}
