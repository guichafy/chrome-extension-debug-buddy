import type { InterceptedResponse } from '@/types/intercepted';

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

export interface LibraryDetection {
	name: 'jquery';
	version?: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface EnvironmentFingerprint {
	framework: { name: FrameworkName; version?: string };
	libraries: LibraryDetection[];
	httpClients: HttpClientDetection[];
	dataFetching: DataFetchingDetection[];
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
	/**
	 * 'bootstrap' = fase sintética criada por startSession antes da primeira
	 * pageDetected real chegar. Substituída in-place ao receber a primeira
	 * detection. 'detected' (default) = fase criada via probe normal.
	 * Campo opcional para preservar compat com sessões importadas antigas.
	 */
	kind?: 'bootstrap' | 'detected';
}

export type ConsoleSource = 'app' | 'browser' | 'security';

export type ConsoleLevel =
	| 'log'
	| 'info'
	| 'warn'
	| 'error'
	| 'debug'
	| 'trace'
	| 'dir'
	| 'table'
	| 'group'
	| 'groupCollapsed'
	| 'groupEnd'
	| 'count'
	| 'countReset'
	| 'assert'
	| 'time'
	| 'timeEnd'
	| 'timeLog'
	| 'clear';

export interface ConsoleArgPreview {
	type: 'string' | 'number' | 'boolean' | 'undefined' | 'null' | 'object' | 'function' | 'symbol';
	description: string;
	preview?: {
		properties: Array<{ name: string; type: string; value?: string }>;
		overflow: boolean;
	};
}

export interface ConsoleStackFrame {
	url: string;
	lineNumber: number;
	columnNumber: number;
	functionName: string;
}

export interface SessionTelemetry {
	hitHardLimit: boolean;
	hardLimitReason?: 'size' | 'time';
	endedSizeBytes: number;
	endedDurationMs: number;
	navigationCount: number;
}

export type SessionEvent =
	| { type: 'detection'; timestamp: number; phaseId: string }
	| {
			type: 'network';
			timestamp: number;
			phaseId: string;
			requestId: string;
			method: string;
			url: string;
			status: number;
			durationMs?: number;
			bodyRef?: string;
			callsite?: RawCallsite;
			client?: string;
			/**
			 * Snapshot completo da InterceptedResponse capturada pelo background.
			 * Permite que o Replay reuse o `RequestTimeline` do Command Center
			 * (DataTable + FilterBar + columns) com paridade visual total.
			 * Opcional para preservar compat com sessões gravadas antes desta
			 * extensão (Fase 7 do plano de bugfixes).
			 */
			request?: InterceptedResponse;
	  }
	| {
			type: 'console';
			timestamp: number;
			phaseId: string;
			source: ConsoleSource;
			level: ConsoleLevel;
			args: ConsoleArgPreview[];
			stackTrace?: { frames: ConsoleStackFrame[] };
			coalesceCount?: number;
	  }
	| {
			type: 'route';
			timestamp: number;
			phaseId: string;
			url: string;
			triggerType: PageDetectionTrigger;
	  }
	| {
			type: 'error';
			timestamp: number;
			phaseId: string;
			message: string;
			stackTrace?: { frames: ConsoleStackFrame[] };
	  };

export interface SessionMetadata {
	initialUrl: string;
	userAgent: string;
	viewportSize: { w: number; h: number };
	canvasCaptureEnabled: boolean;
}

export type SessionOrigin = 'recorded' | 'imported';

// rrweb event payload é opaco para a extensão — apenas serializa/deserializa.
// Tipagem mínima: timestamp + type + data. rrweb v2 usa enum numérico para `type`
// (0=DomContentLoaded, 1=Load, 2=FullSnapshot, 3=IncrementalSnapshot, 4=Meta, 5=Custom, 6=Plugin).
export interface RrwebEvent {
	type: number;
	data: unknown;
	timestamp: number;
}

export interface RawCallsite {
	file: string;
	line: number;
	column?: number;
}

export interface ResolvedCallsite {
	raw: RawCallsite;
	resolved?: RawCallsite;
}

export interface RedactionConfig {
	enabled: boolean;
	// Network — headers
	headerKeys: string[]; // case-insensitive; ex: ['authorization', 'cookie']
	headerRegex: string[]; // ex: ['^x-.*-token$']
	// Network — bodies
	bodyRegex: string[]; // ex: card-pan, JWT-like
	// Console
	consoleRegex: string[]; // aplicado em ConsoleArgPreview.description
	consoleEnabled: boolean; // permite desligar p/ localhost
	// rrweb
	rrwebMaskAllInputs: boolean; // default false — só password
	rrwebMaskTextSelector: string; // default '.dbb-mask, [data-dbb-mask]'
	// URL gate
	urlBlacklist: string[]; // domains/glob — ex: '*.banco.com.br'
	// Paths em stacks/source maps
	truncateUserPaths: boolean; // default true
	// Retenção
	autoPurgeEnabled: boolean;
	autoPurgeRetentionDays: number; // default 30
}

export type RecommendationSeverity = 'info' | 'warn' | 'error';

export type RecommendationRuleId =
	| 'compression-missing'
	| 'cache-missing'
	| 'mixed-content'
	| 'csp-missing'
	| 'hsts-missing'
	| 'nosniff-missing'
	| 'large-payload'
	| 'image-not-optimized'
	| 'cookie-insecure'
	| 'cors-open';

export interface Recommendation {
	id: string;
	ruleId: RecommendationRuleId;
	severity: RecommendationSeverity;
	timestamp: number;
	phaseId?: string;
	requestId?: string;
	url: string;
	host: string;
	summary: string;
	evidence: Record<string, string>;
	suggestion?: string;
}

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
	rrwebEvents?: RrwebEvent[];
	recommendations?: Recommendation[];
	telemetry?: SessionTelemetry;
	redactionApplied?: RedactionConfig; // NOVO em Phase 6 — opcional
}
