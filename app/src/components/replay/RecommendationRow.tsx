import { useState } from 'react';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';

const SEVERITY_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
	warn: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
	info: 'border-l-sky-500 bg-sky-50 dark:bg-sky-950/30',
};

const SEVERITY_LABEL_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'text-red-700 dark:text-red-400',
	warn: 'text-amber-700 dark:text-amber-400',
	info: 'text-sky-700 dark:text-sky-400',
};

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
	error: 'ERRO',
	warn: 'AVISO',
	info: 'INFO',
};

export const RECOMMENDATION_ROW_TOKENS = {
	classes: SEVERITY_CLASSES,
	labelClasses: SEVERITY_LABEL_CLASSES,
	label: SEVERITY_LABEL,
};

function ExpandedDetails({ item }: { item: Recommendation }) {
	return (
		<div className="mt-1 w-full space-y-1 rounded bg-background p-2">
			{Object.entries(item.evidence).map(([k, v]) => (
				<div key={k} className="grid grid-cols-[max-content_1fr] gap-2 font-mono text-[11px]">
					<span className="text-muted-foreground">{k}:</span>
					<span className="break-all">{v}</span>
				</div>
			))}
			{item.suggestion && <p className="border-t pt-1 text-[11px]">{item.suggestion}</p>}
		</div>
	);
}

interface Props {
	item: Recommendation;
	compact?: boolean;
}

export function RecommendationRow({ item, compact = false }: Props) {
	const [open, setOpen] = useState(false);

	if (compact) {
		const pathname = (() => {
			try {
				return new URL(item.url).pathname;
			} catch {
				return item.url;
			}
		})();
		return (
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full flex-col items-start gap-1 border-b px-4 py-1.5 text-left text-xs hover:bg-muted/40"
			>
				<div className="flex w-full items-center gap-2">
					<span className="break-all font-mono">{pathname}</span>
					<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
						{item.host}
					</span>
				</div>
				{open && <ExpandedDetails item={item} />}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setOpen((o) => !o)}
			className={`flex w-full flex-col items-start gap-1 border-b border-l-2 px-3 py-2 text-left text-xs hover:bg-muted/40 ${SEVERITY_CLASSES[item.severity]} animate-in fade-in-0 slide-in-from-right-1 duration-200`}
		>
			<div className="flex w-full items-center gap-2">
				<span className={`font-semibold text-[10px] ${SEVERITY_LABEL_CLASSES[item.severity]}`}>
					{SEVERITY_LABEL[item.severity]}
				</span>
				<span className="font-medium">{item.ruleId}</span>
				<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
					{item.host}
				</span>
			</div>
			<p className="font-mono text-[11px] text-muted-foreground">{item.summary}</p>
			{open && <ExpandedDetails item={item} />}
		</button>
	);
}
