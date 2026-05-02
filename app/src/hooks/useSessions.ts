import { useCallback, useEffect, useState } from 'react';
import { sessionStore } from '@/lib/session/storage';
import type { Session } from '@/lib/session/types';

export function useSessions(): {
	sessions: Session[];
	refresh: () => Promise<void>;
	deleteSession: (id: string) => Promise<void>;
} {
	const [sessions, setSessions] = useState<Session[]>([]);

	const refresh = useCallback(async () => {
		const list = await sessionStore.list();
		setSessions(list);
	}, []);

	const deleteSession = useCallback(
		async (id: string) => {
			const res = await chrome.runtime.sendMessage({ action: 'deleteSession', sessionId: id });
			if (res?.ok) await refresh();
		},
		[refresh],
	);

	useEffect(() => {
		void refresh();
		// Re-read a cada 5s pra capturar novas sessions criadas em background
		const interval = window.setInterval(() => {
			void refresh();
		}, 5000);
		return () => clearInterval(interval);
	}, [refresh]);

	return { sessions, refresh, deleteSession };
}
