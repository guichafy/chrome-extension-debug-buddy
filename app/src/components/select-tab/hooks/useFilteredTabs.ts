import { useCallback, useEffect, useMemo, useState } from 'react';
import { INVALID_HOSTNAME, type Tab } from '../types';

const INELIGIBLE_PREFIXES = [
	'chrome://',
	'chrome-extension://',
	'about:',
	'view-source:',
	'devtools://',
];

interface RawTab extends chrome.tabs.Tab {}

interface UseFilteredTabsResult {
	state: 'loading' | 'ready' | 'error';
	error: Error | null;
	allTabs: Tab[];
	filteredTabs: Tab[];
	domains: { name: string; count: number }[];
	reload: () => void;
}

const isEligible = (t: RawTab): t is RawTab & { id: number; title: string; url: string } => {
	if (typeof t.id !== 'number') return false;
	if (!t.title || t.title.length === 0) return false;
	if (!t.url || t.url.length === 0) return false;
	return !INELIGIBLE_PREFIXES.some((prefix) => t.url!.startsWith(prefix));
};

const computeHostname = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return INVALID_HOSTNAME;
	}
};

const queryTabs = (): Promise<RawTab[]> =>
	new Promise((resolve, reject) => {
		try {
			const maybe: unknown = chrome.tabs.query({ currentWindow: true }, (tabs) => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message ?? 'Erro desconhecido em chrome.tabs.query'));
					return;
				}
				resolve(tabs);
			});
			// Em MV3 o método também retorna Promise — se for o caso, encadeie
			if (maybe && typeof (maybe as any).then === 'function') {
				(maybe as Promise<RawTab[]>).then(resolve, reject);
			}
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});

export function useFilteredTabs(
	open: boolean,
	query: string,
	activeDomain: string | null,
): UseFilteredTabsResult {
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [error, setError] = useState<Error | null>(null);
	const [allTabs, setAllTabs] = useState<Tab[]>([]);
	const [version, setVersion] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: version só serve de gatilho para reload, não é lido dentro do efeito
	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setState('loading');
		setError(null);
		queryTabs()
			.then((raw) => {
				if (cancelled) return;
				const eligible = raw.filter(isEligible).map<Tab>((t) => ({
					id: t.id,
					title: t.title,
					url: t.url,
					favIconUrl: t.favIconUrl,
					index: t.index,
					hostname: computeHostname(t.url),
				}));
				setAllTabs(eligible);
				setState('ready');
			})
			.catch((err: Error) => {
				if (cancelled) return;
				setError(err);
				setAllTabs([]);
				setState('error');
			});
		return () => {
			cancelled = true;
		};
	}, [open, version]);

	const reload = useCallback(() => setVersion((v) => v + 1), []);

	const domains = useMemo(() => {
		const counts = new Map<string, number>();
		for (const t of allTabs) {
			counts.set(t.hostname, (counts.get(t.hostname) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	}, [allTabs]);

	const filteredTabs = useMemo(() => {
		const q = query.trim().toLocaleLowerCase();
		return allTabs.filter((t) => {
			if (q.length > 0) {
				const matchTitle = t.title.toLocaleLowerCase().includes(q);
				const matchUrl = t.url.toLocaleLowerCase().includes(q);
				if (!matchTitle && !matchUrl) return false;
			}
			if (activeDomain !== null && t.hostname !== activeDomain) return false;
			return true;
		});
	}, [allTabs, query, activeDomain]);

	return { state, error, allTabs, filteredTabs, domains, reload };
}
