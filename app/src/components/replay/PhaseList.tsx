import { useTranslation } from 'react-i18next';
import { groupTechsByCategory } from '@/lib/insights/groupByCategory';
import type { DetectionPhase } from '@/lib/session/types';
import { TechCategorySection } from './TechCategorySection';

interface Props {
	phases: DetectionPhase[];
}

export function PhaseList({ phases }: Props) {
	const { t } = useTranslation('replay');
	return (
		<div className="flex flex-col gap-2">
			<h2 className="font-semibold text-sm">{t('phases.title', { total: phases.length })}</h2>
			{phases.map((p, i) => {
				const techs = p.pages[0]?.techs ?? [];
				const groups = groupTechsByCategory(techs);
				const topTechName = groups[0]?.techs[0]?.name ?? t('phases.noDetection');
				return (
					<div key={p.id} className="rounded border p-2 text-xs">
						<div className="font-medium">
							{t('phases.phase', { number: i + 1, tech: topTechName })}
						</div>
						<div className="text-muted-foreground">
							{p.pages.length} {p.pages.length === 1 ? 'URL' : 'URLs'}
						</div>
						{groups.length > 0 && (
							<div className="mt-1">
								{groups.map((g, idx) => (
									<TechCategorySection key={g.categoryId} group={g} defaultOpen={idx === 0} />
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
