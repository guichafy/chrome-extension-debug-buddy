import { useCallback, useEffect, useState } from 'react';
import type { RedactionConfig } from '@/lib/session/types';

interface UsePrivacyConfigResult {
	config: RedactionConfig | null;
	loading: boolean;
	error: string | null;
	saving: boolean;
	save: (next: RedactionConfig) => Promise<{ ok: boolean; error?: string }>;
	reload: () => Promise<void>;
	purgeNow: () => Promise<{ ok: boolean; purgedCount?: number; error?: string }>;
}

export function usePrivacyConfig(): UsePrivacyConfigResult {
	const [config, setConfig] = useState<RedactionConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		const res = await chrome.runtime.sendMessage({ action: 'getPrivacyConfig' });
		if (res?.ok && res.privacyConfig) {
			setConfig(res.privacyConfig);
		} else {
			setError(res?.error ?? 'Falha ao carregar privacyConfig');
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const save = useCallback(async (next: RedactionConfig) => {
		setSaving(true);
		setError(null);
		const res = await chrome.runtime.sendMessage({
			action: 'setPrivacyConfig',
			config: next,
		});
		setSaving(false);
		if (res?.ok) {
			setConfig(next);
			return { ok: true as const };
		}
		const err = res?.error ?? 'Falha ao salvar privacyConfig';
		setError(err);
		return { ok: false as const, error: err };
	}, []);

	const purgeNow = useCallback(async () => {
		const res = await chrome.runtime.sendMessage({ action: 'purgeOldSessions' });
		if (res?.ok) {
			return { ok: true as const, purgedCount: res.purgedCount };
		}
		return { ok: false as const, error: res?.error ?? 'Falha ao purgar' };
	}, []);

	return { config, loading, error, saving, save, reload, purgeNow };
}
