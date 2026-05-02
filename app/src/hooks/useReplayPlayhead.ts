import { useCallback, useRef, useState } from 'react';
import type { RrwebPlayerHandle } from '@/components/replay/RrwebPlayer';

export interface ReplayPlayheadState {
	/** Tempo corrente em ms desde o início da sessão. */
	currentMs: number;
	/** Callback a passar como `onTimeUpdate` do RrwebPlayer (mantém estado em sincronia). */
	onTimeUpdate: (ms: number) => void;
	/**
	 * Comanda o player a saltar para `ms`. No-op silencioso quando ref ainda
	 * não montou — não emite tempo "fantasma" (no-fallbacks: estado só atualiza
	 * quando o player realmente foi para `ms`).
	 */
	seek: (ms: number) => void;
	/** Ref a passar ao RrwebPlayer. Necessário para `seek` funcionar. */
	playerRef: React.RefObject<RrwebPlayerHandle | null>;
}

/**
 * Mantém o playhead (tempo corrente) sincronizado entre o rrweb-player e
 * a UI React. O player é a fonte da verdade quando tocando; chamadas a `seek`
 * empurram o player para um ponto específico (ex: clicar num evento da timeline).
 */
export function useReplayPlayhead(): ReplayPlayheadState {
	const [currentMs, setCurrentMs] = useState(0);
	const playerRef = useRef<RrwebPlayerHandle | null>(null);

	const onTimeUpdate = useCallback((ms: number) => {
		setCurrentMs(ms);
	}, []);

	const seek = useCallback((ms: number) => {
		const player = playerRef.current;
		if (!player) return;
		player.goto(ms);
		// Atualiza estado imediatamente — ui-update-current-time pode demorar um frame.
		setCurrentMs(ms);
	}, []);

	return { currentMs, onTimeUpdate, seek, playerRef };
}
