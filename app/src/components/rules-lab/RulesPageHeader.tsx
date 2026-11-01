import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LucideIcon } from '@/components/ui/lucide-icon';

interface RulesPageHeaderProps {
	subtitle: string;
	canExport: boolean;
	onCreate: () => void;
	onExport: () => void;
	onImportClick: () => void;
}

export function RulesPageHeader({
	subtitle,
	canExport,
	onCreate,
	onExport,
	onImportClick,
}: RulesPageHeaderProps) {
	const { t } = useTranslation('rulesLab');
	return (
		<div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4">
			<div>
				<h2 className="text-lg font-semibold leading-tight">{t('header.title')}</h2>
				<p className="text-xs text-muted-foreground">{subtitle}</p>
			</div>
			<div className="flex items-center gap-2">
				<Button onClick={onCreate} className="gap-1.5">
					<LucideIcon name="plus" className="h-4 w-4" />
					{t('header.newRule')}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className="h-9 w-9"
							aria-label={t('header.moreActions')}
						>
							<LucideIcon name="more-horizontal" className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onExport} disabled={!canExport} data-testid="menu-export">
							<LucideIcon name="download" className="mr-2 h-4 w-4" />
							{t('header.exportRules')}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onImportClick} data-testid="menu-import">
							<LucideIcon name="upload" className="mr-2 h-4 w-4" />
							{t('header.importRules')}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem disabled>
							<LucideIcon name="trash" className="mr-2 h-4 w-4" />
							{t('header.clearAll')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

export default RulesPageHeader;
