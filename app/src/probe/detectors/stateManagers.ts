import type { StateManagerDetection } from '@/lib/session/types';
import { angularSignalsTrackable } from '../state/angularSignalTap';
import { reduxStoreRegistry } from '../state/reduxTap';
import { zustandStoreRegistry } from '../state/zustandTap';

export function detectStateManagers(): StateManagerDetection[] {
	const out: StateManagerDetection[] = [];

	// Redux: presença do hook do DevTools OU stores wrappadas pelo tap.
	// `storesDetected=0` permanece quando o hook está presente mas nenhuma
	// store foi instanciada ainda (tap não disparou).
	const hasReduxDevtools = !!(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
		.__REDUX_DEVTOOLS_EXTENSION__;
	if (hasReduxDevtools || reduxStoreRegistry.count > 0) {
		out.push({ name: 'redux', storesDetected: reduxStoreRegistry.count, treatment: 'tracked' });
	}

	// Zustand: detecção via proxy em globalThis.zustand.create (Phase 4).
	if (zustandStoreRegistry.count > 0) {
		out.push({
			name: 'zustand',
			storesDetected: zustandStoreRegistry.count,
			treatment: 'tracked',
		});
	}

	// Angular Signals: detecção via presença de `window.ng.getComponent` (Phase 5).
	if (angularSignalsTrackable()) {
		out.push({ name: 'angular-signal', storesDetected: 0, treatment: 'tracked' });
	}

	// MobX, Jotai, NgRx: ainda não cobertos.

	return out;
}
