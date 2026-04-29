import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';

interface PendingAlertBannerProps {
	pendingCount: number;
	onApproveNext: () => void;
	onIgnoreAll: () => void;
}

export function PendingAlertBanner({
	pendingCount,
	onApproveNext,
	onIgnoreAll,
}: PendingAlertBannerProps) {
	if (pendingCount === 0) return null;

	const label =
		pendingCount === 1
			? '1 requisição pausada aguardando sua decisão'
			: `${pendingCount} requisições pausadas aguardando sua decisão`;

	return (
		<output
			className={cn(
				'pending-banner-sweep relative flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3',
				'animate-in fade-in-0 slide-in-from-top-2',
			)}
			aria-live="polite"
		>
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/20 text-warning">
					<LucideIcon name="hourglass" className="h-5 w-5 animate-pulse" />
				</div>
				<div className="flex flex-col">
					<span className="text-sm font-semibold text-foreground">{label}</span>
					<span className="text-xs text-muted-foreground">
						A página alvo está pausada — use os atalhos <Kbd>A</Kbd> aprovar / <Kbd>I</Kbd> ignorar
					</span>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onIgnoreAll}
					className="border-warning/40 text-foreground hover:bg-warning/15"
				>
					Ignorar todos
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={onApproveNext}
					className="bg-warning text-warning-foreground hover:bg-warning/85"
				>
					<LucideIcon name="arrow-right" className="mr-1 h-4 w-4" />
					Aprovar próximo
				</Button>
			</div>
		</output>
	);
}
