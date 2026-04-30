import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { NetworkMetricsBar } from './NetworkMetricsBar';

interface SiteHeaderProps {
	targetTab: {
		id: number | null;
		title: string;
		url: string;
	};
	isDebugging: boolean;
	onSelectTabClick: () => void;
	onStartDebugging: () => void;
	onStopDebugging: () => void;
	metrics: { session: MetricsAggregate; currentPage: MetricsAggregate };
	hasCurrentPage: boolean;
}

export function SiteHeader({
	targetTab,
	isDebugging,
	onSelectTabClick,
	onStartDebugging,
	onStopDebugging,
	metrics,
	hasCurrentPage,
}: SiteHeaderProps) {
	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear pr-2">
			<div className="flex w-full items-center justify-between px-4 lg:px-6">
				<div className="flex min-w-0 items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mx-2 hidden data-[orientation=vertical]:h-6 md:block"
					/>
					<NetworkMetricsBar
						session={metrics.session}
						currentPage={metrics.currentPage}
						hasCurrentPage={hasCurrentPage}
						isDebugging={isDebugging}
					/>
				</div>

				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									className="flex items-center gap-2 max-w-[200px]"
									onClick={onSelectTabClick}
								>
									<LucideIcon name="tab" className="h-4 w-4 flex-shrink-0" />
									<span className="truncate">
										{targetTab.id ? targetTab.title : 'Selecionar Aba'}
									</span>
								</Button>
							</TooltipTrigger>
							{targetTab.id && (
								<TooltipContent side="bottom" className="max-w-[300px] break-words">
									<div>
										<div className="font-medium">{targetTab.title}</div>
										<div className="text-xs text-muted-foreground">{targetTab.url}</div>
									</div>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>

					{!isDebugging ? (
						<Button
							variant="default"
							className="flex items-center gap-2"
							onClick={onStartDebugging}
						>
							<LucideIcon name="play" className="h-4 w-4" />
							<span className="hidden sm:inline">Iniciar Interceptação</span>
						</Button>
					) : (
						<Button
							variant="destructive"
							className="flex items-center gap-2"
							onClick={onStopDebugging}
						>
							<LucideIcon name="stop" className="h-4 w-4" />
							<span className="hidden sm:inline">Parar Interceptação</span>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
