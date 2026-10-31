import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { formatBytes, formatCount } from './networkMetricsFormat';

interface NetworkMetricsBarProps {
	session: MetricsAggregate;
}

// Footer-style bar inspirada no rodapé do DevTools: três métricas curtas
// — requests, transferred, resources — sempre relativas à sessão de
// interceptação atual. Janela "Página" foi descontinuada (ver useNetworkMetrics).
export function NetworkMetricsBar({ session }: NetworkMetricsBarProps) {
	if (session.totalRequests === 0) {
		return (
			<div className="flex min-w-0 items-center gap-2 overflow-hidden">
				<span className="text-xs text-muted-foreground">Sem requests ainda</span>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 items-center gap-3 overflow-hidden">
			<Pill
				name="requests"
				icon="activity"
				value={`${formatCount(session.totalRequests)} requests`}
				tooltip="Total de requisições capturadas pela sessão atual de análise."
			/>
			<Separator />
			<Pill
				name="transferred"
				icon="download"
				value={`${formatBytes(session.totalBytes)} transferred`}
				tooltip="Bytes recebidos no fio (transferSize do CDP). Inclui headers e payload comprimido quando aplicável."
			/>
			<Separator />
			<Pill
				name="resources"
				icon="database"
				value={`${formatBytes(session.totalResourceBytes)} resources`}
				tooltip="Soma dos response bodies decodificados que a extensão capturou. Bodies binários ou acima do cap não contam (viram bodyUnavailableReason)."
			/>
		</div>
	);
}

interface PillProps {
	name: string;
	icon: LucideIconName;
	value: string;
	tooltip: string;
}

function Pill({ name, icon, value, tooltip }: PillProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						data-pill={name}
						className="inline-flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums"
					>
						<LucideIcon name={icon} className="h-3.5 w-3.5" aria-hidden="true" />
						<span>{value}</span>
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs text-xs">
					{tooltip}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function Separator() {
	return <span className="text-muted-foreground/40 text-xs select-none">|</span>;
}
