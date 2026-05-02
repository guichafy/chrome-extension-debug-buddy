import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AntipatternHit, AntipatternSeverity } from '@/lib/session/types';
import { AntipatternHitRow } from './AntipatternHitRow';

interface Props {
	hits: AntipatternHit[];
	startedAt: number;
}

const SEVERITIES: AntipatternSeverity[] = ['error', 'warn', 'info'];

export function AntipatternsTab({ hits, startedAt }: Props) {
	const [enabled, setEnabled] = useState<Record<AntipatternSeverity, boolean>>({
		error: true,
		warn: true,
		info: true,
	});

	const filtered = useMemo(() => hits.filter((h) => enabled[h.severity]), [hits, enabled]);

	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Severity:</span>
				{SEVERITIES.map((s) => (
					<label key={s} htmlFor={`ap-${s}`} className="flex items-center gap-1">
						<Checkbox
							id={`ap-${s}`}
							checked={enabled[s]}
							onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s]: v === true }))}
						/>
						{s}
					</label>
				))}
				<span className="ml-auto text-muted-foreground">
					{filtered.length} / {hits.length}
				</span>
			</div>

			<div className="overflow-auto rounded border">
				{filtered.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">
						Nenhum antipattern detectado{hits.length > 0 ? ' com os filtros atuais' : ''}.
					</p>
				) : (
					filtered.map((hit, i) => <AntipatternHitRow key={i} hit={hit} startedAt={startedAt} />)
				)}
			</div>
		</div>
	);
}
