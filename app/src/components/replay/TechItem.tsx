import { Badge } from '@/components/ui/badge';
import type { TechHit } from '@/lib/insights/types';

interface Props {
	tech: TechHit;
}

type ConfidenceLevel = 'high' | 'med' | 'low';

function levelFor(confidence: number): ConfidenceLevel {
	if (confidence >= 75) return 'high';
	if (confidence >= 50) return 'med';
	return 'low';
}

function confidenceBadgeClass(level: ConfidenceLevel): string {
	if (level === 'med') return 'border-warning/60 text-warning text-[10px]';
	return 'border-destructive/60 text-destructive text-[10px]';
}

export function TechItem({ tech }: Props) {
	const level = levelFor(tech.confidence);
	return (
		<div className="flex items-center gap-1.5">
			<Badge variant="secondary" className="text-xs">
				{tech.name}
			</Badge>
			{tech.version && (
				<span className="font-mono text-[10px] text-muted-foreground">{tech.version}</span>
			)}
			{level !== 'high' && (
				<Badge variant="outline" className={confidenceBadgeClass(level)}>
					{level}
				</Badge>
			)}
			{tech.website && (
				<a
					href={tech.website}
					target="_blank"
					rel="noreferrer noopener"
					className="text-[10px] text-muted-foreground hover:underline"
					aria-label={`Site oficial de ${tech.name}`}
				>
					↗
				</a>
			)}
		</div>
	);
}
