import React from 'react';
import { cn } from '@/lib/utils';

interface DomainChipFilterProps {
	domains: { name: string; count: number }[];
	total: number;
	active: string | null;
	onChange: (domain: string | null) => void;
}

const Chip: React.FC<{
	label: string;
	count: number;
	pressed: boolean;
	onClick: () => void;
	ariaLabel?: string;
}> = ({ label, count, pressed, onClick, ariaLabel }) => (
	<button
		type="button"
		aria-pressed={pressed}
		aria-label={ariaLabel}
		onClick={onClick}
		className={cn(
			'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
			pressed
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-input bg-background text-foreground hover:bg-accent',
		)}
	>
		<span>{label}</span>
		<span
			className={cn('text-[10px] tabular-nums', pressed ? 'opacity-80' : 'text-muted-foreground')}
		>
			{count}
		</span>
	</button>
);

export const DomainChipFilter: React.FC<DomainChipFilterProps> = ({
	domains,
	total,
	active,
	onChange,
}) => {
	return (
		<div className="flex flex-wrap gap-1.5">
			<Chip
				label="Todos"
				count={total}
				pressed={active === null}
				onClick={() => onChange(null)}
				ariaLabel="Todos — Mostrar todos os domínios"
			/>
			{domains.map((d) => (
				<Chip
					key={d.name}
					label={d.name}
					count={d.count}
					pressed={active === d.name}
					onClick={() => onChange(d.name)}
				/>
			))}
		</div>
	);
};
