import { useState } from 'react';
import type { CategoryGroup } from '@/lib/insights/groupByCategory';
import { TechItem } from './TechItem';

interface Props {
	group: CategoryGroup;
	defaultOpen?: boolean;
}

export function TechCategorySection({ group, defaultOpen = false }: Props) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="border-b last:border-b-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent"
				aria-expanded={open}
			>
				<span className="font-medium text-xs">{group.categoryName}</span>
				<span className="text-[10px] text-muted-foreground">{group.techs.length}</span>
			</button>
			{open && (
				<div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
					{group.techs.map((t) => (
						<TechItem key={t.name} tech={t} />
					))}
				</div>
			)}
		</section>
	);
}
