import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { TabSearchBar } from './TabSearchBar';
import { DomainChipFilter } from './DomainChipFilter';
import { TabList } from './TabList';
import { EmptyState } from './EmptyState';
import { useFilteredTabs } from './hooks/useFilteredTabs';
import type { Tab } from './types';

interface SelectTabDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectTab: (tabId: number, tabTitle: string, tabUrl: string) => void;
}

const isFormElement = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export const SelectTabDialog: React.FC<SelectTabDialogProps> = ({
	open,
	onOpenChange,
	onSelectTab,
}) => {
	const [query, setQuery] = useState('');
	const [activeDomain, setActiveDomain] = useState<string | null>(null);
	const [focusedIndex, setFocusedIndex] = useState(0);
	const [currentTabId, setCurrentTabId] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { state, error, allTabs, filteredTabs, domains, reload } = useFilteredTabs(
		open,
		query,
		activeDomain,
	);

	useEffect(() => {
		if (!open) return;
		setQuery('');
		setActiveDomain(null);
		setFocusedIndex(0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		chrome.storage.local
			.get(['targetTabInfo'])
			.then((data) => {
				if (cancelled) return;
				const info = (data as { targetTabInfo?: { tabId?: number } }).targetTabInfo;
				setCurrentTabId(typeof info?.tabId === 'number' ? info.tabId : null);
			})
			.catch((err) => {
				console.warn('select-tab: falha ao ler targetTabInfo', err);
				if (!cancelled) setCurrentTabId(null);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: query e activeDomain são gatilhos de reset, não valores lidos dentro do efeito
	useEffect(() => {
		setFocusedIndex(0);
	}, [query, activeDomain]);

	const handleSelect = useCallback(
		(tab: Tab) => {
			onSelectTab(tab.id, tab.title, tab.url);
			onOpenChange(false);
		},
		[onSelectTab, onOpenChange],
	);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				setFocusedIndex((idx) => Math.min(filteredTabs.length - 1, idx + 1));
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				setFocusedIndex((idx) => Math.max(0, idx - 1));
				return;
			}
			if (e.key === 'Enter') {
				const tab = filteredTabs[focusedIndex];
				if (tab) {
					e.preventDefault();
					handleSelect(tab);
				}
				return;
			}
			if (e.key === '/' && !isFormElement(e.target)) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [open, filteredTabs, focusedIndex, handleSelect]);

	const onClearSearch = () => {
		setQuery('');
		setActiveDomain(null);
	};

	const onRetry = () => reload();

	let body: React.ReactNode;
	if (state === 'loading') {
		body = <EmptyState variant="loading" />;
	} else if (state === 'error') {
		body = <EmptyState variant="error" error={error ?? undefined} onRetry={onRetry} />;
	} else if (allTabs.length === 0) {
		body = <EmptyState variant="no-tabs" />;
	} else if (filteredTabs.length === 0) {
		body = <EmptyState variant="no-results" query={query} onClearSearch={onClearSearch} />;
	} else {
		body = (
			<TabList
				tabs={filteredTabs}
				focusedIndex={focusedIndex}
				currentTabId={currentTabId}
				onSelect={handleSelect}
			/>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="px-6 pb-4 pt-6">
					<DialogTitle>Selecionar aba para interceptar</DialogTitle>
					<DialogDescription>
						Escolha a aba que deseja monitorar as requisições de rede.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 border-y border-border bg-muted/30 px-6 py-4">
					<div className="flex items-center gap-3">
						<TabSearchBar value={query} onChange={setQuery} inputRef={inputRef} />
						<span className="whitespace-nowrap text-xs text-muted-foreground">
							{allTabs.length} {allTabs.length === 1 ? 'aba' : 'abas'}
						</span>
					</div>
					{state === 'ready' && allTabs.length > 0 && (
						<DomainChipFilter
							domains={domains.filter((d) => d.name !== '')}
							total={allTabs.length}
							active={activeDomain}
							onChange={setActiveDomain}
						/>
					)}
				</div>

				<div className="flex min-h-[260px] flex-1 flex-col overflow-hidden">{body}</div>

				<div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-3 text-[11px] text-muted-foreground">
					<span className="flex gap-3">
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">↑</kbd>
							<kbd className="ml-0.5 rounded border border-border bg-background px-1 font-mono">
								↓
							</kbd>{' '}
							Navegar
						</span>
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">Enter</kbd>{' '}
							Selecionar
						</span>
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">Esc</kbd>{' '}
							Fechar
						</span>
					</span>
					{state === 'ready' && allTabs.length > 0 && (
						<span>
							{filteredTabs.length} de {allTabs.length} abas visíveis
						</span>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
