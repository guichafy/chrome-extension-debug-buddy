import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';

interface RulesEmptyStateProps {
	onCreate: () => void;
	onImport: () => void;
}

export function RulesEmptyState({ onCreate, onImport }: RulesEmptyStateProps) {
	return (
		<div
			className="flex flex-col items-center justify-center px-6 py-16 text-center"
			data-testid="rules-empty-state"
		>
			<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<LucideIcon name="sparkles" className="h-6 w-6" />
			</div>
			<h3 className="mb-1 text-lg font-semibold">Crie sua primeira regra</h3>
			<p className="mb-6 max-w-md text-sm text-muted-foreground">
				Regras interceptam requisições do tab debugado e modificam a resposta. Comece a partir de um
				preset ou crie uma do zero.
			</p>
			<div className="flex flex-wrap items-center justify-center gap-2">
				<Button onClick={onCreate} className="gap-2">
					<LucideIcon name="plus" className="h-4 w-4" />
					Nova regra
				</Button>
				<Button variant="outline" onClick={onImport} className="gap-2">
					<LucideIcon name="upload" className="h-4 w-4" />
					Importar do JSON
				</Button>
			</div>
		</div>
	);
}

export default RulesEmptyState;
