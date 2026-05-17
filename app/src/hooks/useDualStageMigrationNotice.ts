import { useCallback, useEffect, useState } from 'react';

// Phase 9: aviso one-shot ao usuário sobre a migração breaking pra schema
// dual-stage (Rule.stage + Rule.actions[]). Storage key versionada pra evitar
// confusão com migrações futuras.
export const DUAL_STAGE_NOTICE_KEY = 'dual_stage_migration_notice_dismissed_v1';

interface NoticeState {
	show: boolean;
	dismiss: () => Promise<void>;
}

export function useDualStageMigrationNotice(): NoticeState {
	const [show, setShow] = useState(false);

	useEffect(() => {
		let cancelled = false;
		chrome.storage.local.get([DUAL_STAGE_NOTICE_KEY]).then((stored) => {
			if (cancelled) return;
			if (!stored[DUAL_STAGE_NOTICE_KEY]) setShow(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const dismiss = useCallback(async () => {
		await chrome.storage.local.set({ [DUAL_STAGE_NOTICE_KEY]: Date.now() });
		setShow(false);
	}, []);

	return { show, dismiss };
}
