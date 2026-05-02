import { isProbeMessage, PROBE_NAMESPACE, type ProbeMessage } from './protocol';

// Recebe mensagens do MAIN (probe) e relaya pro background via chrome.runtime.
window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type === 'probe:detection') {
		chrome.runtime
			.sendMessage({ action: 'pageDetected', payload: e.data.payload })
			.catch((err: unknown) => {
				// Canal invalidado quando a extensão é recarregada — silenciar.
				// (Outros erros propagam pra DevTools da página debugada.)
				if (String(err).includes('Extension context invalidated')) return;
				throw err;
			});
	} else if (e.data.type === 'probe:state-change') {
		chrome.runtime
			.sendMessage({ action: 'stateChange', statePayload: e.data.payload })
			.catch((err: unknown) => {
				if (String(err).includes('Extension context invalidated')) return;
				throw err;
			});
	}
});

// Recebe mensagens do background e relaya pro MAIN (probe) via postMessage.
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	if (message?.action === 'probeStartDetection') {
		const msg: ProbeMessage = {
			ns: PROBE_NAMESPACE,
			type: 'probe:start-detection',
			reason: message.reason,
		};
		window.postMessage(msg, location.origin);
	} else if (message?.action === 'probeIdle') {
		const msg: ProbeMessage = {
			ns: PROBE_NAMESPACE,
			type: 'probe:idle',
		};
		window.postMessage(msg, location.origin);
	}
	return false;
});
