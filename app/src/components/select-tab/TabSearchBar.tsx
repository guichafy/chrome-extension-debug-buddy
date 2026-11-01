import { cn } from '@/lib/utils';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon } from '../ui/lucide-icon';

interface TabSearchBarProps {
	value: string;
	onChange: (value: string) => void;
	inputRef?: React.Ref<HTMLInputElement>;
	className?: string;
}

export const TabSearchBar: React.FC<TabSearchBarProps> = ({
	value,
	onChange,
	inputRef,
	className,
}) => {
	const { t } = useTranslation('selectTab');
	return (
		<div className={cn('relative flex-1', className)}>
			<LucideIcon
				name="search"
				className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				ref={inputRef}
				type="search"
				aria-label={t('search.ariaLabel')}
				aria-controls="tab-listbox"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={t('search.placeholder')}
				className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-12 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-input bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
				/
			</kbd>
		</div>
	);
};
