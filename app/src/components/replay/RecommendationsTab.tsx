import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';
import { RecommendationRow } from './RecommendationRow';

interface Props {
	items: Recommendation[];
}

const SEVERITIES: RecommendationSeverity[] = ['error', 'warn', 'info'];

export function RecommendationsTab({ items }: Props) {
	const [enabled, setEnabled] = useState<Record<RecommendationSeverity, boolean>>({
		error: true,
		warn: true,
		info: true,
	});

	const filtered = useMemo(() => items.filter((h) => enabled[h.severity]), [items, enabled]);

	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Severity:</span>
				{SEVERITIES.map((s) => (
					<label key={s} htmlFor={`rec-${s}`} className="flex items-center gap-1">
						<Checkbox
							id={`rec-${s}`}
							checked={enabled[s]}
							onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s]: v === true }))}
						/>
						{s}
					</label>
				))}
				<span className="ml-auto text-muted-foreground">
					{filtered.length} / {items.length}
				</span>
			</div>

			<div className="overflow-auto rounded border">
				{filtered.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">
						Nenhuma recomendação{items.length > 0 ? ' com os filtros atuais' : ''}.
					</p>
				) : (
					filtered.map((h) => <RecommendationRow key={h.id} item={h} />)
				)}
			</div>
		</div>
	);
}
