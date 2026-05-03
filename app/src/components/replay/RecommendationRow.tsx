import { useState } from 'react';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';

const SEVERITY_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'border-l-destructive bg-destructive/5',
	warn: 'border-l-warning bg-warning/5',
	info: 'border-l-info bg-info/5',
};

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
	error: 'erro',
	warn: 'aviso',
	info: 'info',
};

export function RecommendationRow({ item }: { item: Recommendation }) {
	const [open, setOpen] = useState(false);
	return (
		<button
			type="button"
			onClick={() => setOpen((o) => !o)}
			className={`flex w-full flex-col items-start gap-1 border-l-2 border-b px-3 py-2 text-left text-xs hover:bg-muted/40 ${SEVERITY_CLASSES[item.severity]} animate-in fade-in-0 slide-in-from-right-1 duration-200`}
		>
			<div className="flex w-full items-center gap-2">
				<span className="font-medium uppercase text-[10px]">{SEVERITY_LABEL[item.severity]}</span>
				<span className="font-medium">{item.ruleId}</span>
				<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
					{item.host}
				</span>
			</div>
			<p className="font-mono text-[11px] text-muted-foreground">{item.summary}</p>
			{open && (
				<div className="mt-1 w-full space-y-1 rounded bg-background p-2">
					{Object.entries(item.evidence).map(([k, v]) => (
						<div key={k} className="grid grid-cols-[max-content_1fr] gap-2 font-mono text-[11px]">
							<span className="text-muted-foreground">{k}:</span>
							<span className="break-all">{v}</span>
						</div>
					))}
					{item.suggestion && <p className="border-t pt-1 text-[11px]">{item.suggestion}</p>}
				</div>
			)}
		</button>
	);
}
