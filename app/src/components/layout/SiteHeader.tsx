import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Separator } from '@/components/ui/separator';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { NetworkMetricsBar } from './NetworkMetricsBar';
import { RecordingToggle } from '@/components/recording/RecordingToggle';
import { LiveInsightsPanel } from '@/components/replay/LiveInsightsPanel';

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
	metrics: { session: MetricsAggregate };
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
}: SiteHeaderProps) {
	const { t } = useTranslation('layout');
	const tabState = resolveTabButtonState(targetTab);
	const [liveInsightsCount, setLiveInsightsCount] = useState(0);

	const tabButtonIcon: LucideIconName = tabState === 'closed' ? 'alert-triangle' : 'tab';
	const tabButtonLabel =
		tabState === 'available'
			? targetTab.title
			: tabState === 'closed'
				? t('header.tabUnavailableSelectAnother')
				: t('header.selectTab');
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
					<NetworkMetricsBar session={metrics.session} />
				</div>

				<div className="flex items-center gap-2">
					<RecordingToggle tabId={targetTab.id} interceptionActive={isDebugging} />
					{targetTab.id !== null && (
						<Sheet>
							<SheetTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-label={t('header.liveInsights')}
									className="relative"
								>
									<LucideIcon name="activity" className="size-4" />
									{liveInsightsCount > 0 && (
										<span className="-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-info px-1 font-medium text-[10px] text-info-foreground">
											{liveInsightsCount}
										</span>
									)}
								</Button>
							</SheetTrigger>
							<SheetContent
								side="right"
								className="w-[520px] p-0 sm:w-[640px] sm:max-w-none lg:w-[760px]"
							>
								<SheetHeader className="sr-only">
									<SheetTitle>{t('header.liveInsights')}</SheetTitle>
									<SheetDescription>{t('header.liveInsightsDescription')}</SheetDescription>
								</SheetHeader>
								<LiveInsightsPanel
									tabId={targetTab.id}
									isInterceptionActive={isDebugging}
									onCountChange={setLiveInsightsCount}
								/>
							</SheetContent>
						</Sheet>
					)}
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
											? t('header.tabUnavailableAriaLabel', {
													title: targetTab.title || t('header.previouslySelectedTab'),
												})
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
										<div className="font-medium text-destructive">
											{t('header.tabNoLongerAvailable')}
										</div>
										{targetTab.title && (
											<div className="text-xs text-muted-foreground">
												{t('header.lastTab', { title: targetTab.title })}
											</div>
										)}
										<div className="mt-1 text-xs">{t('header.clickToSelectNewTab')}</div>
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
							<span className="hidden sm:inline">{t('header.startAnalysis')}</span>
						</Button>
					) : (
						<Button
							variant="destructive"
							className="flex items-center gap-2"
							onClick={onStopDebugging}
						>
							<LucideIcon name="stop" className="h-4 w-4" />
							<span className="hidden sm:inline">{t('header.stopAnalysis')}</span>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
