import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

interface AngularRuntime {
	ng?: {
		getComponent?: (el: unknown) => unknown;
		ɵsignal?: unknown;
	};
}

let signalIdCounter = 0;

function probeSignalApi(): { confidence: 'high' | 'medium' | 'low' } {
	const ng = (window as unknown as AngularRuntime).ng;
	if (!ng) return { confidence: 'low' };
	if (typeof (ng as { ɵsignal?: unknown }).ɵsignal === 'function') {
		return { confidence: 'high' };
	}
	return { confidence: 'low' };
}

export function installAngularSignalTap(): { uninstall: () => void } | null {
	const ng = (window as unknown as AngularRuntime).ng;
	if (!ng) return null;
	probeSignalApi(); // documenta confidence pra uso futuro

	const wrappedSignals = new WeakSet<object>();

	function emitChange(storeId: string, prev: unknown, next: unknown): void {
		const msg: ProbeMessage = {
			ns: PROBE_NAMESPACE,
			type: 'probe:state-change',
			payload: {
				storeId,
				storeKind: 'angular-signal',
				timestamp: Date.now(),
				prev,
				next,
			},
		};
		window.postMessage(msg, location.origin);
	}

	function wrapInstance(instance: unknown): boolean {
		if (typeof instance !== 'object' || instance === null) return false;
		let wrappedAny = false;
		for (const key of Object.keys(instance as object)) {
			const val = (instance as Record<string, unknown>)[key];
			if (typeof val !== 'function') continue;
			const fn = val as { set?: unknown; update?: unknown };
			if (typeof fn.set !== 'function' || typeof fn.update !== 'function') continue;
			if (wrappedSignals.has(fn as object)) continue;
			wrappedSignals.add(fn as object);
			signalIdCounter++;
			const id = `sig:${signalIdCounter}#${key}`;
			const origSet = fn.set as (v: unknown) => void;
			const origUpdate = fn.update as (mut: (cur: unknown) => unknown) => void;
			fn.set = function (v: unknown) {
				const before = (val as unknown as () => unknown)();
				origSet.call(this, v);
				emitChange(id, before, v);
			};
			fn.update = function (mut: (cur: unknown) => unknown) {
				const before = (val as unknown as () => unknown)();
				origUpdate.call(this, mut);
				const after = (val as unknown as () => unknown)();
				emitChange(id, before, after);
			};
			wrappedAny = true;
		}
		return wrappedAny;
	}

	const origGetComponent = ng.getComponent;
	if (origGetComponent) {
		ng.getComponent = function (el: unknown) {
			const inst = origGetComponent.call(this, el);
			if (inst) wrapInstance(inst);
			return inst;
		};
	}

	const angularEls = document.querySelectorAll('[_nghost-ng-c0], app-root, [ng-version]');
	angularEls.forEach((el) => {
		try {
			const inst = origGetComponent?.call(ng, el);
			if (inst) wrapInstance(inst);
		} catch {
			// silencioso; tap é best-effort.
		}
	});

	return {
		uninstall: () => {
			if (origGetComponent) ng.getComponent = origGetComponent;
		},
	};
}

export function angularSignalsTrackable(): boolean {
	const ng = (window as unknown as AngularRuntime).ng;
	return !!ng?.getComponent;
}
