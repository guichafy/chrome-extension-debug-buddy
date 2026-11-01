import { i18n } from '@/i18n/instance';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordingStatus {
	active: boolean;
	sessionId?: string;
	sizeBytes: number;
	durationMs: number;
}

const initialStatus: RecordingStatus = { active: false, sizeBytes: 0, durationMs: 0 };

export function useRecording(tabId: number | null): {
	status: RecordingStatus;
	startRecording: (canvasCaptureEnabled: boolean) => Promise<{ ok: boolean; error?: string }>;
	stopRecording: () => Promise<{ ok: boolean; error?: string }>;
	refresh: () => Promise<void>;
} {
	const [status, setStatus] = useState<RecordingStatus>(initialStatus);
	const pollRef = useRef<number | null>(null);

	const refresh = useCallback(async () => {
		if (tabId === null) return;
		const res = await chrome.runtime.sendMessage({ action: 'getRecordingStatus', tabId });
		if (res?.ok) {
			setStatus({
				active: !!res.active,
				sessionId: res.sessionId,
				sizeBytes: res.sizeBytes ?? 0,
				durationMs: res.durationMs ?? 0,
			});
		}
	}, [tabId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (!status.active) {
			if (pollRef.current !== null) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
			return;
		}
		pollRef.current = window.setInterval(() => {
			void refresh();
		}, 1000);
		return () => {
			if (pollRef.current !== null) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, [status.active, refresh]);

	const startRecording = useCallback(
		async (canvasCaptureEnabled: boolean) => {
			if (tabId === null) {
				return { ok: false, error: i18n.t('sessions:recording.errors.noTargetTab') };
			}
			const res = await chrome.runtime.sendMessage({
				action: 'startRecording',
				tabId,
				canvasCaptureEnabled,
			});
			if (res?.ok) await refresh();
			return res ?? { ok: false, error: i18n.t('common:errors.noResponse') };
		},
		[tabId, refresh],
	);

	const stopRecording = useCallback(async () => {
		if (!status.sessionId) {
			return { ok: false, error: i18n.t('sessions:recording.errors.noActiveSession') };
		}
		const res = await chrome.runtime.sendMessage({
			action: 'stopRecording',
			sessionId: status.sessionId,
		});
		if (res?.ok) await refresh();
		return res ?? { ok: false, error: i18n.t('common:errors.noResponse') };
	}, [status.sessionId, refresh]);

	// Broadcast-driven refresh: background broadcasta `recordingStateChanged`
	// quando recording inicia/para via lifecycle binding (Bug 1+3). Listener
	// chama refresh imediato — UI reage sem esperar o próximo tick do polling
	// de 1s. Polling segue como rede de segurança para tamanho/duração.
	useEffect(() => {
		if (tabId === null) return;
		const handler = (msg: unknown): void => {
			const m = msg as { action?: string; tabId?: number };
			if (m?.action !== 'recordingStateChanged') return;
			// Strict match — broadcasts sem tabId nao sao validos. Os 2 call sites
			// no background sempre incluem tabId; aceitar undefined seria silencioso
			// (no-fallbacks) e dispararia refresh para outras tabs.
			if (m.tabId !== tabId) return;
			void refresh();
		};
		chrome.runtime.onMessage.addListener(handler);
		return () => {
			chrome.runtime.onMessage.removeListener(handler);
		};
	}, [tabId, refresh]);

	return { status, startRecording, stopRecording, refresh };
}
