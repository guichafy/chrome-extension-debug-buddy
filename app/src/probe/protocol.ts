import type { EnvironmentFingerprint, PageDetectionTrigger } from '@/lib/session/types';
import type { TechHit } from '@/lib/insights/types';

export const PROBE_NAMESPACE = 'debug-buddy-probe';

export type ProbeMessage =
	| {
			ns: typeof PROBE_NAMESPACE;
			type: 'probe:start-detection';
			reason: PageDetectionTrigger;
	  }
	| { ns: typeof PROBE_NAMESPACE; type: 'probe:idle' }
	| {
			ns: typeof PROBE_NAMESPACE;
			type: 'probe:detection';
			payload: {
				url: string;
				timestamp: number;
				triggerType: PageDetectionTrigger;
				fingerprint: EnvironmentFingerprint;
				techs?: TechHit[]; // sub-projeto 2 — opcional, ausente no schema legado
			};
	  }
	| {
			ns: typeof PROBE_NAMESPACE;
			type: 'probe:angular-http-tag';
			payload: {
				url: string;
				method: string;
				timestampHint: number;
				confidence: 'high' | 'medium' | 'low';
			};
	  };

export function isProbeMessage(value: unknown): value is ProbeMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { ns?: unknown }).ns === PROBE_NAMESPACE
	);
}
