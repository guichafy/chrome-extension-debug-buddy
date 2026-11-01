import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';

interface PendingActionDockProps {
	pendingCount: number;
	currentIndex: number | null;
	hasSelectedPending: boolean;
	nextPendingUrl: string | null;
	onApproveNext: () => void;
	onEditNext: () => void;
	onCreateMockNext: () => void;
	onIgnoreAll: () => void;
	onViewPending: () => void;
}

export function PendingActionDock({
	pendingCount,
	currentIndex,
	hasSelectedPending,
	nextPendingUrl,
	onApproveNext,
	onEditNext,
	onCreateMockNext,
	onIgnoreAll,
	onViewPending,
}: PendingActionDockProps) {
	const { t } = useTranslation('commandCenter');
	if (pendingCount === 0) return null;

	// O dock sempre opera sobre uma única request — a selecionada (se houver)
	// ou a primeira da fila (resolução em CommandCenter). As ações usam labels
	// fixos e o indicador "i / N" só aparece quando há pausada selecionada,
	// para deixar claro qual posição o usuário está olhando dentro da fila.
	const positionLabel =
		hasSelectedPending && currentIndex !== null ? `${currentIndex + 1} / ${pendingCount}` : null;

	const counterLabel = t('dock.paused', { count: pendingCount });
	const navDisabled = pendingCount < 2;

	return (
		<section
			className={cn(
				// w-80 cap; em viewports estreitos (side panel redimensionado, mobile)
				// encolhe respeitando as margens externas para não overflow do viewport.
				'fixed bottom-6 right-6 z-50 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-warning/40 bg-card/95 p-4 shadow-lg backdrop-blur',
				'animate-in fade-in-0 slide-in-from-bottom-4',
			)}
			aria-label={t('dock.ariaLabel')}
			data-testid="pending-action-dock"
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<LucideIcon name="hourglass" className="h-4 w-4 animate-pulse text-warning" />
					<span
						className="text-sm font-semibold text-foreground"
						data-testid="pending-action-dock-counter"
					>
						{counterLabel}
					</span>
				</div>
				{positionLabel && (
					<span
						className="font-mono text-xs text-muted-foreground"
						data-testid="pending-action-dock-position"
						aria-live="polite"
						aria-atomic="true"
					>
						{positionLabel}
					</span>
				)}
			</div>
			<div
				className="mb-3 truncate text-xs text-muted-foreground"
				title={nextPendingUrl ?? undefined}
				data-testid="pending-action-dock-next-url"
			>
				{nextPendingUrl ?? '—'}
			</div>
			<div className="mb-3 flex flex-col gap-2">
				<Button
					type="button"
					size="sm"
					onClick={onApproveNext}
					className="bg-warning text-warning-foreground hover:bg-warning/85"
					data-testid="pending-action-dock-approve-next"
				>
					<LucideIcon name="arrow-right" className="mr-1 h-4 w-4" />
					{t('dock.approve')}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onEditNext}
					className="border-warning/40 hover:bg-warning/15"
					data-testid="pending-action-dock-edit-next"
				>
					<LucideIcon name="file-edit" className="mr-1 h-4 w-4" />
					{t('dock.edit')}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onCreateMockNext}
					className="border-warning/40 hover:bg-warning/15"
					data-testid="pending-action-dock-create-mock-next"
				>
					<LucideIcon name="copy" className="mr-1 h-4 w-4" />
					{t('dock.createMock')}
				</Button>
				<div className="grid grid-cols-2 gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onViewPending}
						className="border-warning/40 hover:bg-warning/15"
						data-testid="pending-action-dock-view-pending"
					>
						{t('dock.viewPending')}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onIgnoreAll}
						className="border-warning/40 hover:bg-warning/15"
						data-testid="pending-action-dock-ignore-all"
					>
						{t('dock.ignoreAll')}
					</Button>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2 text-xs">
				<HotkeyRow keyName="A" label={t('dock.hotkeys.approve')} disabled={false} />
				<HotkeyRow keyName="I" label={t('dock.hotkeys.ignore')} disabled={false} />
				<HotkeyRow keyName="J" label={t('dock.hotkeys.next')} disabled={navDisabled} />
				<HotkeyRow keyName="K" label={t('dock.hotkeys.previous')} disabled={navDisabled} />
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
