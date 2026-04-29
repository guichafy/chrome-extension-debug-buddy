import { useState } from 'react';
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
					<DialogTitle>Importar regras</DialogTitle>
					<DialogDescription>
						{rules.length} regra(s) prontas para importar. Escolha a estratégia.
					</DialogDescription>
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
							<div className="text-sm font-medium">Adicionar às regras existentes</div>
							<p className="text-xs text-muted-foreground">
								Mantém as regras atuais e cria novas com IDs novos.
							</p>
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
							<div className="text-sm font-medium">Substituir todas as regras</div>
							<p className="text-xs text-muted-foreground">
								Apaga todas as regras existentes e usa apenas as importadas.
							</p>
						</div>
					</label>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
						Cancelar
					</Button>
					<Button onClick={handleConfirm} disabled={isApplying} className="gap-2">
						{isApplying ? (
							<LucideIcon name="refresh" className="h-4 w-4 animate-spin" />
						) : (
							<LucideIcon name="check" className="h-4 w-4" />
						)}
						Confirmar import
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default RulesImportDialog;
