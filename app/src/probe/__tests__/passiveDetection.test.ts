import { describe, expect, test, beforeEach } from 'vitest';
import { PROBE_NAMESPACE } from '../protocol';
import { _resetReduxTapForTests } from '../state/reduxTap';
import { _resetZustandTapForTests } from '../state/zustandTap';

// Phase C: state taps são instalados incondicionalmente em probe:start-detection.
// Não há mais flag `withStateTaps` no protocolo — UI passiva consome via
// `liveStateChange` broadcast (independente de gravação ativa).
//
// Importação dinâmica do probe/main para garantir que `window.addEventListener`
// já foi registrado antes do dispatch.
async function loadProbeMain(): Promise<void> {
	await import('../main');
}

function dispatchStartDetection(): void {
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

describe('probe start-detection (Phase C)', () => {
	test('probe:start-detection instala redux tap incondicionalmente', async () => {
		await loadProbeMain();
		dispatchStartDetection();
		const after = (window as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__;
		expect(typeof after).toBe('function');
	});
});
