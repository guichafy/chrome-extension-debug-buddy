import { detectDataFetching } from './detectors/dataFetching';
import { detectFramework } from './detectors/framework';
import { detectHttpClients } from './detectors/httpClients';
import { detectStateManagers } from './detectors/stateManagers';
import { isProbeMessage, PROBE_NAMESPACE, type ProbeMessage } from './protocol';
import { installAngularHttpTap } from './state/angularHttpTap';
import { installAngularSignalTap } from './state/angularSignalTap';
import { installNgRxTap } from './state/ngrxTap';
import { installReduxTap } from './state/reduxTap';
import { installZustandTap } from './state/zustandTap';
import type { EnvironmentFingerprint, PageDetectionTrigger } from '@/lib/session/types';

let active = false;
let historyPatched = false;

function isProductionBuild(): boolean {
	// Heurística leve: ausência de hooks de devtools em React/Angular sugere prod build.
	// Refinar em Phase 4-5 com sinais adicionais (minificação detectada, source maps absent).
	const hasReactDevtools = !!(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
		.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	const hasReduxDevtools = !!(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
		.__REDUX_DEVTOOLS_EXTENSION__;
	return !hasReactDevtools && !hasReduxDevtools;
}

function buildFingerprint(): EnvironmentFingerprint {
	return {
		framework: detectFramework(),
		httpClients: detectHttpClients(),
		dataFetching: detectDataFetching(),
		stateManagers: detectStateManagers(),
		detectedAt: Date.now(),
		isProductionBuild: isProductionBuild(),
	};
}

function emitDetection(triggerType: PageDetectionTrigger): void {
	if (!active) return;
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:detection',
		payload: {
			url: location.href,
			timestamp: Date.now(),
			triggerType,
			fingerprint: buildFingerprint(),
		},
	};
	window.postMessage(msg, location.origin);
}

function patchHistoryForSpaRouting(): void {
	const origPush = history.pushState;
	const origReplace = history.replaceState;
	history.pushState = function (...args) {
		const ret = origPush.apply(this, args);
		emitDetection('pushstate');
		return ret;
	};
	history.replaceState = function (...args) {
		const ret = origReplace.apply(this, args);
		emitDetection('replacestate');
		return ret;
	};
	window.addEventListener('popstate', () => emitDetection('popstate'));
}

window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type === 'probe:start-detection') {
		active = true;
		// Patch é one-shot: não há como reverter wrappers sem corromper a app,
		// então deixamos instalado mesmo após probe:idle. `historyPatched` previne
		// double-wrap em ciclos start→idle→start (que dobrariam detections).
		if (!historyPatched) {
			patchHistoryForSpaRouting();
			historyPatched = true;
		}
		// State taps só rodam quando há sessão de gravação ativa. Em modo passivo
		// (withStateTaps=false), não wrappamos as APIs da app — overhead nulo.
		// Idempotentes: chamada futura com withStateTaps=true após start de
		// gravação instala os wrappers.
		if (e.data.withStateTaps) {
			installReduxTap();
			installZustandTap();
			// Angular HttpClient tap: instala wrapper em XMLHttpRequest.prototype quando
			// contexto Angular é detectado. Retorna null em apps não-Angular.
			installAngularHttpTap();
			// Angular Signals tap: wrappa `.set()`/`.update()` em signals expostos via
			// `ng.getComponent()`. Retorna null em apps não-Angular.
			installAngularSignalTap();
			// NgRx tap: wrappa `Store.dispatch` quando `__STORE__` global é encontrado.
			// Retorna null em apps sem Store NgRx exposto.
			installNgRxTap();
		}
		emitDetection(e.data.reason);
	} else if (e.data.type === 'probe:idle') {
		active = false;
	}
});
