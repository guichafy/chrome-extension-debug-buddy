import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { LucideIcon } from '@/components/ui/lucide-icon';
import type { Rule } from '@/types/rules';

export type ImportStrategy = 'merge' | 'replace';

interface RulesImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rules: Rule[];
	onConfirm: (rules: Rule[], strategy: ImportStrategy) => Promise<void>;
}

export function RulesImportDialog({
	open,
	onOpenChange,
	rules,
	onConfirm,
}: RulesImportDialogProps) {
	const { t } = useTranslation(['rulesLab', 'common']);
	const [strategy, setStrategy] = useState<ImportStrategy>('merge');
	const [isApplying, setIsApplying] = useState(false);

	const handleConfirm = async () => {
		setIsApplying(true);
		try {
			await onConfirm(rules, strategy);
		} finally {
			setIsApplying(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t('import.title')}</DialogTitle>
					<DialogDescription>{t('import.description', { count: rules.length })}</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					<label className="flex items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
						<input
							type="radio"
							className="mt-1"
							checked={strategy === 'merge'}
							onChange={() => setStrategy('merge')}
						/>
						<div>
							<div className="text-sm font-medium">{t('import.merge')}</div>
							<p className="text-xs text-muted-foreground">{t('import.mergeHint')}</p>
						</div>
					</label>
					<label className="flex items-start gap-2 rounded-md border p-3 hover:bg-accent/40">
						<input
							type="radio"
							className="mt-1"
							checked={strategy === 'replace'}
							onChange={() => setStrategy('replace')}
						/>
						<div>
							<div className="text-sm font-medium">{t('import.replace')}</div>
							<p className="text-xs text-muted-foreground">{t('import.replaceHint')}</p>
						</div>
					</label>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
						{t('common:actions.cancel')}
					</Button>
					<Button onClick={handleConfirm} disabled={isApplying} className="gap-2">
						{isApplying ? (
							<LucideIcon name="refresh" className="h-4 w-4 animate-spin" />
						) : (
							<LucideIcon name="check" className="h-4 w-4" />
						)}
						{t('import.confirm')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default RulesImportDialog;
