import { describe, expect, test, beforeEach } from 'vitest';
import { PROBE_NAMESPACE } from '../protocol';
import { _resetReduxTapForTests } from '../state/reduxTap';
import { _resetZustandTapForTests } from '../state/zustandTap';

// Regressão Bug 4: probe deve emitir detection mas NÃO instalar state taps
// quando ativado em modo passivo (withStateTaps=false). State taps wrappam
// APIs da app — overhead constante por toda a sessão. Em passivo, sem
// persistência, esse custo seria puro desperdício e violaria a meta de
// "linter de runtime sem overhead".
//
// Importação dinâmica do probe/main para garantir que `window.addEventListener`
// já foi registrado antes do dispatch.
async function loadProbeMain(): Promise<void> {
	await import('../main');
}

function dispatchStartDetection(withStateTaps: boolean): void {
	// dispatchEvent é síncrono; postMessage no jsdom às vezes não roda no
	// mesmo turn. Usamos MessageEvent direto + source=window pra passar pelo
	// guard `if (e.source !== window) return;` em probe/main.
	const event = new MessageEvent('message', {
		source: window,
		origin: location.origin,
		data: {
			ns: PROBE_NAMESPACE,
			type: 'probe:start-detection',
			reason: 'initial',
			withStateTaps,
		},
	});
	window.dispatchEvent(event);
}

beforeEach(() => {
	_resetReduxTapForTests();
	_resetZustandTapForTests();
	// Limpa qualquer wrapper que outro teste tenha deixado.
	(window as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__ = undefined;
});

describe('probe passive detection (Bug 4)', () => {
	test('withStateTaps=false NÃO instala redux tap', async () => {
		await loadProbeMain();
		dispatchStartDetection(false);
		const after = (window as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__;
		// installReduxTap sobrescreveria essa global; não tendo sido chamado,
		// a property continua o valor sentinel que setamos no beforeEach.
		expect(after).toBeUndefined();
	});

	test('withStateTaps=true INSTALA redux tap (cria wrapper em __REDUX_DEVTOOLS_EXTENSION__)', async () => {
		await loadProbeMain();
		dispatchStartDetection(true);
		const after = (window as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__;
		expect(typeof after).toBe('function');
	});
});
