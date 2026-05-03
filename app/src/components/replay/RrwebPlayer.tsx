import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
	/** Quando omitido, calcula a partir do container observado. */
	width?: number;
	/** Quando omitido, calcula como width * 9/16 (aspect padrão). */
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
	triggerResize?: () => void;
}

const ASPECT_RATIO = 16 / 9;
// Threshold em px — mudanças menores que isto são ignoradas para evitar
// re-mount do player a cada pixel de resize do container.
const RESIZE_THRESHOLD_PX = 16;

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
 *
 * Dimensões: quando `width`/`height` não são passadas, mede o container via
 * ResizeObserver e calcula altura preservando aspect 16:9. Re-monta o player
 * apenas quando a mudança ultrapassa `RESIZE_THRESHOLD_PX` (evita reset de
 * currentTime em micro-resizes). Em side panel estreito (~400px) ou viewport
 * curto, o player respeita a largura disponível em vez de fazer overflow.
 */
export const RrwebPlayer = forwardRef<RrwebPlayerHandle, Props>(function RrwebPlayer(
	{ events, autoPlay = false, width: propsWidth, height: propsHeight, onTimeUpdate },
	ref,
) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const playerRef = useRef<RrwebPlayerInstance | null>(null);
	// State observado — null até a primeira medida do ResizeObserver.
	const [observedSize, setObservedSize] = useState<{ w: number; h: number } | null>(null);
	const lastAppliedSize = useRef<{ w: number; h: number } | null>(null);

	// ResizeObserver para medir o container quando dimensões não vêm via props.
	// Side effect: se ambas props vierem explícitas, skip (sem observador).
	useEffect(() => {
		if (propsWidth !== undefined && propsHeight !== undefined) return;
		if (!hostRef.current) return;
		const el = hostRef.current;
		const apply = (): void => {
			const w = Math.max(1, el.clientWidth);
			const h = propsHeight ?? Math.round(w / ASPECT_RATIO);
			setObservedSize((prev) => {
				if (
					prev &&
					Math.abs(prev.w - w) < RESIZE_THRESHOLD_PX &&
					Math.abs(prev.h - h) < RESIZE_THRESHOLD_PX
				) {
					return prev; // sem mudança significativa — evita re-render
				}
				return { w, h };
			});
		};
		apply();
		const ro = new ResizeObserver(apply);
		ro.observe(el);
		return () => {
			ro.disconnect();
		};
	}, [propsWidth, propsHeight]);

	// Dimensões finais usadas no player — props quando explícitas, senão observadas.
	const effectiveWidth = propsWidth ?? observedSize?.w;
	const effectiveHeight = propsHeight ?? observedSize?.h;

	useEffect(() => {
		if (!hostRef.current) return;
		if (events.length < 2) {
			// rrweb-player exige no mínimo 2 eventos (Meta + FullSnapshot) para montar.
			// Sem isso: render fallback no caller via length check; aqui só skip.
			return;
		}
		if (effectiveWidth === undefined || effectiveHeight === undefined) {
			// Aguardando primeira medida do ResizeObserver — re-roda quando size chegar.
			return;
		}

		// Curto-circuito: player já existe e tamanho mudou abaixo do threshold.
		// Evita re-mount em cada pixel de resize.
		if (playerRef.current && lastAppliedSize.current) {
			const dw = Math.abs(lastAppliedSize.current.w - effectiveWidth);
			const dh = Math.abs(lastAppliedSize.current.h - effectiveHeight);
			if (dw < RESIZE_THRESHOLD_PX && dh < RESIZE_THRESHOLD_PX) return;
		}

		// Re-mount: dimensões mudaram acima do threshold (ou primeiro mount).
		// Destruir antes de recriar para liberar listeners e iframe internos.
		if (playerRef.current) {
			try {
				playerRef.current.$destroy?.();
			} catch {
				// rrweb-player pode lançar em $destroy se já destruído — ignore.
			}
			playerRef.current = null;
			if (hostRef.current) hostRef.current.innerHTML = '';
		}

		// `events` da sessão é `RrwebEvent[]` (forma opaca); o player espera
		// `eventWithTime[]` do @rrweb/types. Cast via unknown — runtime compatível.
		type PlayerCtorOptions = ConstructorParameters<typeof RrwebPlayerLib>[0];
		const options = {
			target: hostRef.current,
			props: {
				events: events as unknown as PlayerCtorOptions['props']['events'],
				autoPlay,
				width: effectiveWidth,
				height: effectiveHeight,
				showController: true,
			},
		} satisfies PlayerCtorOptions;
		const player = new RrwebPlayerLib(options) as unknown as RrwebPlayerInstance;
		playerRef.current = player;
		lastAppliedSize.current = { w: effectiveWidth, h: effectiveHeight };

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
	}, [events, autoPlay, effectiveWidth, effectiveHeight, onTimeUpdate]);

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

	return <div ref={hostRef} className="rrweb-player-host h-full w-full" />;
});
