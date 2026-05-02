export type FrameworkName = 'react' | 'angular' | 'vanilla';

export type LibTreatment = 'tracked' | 'detection-only';

export interface HttpClientDetection {
	name: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface DataFetchingDetection {
	name: string;
	version?: string;
	treatment: LibTreatment;
}

export interface StateManagerDetection {
	name: string;
	storesDetected: number;
	treatment: LibTreatment;
}

export interface EnvironmentFingerprint {
	framework: { name: FrameworkName; version?: string };
	httpClients: HttpClientDetection[];
	dataFetching: DataFetchingDetection[];
	stateManagers: StateManagerDetection[];
	detectedAt: number;
	isProductionBuild: boolean;
}

export type PageDetectionTrigger =
	| 'initial'
	| 'navigation'
	| 'pushstate'
	| 'replacestate'
	| 'popstate';

export interface PageDetection {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	triggerType: PageDetectionTrigger;
}

export interface DetectionPhase {
	id: string;
	startTimestamp: number;
	endTimestamp: number;
	fingerprint: EnvironmentFingerprint;
	pages: PageDetection[];
}

// Outras variantes (network, console, route, error, state) virão em Phase 1b.
export type SessionEvent =
	| { type: 'detection'; timestamp: number; phaseId: string };

export interface SessionMetadata {
	initialUrl: string;
	userAgent: string;
	viewportSize: { w: number; h: number };
	canvasCaptureEnabled: boolean;
}

export type SessionOrigin = 'recorded' | 'imported';

export interface Session {
	id: string;
	schemaVersion: 1;
	startedAt: number;
	// null = sessão ainda em gravação; number = timestamp de encerramento.
	endedAt: number | null;
	origin: SessionOrigin;
	tabId: number;
	metadata: SessionMetadata;
	detectionPhases: DetectionPhase[];
	events: SessionEvent[];
}
