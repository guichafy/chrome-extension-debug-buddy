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
			if (tabId === null) return { ok: false, error: 'Sem tab alvo' };
			const res = await chrome.runtime.sendMessage({
				action: 'startRecording',
				tabId,
				canvasCaptureEnabled,
			});
			if (res?.ok) await refresh();
			return res ?? { ok: false, error: 'Sem resposta' };
		},
		[tabId, refresh],
	);

	const stopRecording = useCallback(async () => {
		if (!status.sessionId) return { ok: false, error: 'Sem sessão ativa' };
		const res = await chrome.runtime.sendMessage({
			action: 'stopRecording',
			sessionId: status.sessionId,
		});
		if (res?.ok) await refresh();
		return res ?? { ok: false, error: 'Sem resposta' };
	}, [status.sessionId, refresh]);

	return { status, startRecording, stopRecording, refresh };
}
