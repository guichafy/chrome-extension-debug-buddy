import type React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TabRow } from './TabRow';
import type { Tab } from './types';

interface TabListProps {
	tabs: Tab[];
	focusedIndex: number;
	currentTabId: number | null;
	onSelect: (tab: Tab) => void;
}

export const TabList: React.FC<TabListProps> = ({ tabs, focusedIndex, currentTabId, onSelect }) => {
	const { t } = useTranslation('selectTab');
	const containerRef = useRef<HTMLDivElement>(null);
	const focusedTabId = tabs[focusedIndex]?.id;

	useEffect(() => {
		if (focusedTabId === undefined) return;
		const el = containerRef.current?.querySelector(`#tab-row-${focusedTabId}`);
		if (el && 'scrollIntoView' in el) {
			(el as HTMLElement).scrollIntoView({ block: 'nearest' });
		}
	}, [focusedTabId]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: <div role="listbox"> is the canonical ARIA listbox pattern; <select> is only valid for simple option lists, not composite widgets with aria-activedescendant.
		<div
			role="listbox"
			ref={containerRef}
			id="tab-listbox"
			aria-label={t('list.ariaLabel')}
			aria-activedescendant={focusedTabId !== undefined ? `tab-row-${focusedTabId}` : undefined}
			tabIndex={-1}
			className="flex-1 overflow-y-auto"
		>
			{tabs.map((tab, idx) => (
				<TabRow
					key={tab.id}
					tab={tab}
					isFocused={idx === focusedIndex}
					isCurrent={tab.id === currentTabId}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
};
