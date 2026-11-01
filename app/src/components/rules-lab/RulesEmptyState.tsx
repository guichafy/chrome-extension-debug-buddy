import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';

interface RulesEmptyStateProps {
	onCreate: () => void;
	onImport: () => void;
}

export function RulesEmptyState({ onCreate, onImport }: RulesEmptyStateProps) {
	const { t } = useTranslation('rulesLab');
	return (
		<div
			className="flex flex-col items-center justify-center px-6 py-16 text-center"
			data-testid="rules-empty-state"
		>
			<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<LucideIcon name="sparkles" className="h-6 w-6" />
			</div>
			<h3 className="mb-1 text-lg font-semibold">{t('empty.title')}</h3>
			<p className="mb-6 max-w-md text-sm text-muted-foreground">{t('empty.description')}</p>
			<div className="flex flex-wrap items-center justify-center gap-2">
				<Button onClick={onCreate} className="gap-2" data-testid="empty-state-create">
					<LucideIcon name="plus" className="h-4 w-4" />
					{t('empty.create')}
				</Button>
				<Button variant="outline" onClick={onImport} className="gap-2">
					<LucideIcon name="upload" className="h-4 w-4" />
					{t('empty.importJson')}
				</Button>
			</div>
		</div>
	);
}

export default RulesEmptyState;
