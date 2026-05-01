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
	if (pendingCount === 0) return null;

	const positionLabel =
		hasSelectedPending && currentIndex !== null
			? `${currentIndex + 1} / ${pendingCount}`
			: `próximo de ${pendingCount}`;

	const counterLabel = pendingCount === 1 ? '1 pausada' : `${pendingCount} pausadas`;
	const approveLabel = hasSelectedPending ? 'Aprovar' : 'Aprovar próximo';
	const editLabel = hasSelectedPending ? 'Editar…' : 'Editar próxima…';
	const createMockLabel = hasSelectedPending ? 'Criar Mock' : 'Criar Mock da próxima';
	const ignoreShortcutLabel = hasSelectedPending ? 'Ignorar' : 'Ignorar próximo';
	const navDisabled = pendingCount < 2;

	return (
		<section
			className={cn(
				'fixed bottom-6 right-6 z-50 w-80 rounded-lg border border-warning/40 bg-card/95 p-4 shadow-lg backdrop-blur',
				'animate-in fade-in-0 slide-in-from-bottom-4',
			)}
			aria-label="Ações de pendentes"
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
				<span className="font-mono text-xs text-muted-foreground">{positionLabel}</span>
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
					{approveLabel}
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
					{editLabel}
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
					{createMockLabel}
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
						Ver pausadas
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onIgnoreAll}
						className="border-warning/40 hover:bg-warning/15"
						data-testid="pending-action-dock-ignore-all"
					>
						Ignorar todos
					</Button>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2 text-xs">
				<HotkeyRow keyName="A" label={approveLabel} disabled={false} />
				<HotkeyRow keyName="I" label={ignoreShortcutLabel} disabled={false} />
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
