import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { resolveCallsite } from '@/lib/session/sourceMap';
import type { AntipatternHit, ResolvedCallsite } from '@/lib/session/types';

interface Props {
	hit: AntipatternHit;
	startedAt: number;
}

const SEVERITY_VARIANT: Record<
	AntipatternHit['severity'],
	'destructive' | 'secondary' | 'outline'
> = {
	error: 'destructive',
	warn: 'secondary',
	info: 'outline',
};

export function AntipatternHitRow({ hit, startedAt }: Props) {
	const [callsite, setCallsite] = useState<ResolvedCallsite | undefined>(hit.context.callsite);

	useEffect(() => {
		// Se hit veio sem `resolved` mas tem `raw`, tenta resolver agora.
		if (!hit.context.callsite?.raw || hit.context.callsite.resolved) return;
		let cancel = false;
		void resolveCallsite(hit.context.callsite.raw).then((r) => {
			if (!cancel) setCallsite(r);
		});
		return () => {
			cancel = true;
		};
	}, [hit.context.callsite]);

	const offsetSec = ((hit.startTimestamp - startedAt) / 1000).toFixed(2);
	const renderedCallsite = callsite?.resolved ?? callsite?.raw;

	return (
		<div className="grid grid-cols-[64px_auto_1fr_auto] items-baseline gap-2 border-b px-3 py-2 text-xs">
			<span className="font-mono text-muted-foreground">+{offsetSec}s</span>
			<Badge variant={SEVERITY_VARIANT[hit.severity]}>{hit.severity}</Badge>
			<div>
				<div className="font-medium">{hit.patternId}</div>
				<div className="text-muted-foreground">{hit.context.summary}</div>
				{renderedCallsite && (
					<div className="font-mono text-[11px] text-muted-foreground">
						em {renderedCallsite.file}:{renderedCallsite.line}
						{callsite?.resolved && <span className="ml-1 text-emerald-600">(resolvido)</span>}
					</div>
				)}
			</div>
			{hit.suggestion && (
				<span className="text-[11px] text-muted-foreground" title={hit.suggestion}>
					sugestão
				</span>
			)}
		</div>
	);
}
