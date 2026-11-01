import { cn } from '@/lib/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon } from '../ui/lucide-icon';
import { INVALID_HOSTNAME, type Tab } from './types';

interface TabRowProps {
	tab: Tab;
	isFocused: boolean;
	isCurrent: boolean;
	onSelect: (tab: Tab) => void;
}

const Favicon: React.FC<{ tab: Tab }> = ({ tab }) => {
	const [errored, setErrored] = React.useState(false);
	const initial = tab.hostname.charAt(0).toUpperCase() || '?';
	if (!tab.favIconUrl || errored) {
		return (
			<div
				data-testid="favicon-placeholder"
				className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground"
				aria-hidden="true"
			>
				{initial}
			</div>
		);
	}
	return (
		<img
			src={tab.favIconUrl}
			alt=""
			loading="lazy"
			onError={() => setErrored(true)}
			className="h-5 w-5 flex-shrink-0 rounded"
		/>
	);
};

export const TabRow: React.FC<TabRowProps> = ({ tab, isFocused, isCurrent, onSelect }) => {
	const { t } = useTranslation('selectTab');
	return (
		// biome-ignore lint/a11y/useSemanticElements: <div role="option"> is required for the listbox pattern; <option> is only valid inside <select>.
		// biome-ignore lint/a11y/useFocusableInteractive: Keyboard navigation is handled by the parent listbox via aria-activedescendant; the row is not directly tabbable.
		// biome-ignore lint/a11y/useKeyWithClickEvents: Keyboard navigation is handled by the parent listbox via aria-activedescendant; the row is not directly tabbable.
		<div
			role="option"
			id={`tab-row-${tab.id}`}
			aria-selected={isFocused}
			onClick={() => onSelect(tab)}
			className={cn(
				'flex w-full cursor-pointer items-center gap-3 border-b border-border px-6 py-2.5 transition-colors last:border-b-0',
				isFocused ? 'bg-accent' : 'hover:bg-muted/50',
			)}
		>
			<Favicon tab={tab} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-medium text-foreground">{tab.title}</span>
					{isCurrent && (
						<span className="flex-shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
							{t('list.current')}
						</span>
					)}
				</div>
				<div className="truncate text-xs text-muted-foreground">{tab.url}</div>
			</div>
			<span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
				{tab.hostname === INVALID_HOSTNAME ? t('list.invalidUrl') : tab.hostname}
			</span>
			<LucideIcon name="chevron-right" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
		</div>
	);
};
