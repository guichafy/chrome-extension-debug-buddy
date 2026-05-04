import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RrwebPlayerHandle } from '@/components/replay/RrwebPlayer';
import { useReplayPlayhead } from '../useReplayPlayhead';

describe('useReplayPlayhead', () => {
	it('inicia com currentMs=0', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		expect(result.current.currentMs).toBe(0);
	});

	it('onTimeUpdate atualiza currentMs', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		act(() => {
			result.current.onTimeUpdate(1500);
		});
		expect(result.current.currentMs).toBe(1500);
	});

	it('seek sem ref montada é no-op silencioso', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		expect(() => {
			act(() => {
				result.current.seek(500);
			});
		}).not.toThrow();
		// currentMs NÃO atualiza quando player não está montado (no-fallbacks: estado
		// sincronizado só após ref existir; otherwise UI mostraria tempo "fantasma").
		expect(result.current.currentMs).toBe(0);
	});

	it('seek com ref chama goto e atualiza currentMs', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		const goto = vi.fn();
		const fakePlayer: RrwebPlayerHandle = {
			goto,
			getCurrentTime: () => null,
			play: vi.fn(),
			pause: vi.fn(),
		};
		act(() => {
			// React 19 desaconselha `MutableRefObject`; o `RefObject<T | null>` aceita
			// atribuição em `.current` quando T inclui null. Cast só para silenciar
			// readonly visual no tipo público da hook.
			(result.current.playerRef as { current: RrwebPlayerHandle | null }).current = fakePlayer;
			result.current.seek(2500);
		});
		expect(goto).toHaveBeenCalledWith(2500);
		expect(result.current.currentMs).toBe(2500);
	});
});
