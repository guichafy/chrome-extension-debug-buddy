import React from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { buildReplayView } from '@/lib/replayHistory';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReplayPanelProps {
	request: InterceptedResponse;
	rules: Rule[];
}

export function ReplayPanel({ request, rules }: ReplayPanelProps) {
	const view = buildReplayView(request, rules);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<section className="space-y-2">
				<h3 className="text-sm font-medium">Capturado</h3>
				<Badge variant="outline">
					{view.captured.status} {view.captured.statusText}
				</Badge>
				<ScrollArea className="max-h-72 rounded-md border">
					<pre className="p-3 font-mono text-xs">
						{view.captured.body ?? '(sem body capturado)'}
					</pre>
				</ScrollArea>
			</section>

			<section className="space-y-2">
				<h3 className="text-sm font-medium">Mock atual</h3>
				{view.currentMock ? (
					<>
						<Badge variant="outline">
							{view.currentMock.status} {view.currentMock.statusPhrase ?? ''}
						</Badge>
						<div className="text-xs text-muted-foreground">
							Regra: <code>{view.currentMock.ruleName}</code>
						</div>
						<ScrollArea className="max-h-72 rounded-md border">
							<pre className="p-3 font-mono text-xs">
								{view.currentMock.body ?? '(sem body no mock)'}
							</pre>
						</ScrollArea>
					</>
				) : (
					<div className="text-sm text-muted-foreground">
						Esta requisição ainda não tem regra ativa correspondente.
					</div>
				)}
			</section>
		</div>
	);
}
