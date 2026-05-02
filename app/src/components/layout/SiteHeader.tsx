import { Button } from '@/components/ui/button';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type { PillsDetailProp } from './NetworkMetricsBar';
import { NetworkMetricsBar } from './NetworkMetricsBar';
import type { SessionMarker } from '@/types/sessionMarker';
import { RecordingToggle } from '@/components/recording/RecordingToggle';

interface SiteHeaderProps {
	targetTab: {
		id: number | null;
		title: string;
		url: string;
		closed?: boolean;
	};
	isDebugging: boolean;
	onSelectTabClick: () => void;
	onStartDebugging: () => void;
	onStopDebugging: () => void;
	metrics: { session: MetricsAggregate; currentPage: MetricsAggregate };
	sessionMarker: SessionMarker;
	sessionDetails?: PillsDetailProp;
	currentPageDetails?: PillsDetailProp;
}

type TabButtonState = 'empty' | 'available' | 'closed';

function resolveTabButtonState(targetTab: SiteHeaderProps['targetTab']): TabButtonState {
	if (targetTab.closed) return 'closed';
	if (targetTab.id) return 'available';
	return 'empty';
}

export function SiteHeader({
	targetTab,
	isDebugging,
	onSelectTabClick,
	onStartDebugging,
	onStopDebugging,
	metrics,
	sessionMarker,
	sessionDetails,
	currentPageDetails,
}: SiteHeaderProps) {
	const hasCurrentPage = sessionMarker.currentPageNavigatedAt != null;
	const tabState = resolveTabButtonState(targetTab);

	const tabButtonIcon: LucideIconName = tabState === 'closed' ? 'alert-triangle' : 'tab';
	const tabButtonLabel =
		tabState === 'available'
			? targetTab.title
			: tabState === 'closed'
				? 'Aba indisponível — selecionar outra'
				: 'Selecionar Aba';
	// Mantém `outline` como base mas pinta borda/ícone com a paleta destrutiva
	// no estado fechado para sinalizar que ação é necessária.
	const tabButtonClassName =
		tabState === 'closed'
			? 'flex items-center gap-2 max-w-[260px] border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive'
			: 'flex items-center gap-2 max-w-[200px]';

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
						sessionMarker={sessionMarker}
						sessionDetails={sessionDetails}
						currentPageDetails={currentPageDetails}
					/>
				</div>

				<div className="flex items-center gap-2">
					<RecordingToggle tabId={targetTab.id} interceptionActive={isDebugging} />
					<Separator
						orientation="vertical"
						className="hidden data-[orientation=vertical]:h-6 md:block"
					/>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									data-tab-state={tabState}
									aria-label={
										tabState === 'closed'
											? `Aba indisponível: ${targetTab.title || 'aba selecionada anteriormente'}. Clique para selecionar outra.`
											: undefined
									}
									className={tabButtonClassName}
									onClick={onSelectTabClick}
								>
									<LucideIcon name={tabButtonIcon} className="h-4 w-4 flex-shrink-0" />
									<span className="truncate">{tabButtonLabel}</span>
								</Button>
							</TooltipTrigger>
							{tabState === 'available' && (
								<TooltipContent side="bottom" className="max-w-[300px] break-words">
									<div>
										<div className="font-medium">{targetTab.title}</div>
										<div className="text-xs text-muted-foreground">{targetTab.url}</div>
									</div>
								</TooltipContent>
							)}
							{tabState === 'closed' && (
								<TooltipContent side="bottom" className="max-w-[300px] break-words">
									<div>
										<div className="font-medium text-destructive">Aba não está mais disponível</div>
										{targetTab.title && (
											<div className="text-xs text-muted-foreground">
												Última aba: {targetTab.title}
											</div>
										)}
										<div className="mt-1 text-xs">Clique para selecionar uma nova aba.</div>
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
							disabled={tabState !== 'available'}
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
