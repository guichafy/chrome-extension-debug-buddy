import { useState } from 'react';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { formatBytes, formatCount, formatMs } from './networkMetricsFormat';

interface NetworkMetricsBarProps {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	hasCurrentPage: boolean;
	isDebugging: boolean;
}

type Window = 'session' | 'page';

export function NetworkMetricsBar({
	session,
	currentPage,
	hasCurrentPage,
	isDebugging: _isDebugging,
}: NetworkMetricsBarProps) {
	const [window, setWindow] = useState<Window>('session');
	const active = window === 'session' ? session : currentPage;

	return (
		<div className="flex min-w-0 flex-shrink items-center gap-2 overflow-hidden">
			<Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
				<TabsList className="h-7">
					<TabsTrigger value="session" className="px-2 text-xs">
						Sessão
					</TabsTrigger>
					{hasCurrentPage ? (
						<TabsTrigger value="page" className="px-2 text-xs">
							Página
						</TabsTrigger>
					) : (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="inline-flex">
										<TabsTrigger value="page" className="px-2 text-xs" disabled>
											Página
										</TabsTrigger>
									</span>
								</TooltipTrigger>
								<TooltipContent side="bottom">Aguardando navegação na aba alvo</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</TabsList>
			</Tabs>

			{active.totalRequests === 0 ? (
				<span className="text-xs text-muted-foreground">Sem requests ainda</span>
			) : (
				<div className="flex items-center gap-1 overflow-x-auto">
					<Pill icon="activity" label="Total requests" name="total">
						{formatCount(active.totalRequests)}
					</Pill>
					<Pill icon="download" label="Total baixado" name="bytes">
						{formatBytes(active.totalBytes)}
					</Pill>
					<Pill icon="zap" label="TTFB médio" name="ttfb">
						{formatMs(active.avgTtfbMs)}
					</Pill>
					<Pill
						icon="hourglass"
						label="Requests lentas (> 1s)"
						name="slow"
						accent={active.slowCount > 0 ? 'warn' : undefined}
					>
						{formatCount(active.slowCount)}
					</Pill>
					<Pill
						icon="alert-triangle"
						label="Falhas (4xx/5xx)"
						name="failed"
						accent={active.failedCount > 0 ? 'danger' : undefined}
					>
						{formatCount(active.failedCount)}
					</Pill>
				</div>
			)}
		</div>
	);
}

interface PillProps {
	icon: LucideIconName;
	label: string;
	name: string;
	accent?: 'warn' | 'danger';
	children: React.ReactNode;
}

function Pill({ icon, label, name, accent, children }: PillProps) {
	const accentClass =
		accent === 'warn'
			? 'text-amber-500'
			: accent === 'danger'
				? 'text-destructive'
				: 'text-foreground';
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						data-pill={name}
						className={`flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs ${accentClass}`}
					>
						<LucideIcon name={icon} className="h-3.5 w-3.5" />
						<span>{children}</span>
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom">{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
