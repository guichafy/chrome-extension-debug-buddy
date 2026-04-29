import { Kbd } from '@/components/ui/kbd';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';

interface PendingActionDockProps {
	pendingCount: number;
	currentIndex: number | null;
	hasSelectedPending: boolean;
}

export function PendingActionDock({
	pendingCount,
	currentIndex,
	hasSelectedPending,
}: PendingActionDockProps) {
	if (pendingCount === 0) return null;

	const positionLabel =
		hasSelectedPending && currentIndex !== null
			? `${currentIndex + 1} / ${pendingCount}`
			: `próximo de ${pendingCount}`;

	const approveLabel = hasSelectedPending ? 'Aprovar' : 'Aprovar próximo';
	const ignoreLabel = hasSelectedPending ? 'Ignorar' : 'Ignorar próximo';
	const navDisabled = pendingCount < 2;

	return (
		<section
			className={cn(
				'fixed bottom-6 right-6 z-50 w-72 rounded-lg border border-warning/40 bg-card/95 p-4 shadow-lg backdrop-blur',
				'animate-in fade-in-0 slide-in-from-bottom-4',
			)}
			aria-label="Ações de pendentes"
		>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<LucideIcon name="zap" className="h-4 w-4 text-warning" />
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Pendentes
					</span>
				</div>
				<span className="font-mono text-xs text-muted-foreground">{positionLabel}</span>
			</div>
			<div className="grid grid-cols-2 gap-2 text-xs">
				<HotkeyRow keyName="A" label={approveLabel} disabled={false} />
				<HotkeyRow keyName="I" label={ignoreLabel} disabled={false} />
				<HotkeyRow keyName="J" label="Próximo" disabled={navDisabled} />
				<HotkeyRow keyName="K" label="Anterior" disabled={navDisabled} />
			</div>
		</section>
	);
}

function HotkeyRow({
	keyName,
	label,
	disabled,
}: {
	keyName: string;
	label: string;
	disabled: boolean;
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-between rounded-md border bg-background/40 px-2 py-1.5',
				disabled && 'opacity-40',
			)}
		>
			<span className="text-foreground/90">{label}</span>
			<Kbd>{keyName}</Kbd>
		</div>
	);
}
