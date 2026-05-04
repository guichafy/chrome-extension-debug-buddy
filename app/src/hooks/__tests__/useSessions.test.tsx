import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/session/storage';
import { useSessions } from '../useSessions';
import type { Session } from '@/lib/session/types';

const sendMessageMock = vi.fn();

const baseSession = (id: string, startedAt: number): Session => ({
	id,
	schemaVersion: 1,
	startedAt,
	endedAt: null,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://x/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
});

beforeEach(async () => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('useSessions', () => {
	it('lê lista do sessionStore na inicialização', async () => {
		await sessionStore.put(baseSession('a', 1));
		await sessionStore.put(baseSession('b', 2));
		const { result } = renderHook(() => useSessions());
		await waitFor(() => {
			expect(result.current.sessions).toHaveLength(2);
		});
		expect(result.current.sessions.map((s) => s.id)).toEqual(['b', 'a']);
	});

	it('deleteSession chama action e atualiza lista', async () => {
		await sessionStore.put(baseSession('a', 1));
		sendMessageMock.mockResolvedValueOnce({ ok: true });
		const { result } = renderHook(() => useSessions());
		await waitFor(() => expect(result.current.sessions).toHaveLength(1));
		// O deleteSession do hook só chama o action; pra refletir o storage temos
		// que apagar manual também já que o action mockado não persiste.
		await sessionStore.delete('a');
		await act(async () => {
			await result.current.deleteSession('a');
		});
		expect(sendMessageMock).toHaveBeenCalledWith({ action: 'deleteSession', sessionId: 'a' });
		await waitFor(() => expect(result.current.sessions).toHaveLength(0));
	});
});
