import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';

interface RuleSaveToastProps {
	open: boolean;
	message: string;
	onUndo: () => void;
	onDismiss: () => void;
	durationMs?: number;
}

export function RuleSaveToast({
	open,
	message,
	onUndo,
	onDismiss,
	durationMs = 5000,
}: RuleSaveToastProps) {
	const [progress, setProgress] = useState(100);

	useEffect(() => {
		if (!open) {
			setProgress(100);
			return;
		}
		const start = Date.now();
		setProgress(100);
		const tick = window.setInterval(() => {
			const elapsed = Date.now() - start;
			const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
			setProgress(remaining);
			if (remaining <= 0) {
				window.clearInterval(tick);
				onDismiss();
			}
		}, 50);
		return () => window.clearInterval(tick);
	}, [open, durationMs, onDismiss]);

	if (!open) return null;

	return (
		<output
			aria-live="polite"
			className="pointer-events-auto fixed bottom-4 right-4 z-50 w-80 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg"
			data-testid="rule-save-toast"
		>
			<div className="flex items-start gap-3 p-3">
				<div
					className={cn(
						'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
						'bg-emerald-500/10 text-emerald-300',
					)}
				>
					<LucideIcon name="check-circle" className="h-4 w-4" />
				</div>
				<div className="flex-1">
					<div className="text-sm font-medium">{message}</div>
					<div className="mt-1 text-xs text-muted-foreground">
						As regras anteriores podem ser restauradas em até 5s.
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onUndo}
						className="h-7 px-2 text-xs"
						data-testid="rule-save-toast-undo"
					>
						<LucideIcon name="rotate-ccw" className="mr-1 h-3 w-3" />
						Desfazer
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onDismiss}
						className="h-7 w-7 p-0 text-muted-foreground"
						aria-label="Fechar"
						data-testid="rule-save-toast-close"
					>
						<LucideIcon name="x" className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>
			<div className="h-1 w-full bg-border/40">
				<div
					className="h-full bg-emerald-400/60 transition-[width] duration-75 ease-linear"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</output>
	);
}
