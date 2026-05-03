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

export type StoreKind = 'redux' | 'zustand' | 'angular-signal' | 'ngrx';

export interface StateSnapshot {
	storeId: string;
	storeKind: StoreKind;
	data: unknown;
	timestamp: number;
}

export interface StateKeyframe {
	storeId: string;
	storeKind: StoreKind;
	timestamp: number;
	phaseId: string;
	/** lz-string compressToBase64 de JSON.stringify(state) */
	snapshotCompressed: string;
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
	/** Map storeId → primeiro snapshot capturado dele dentro da fase. */
	stateBaseline?: Record<string, StateSnapshot>;
	stateKeyframes?: StateKeyframe[];
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
	  }
	| {
			type: 'state';
			timestamp: number;
			phaseId: string;
			storeId: string;
			storeKind: StoreKind;
			diffCompressed: string;
			sequenceNum: number;
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

export type AntipatternSeverity = 'info' | 'warn' | 'error';

export type AntipatternId =
	| 'dup-req-burst'
	| 'retry-storm'
	| 'effect-fetch-loop'
	| 'waterfall'
	| 'auth-refresh-storm';

export interface RawCallsite {
	file: string;
	line: number;
	column?: number;
}

export interface ResolvedCallsite {
	raw: RawCallsite;
	resolved?: RawCallsite;
}

export interface AntipatternHit {
	patternId: AntipatternId;
	severity: AntipatternSeverity;
	startTimestamp: number;
	endTimestamp: number;
	phaseId: string;
	evidenceEventIds: string[];
	context: {
		component?: string;
		callsite?: ResolvedCallsite;
		summary: string;
	};
	suggestion?: string;
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
	// State
	stateBlacklistPaths: string[]; // glob simples — ex: 'auth.*.token'
	stateWhitelistPaths: string[]; // se preenchido, SÓ esses paths são preservados
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
	antipatternHits?: AntipatternHit[];
	telemetry?: SessionTelemetry;
	redactionApplied?: RedactionConfig; // NOVO em Phase 6 — opcional
}
