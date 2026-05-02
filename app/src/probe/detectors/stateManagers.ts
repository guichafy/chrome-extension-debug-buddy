import type { StateManagerDetection } from '@/lib/session/types';

export function detectStateManagers(): StateManagerDetection[] {
	const out: StateManagerDetection[] = [];

	// Redux: presença do hook do DevTools. Phase 1a não conta stores
	// (precisa wrappar createStore). storesDetected=0 sinaliza "presente, não contado".
	if (
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__
	) {
		out.push({ name: 'redux', storesDetected: 0, treatment: 'tracked' });
	}

	// Zustand, MobX, Jotai, NgRx, Angular signals: detecção robusta exige
	// hooks em create() / store factories. Implementado em Phase 4.

	return out;
}
