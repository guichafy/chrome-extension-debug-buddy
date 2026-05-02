import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
// rrweb-player é alpha — types do default export já vêm tipados em alpha.20,
// mas o construtor exige `props.events` como `eventWithTime[]` enquanto a sessão
// armazena `RrwebEvent[]` (formato opaco). Cast controlado abaixo.
import RrwebPlayerLib from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { RrwebEvent } from '@/lib/session/types';

export interface RrwebPlayerHandle {
	goto: (timeMs: number) => void;
	/**
	 * Tempo corrente em ms (relativo ao início do replay) ou `null` quando o
	 * player ainda não montou (ex: ref consultada antes de events chegarem).
	 * Caller decide como tratar — no-fallbacks: não inventamos `0` como tempo.
	 */
	getCurrentTime: () => number | null;
	play: () => void;
	pause: () => void;
}

interface Props {
	events: RrwebEvent[];
	autoPlay?: boolean;
	width?: number;
	height?: number;
	onTimeUpdate?: (currentMs: number) => void;
}

interface RrwebPlayerInstance {
	goto: (ms: number) => void;
	getCurrentTime: () => number;
	play: () => void;
	pause: () => void;
	addEventListener: (event: string, handler: (payload: unknown) => void) => void;
	$destroy?: () => void;
}

/**
 * Wrapper React de rrweb-player. Decisões de isolamento (Phase 2 Task 9):
 *
 * - **Não envolvemos o player em `<iframe sandbox srcDoc>`** no shell da
 *   extensão, mesmo que a spec (seção 14.8) recomende. O próprio rrweb-player
 *   v2 cria um iframe interno (`replayer-wrapper > iframe`) que já isola o
 *   DOM gravado do shell. Adicionar outro iframe externo seria redundante e
 *   quebraria imports ESM (`srcDoc` não resolve módulos).
 * - **Viewer.html standalone** (`viewerTemplate.ts`): o HTML inteiro é o
 *   próprio iframe quando aberto via `file://` ou anexado em Jira/Slack —
 *   browser trata como documento isolado. Sem ajuste extra.
 * - **CSP**: `rrweb-player` v2 não usa `eval`/`new Function` no runtime de
 *   replay. MV3 default `script-src 'self'; object-src 'self'` é suficiente.
 * - **Shadow DOM nativo**: replayer-wrapper já cria uma boundary. Se uma app
 *   debugada tiver CSS agressivo que vaze (improvável), Phase 2.x adiciona
 *   Shadow Root ao host.
 */
export const RrwebPlayer = forwardRef<RrwebPlayerHandle, Props>(function RrwebPlayer(
	{ events, autoPlay = false, width = 1024, height = 576, onTimeUpdate },
	ref,
) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const playerRef = useRef<RrwebPlayerInstance | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		if (events.length < 2) {
			// rrweb-player exige no mínimo 2 eventos (Meta + FullSnapshot) para montar.
			// Sem isso: render fallback no caller via length check; aqui só skip.
			return;
		}
		// `events` da sessão é `RrwebEvent[]` (forma opaca); o player espera
		// `eventWithTime[]` do @rrweb/types. Cast via unknown — runtime compatível.
		type PlayerCtorOptions = ConstructorParameters<typeof RrwebPlayerLib>[0];
		const options = {
			target: hostRef.current,
			props: {
				events: events as unknown as PlayerCtorOptions['props']['events'],
				autoPlay,
				width,
				height,
				showController: true,
			},
		} satisfies PlayerCtorOptions;
		const player = new RrwebPlayerLib(options) as unknown as RrwebPlayerInstance;
		playerRef.current = player;

		if (onTimeUpdate) {
			player.addEventListener('ui-update-current-time', (payload: unknown) => {
				const p = payload as { payload: number } | number;
				const ms = typeof p === 'number' ? p : p.payload;
				onTimeUpdate(ms);
			});
		}

		return () => {
			try {
				playerRef.current?.$destroy?.();
			} finally {
				playerRef.current = null;
				if (hostRef.current) hostRef.current.innerHTML = '';
			}
		};
	}, [events, autoPlay, width, height, onTimeUpdate]);

	useImperativeHandle(
		ref,
		(): RrwebPlayerHandle => ({
			goto: (ms: number) => playerRef.current?.goto(ms),
			getCurrentTime: () => (playerRef.current ? playerRef.current.getCurrentTime() : null),
			play: () => playerRef.current?.play(),
			pause: () => playerRef.current?.pause(),
		}),
		[],
	);

	return <div ref={hostRef} className="rrweb-player-host" />;
});
