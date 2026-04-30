import { useEffect, useState } from 'react';
import { type SessionMarker, EMPTY_SESSION_MARKER } from '@/types/sessionMarker';

// Lê o SessionMarker mantido pelo background. Mesmo padrão de useDebugging:
// busca inicial via sendMessage('getSessionMarker') + listener para
// 'sessionMarkerUpdated' que o background broadcasta em start/stop/navegação/clear.

export function useSessionMarker(): SessionMarker {
	const [marker, setMarker] = useState<SessionMarker>(EMPTY_SESSION_MARKER);

	useEffect(() => {
		let cancelled = false;
		chrome.runtime
			.sendMessage({ action: 'getSessionMarker' })
			.then((response) => {
				if (cancelled) return;
				if (response?.sessionMarker) setMarker(response.sessionMarker);
			})
			.catch((error) => {
				console.error('Erro ao buscar SessionMarker:', error);
			});

		const messageListener = (message: any) => {
			if (message?.action === 'sessionMarkerUpdated' && message.sessionMarker) {
				setMarker(message.sessionMarker);
			}
		};
		chrome.runtime.onMessage.addListener(messageListener);

		return () => {
			cancelled = true;
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, []);

	return marker;
}
