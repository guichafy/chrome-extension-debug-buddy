import { useState } from 'react';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type {
	BytesDetail,
	FailedDetail,
	SlowDetail,
	TotalDetail,
	TtfbDetail,
} from '@/lib/networkPillsDetail';
import type { SessionMarker } from '@/types/sessionMarker';
import { formatBytes, formatCount, formatMs } from './networkMetricsFormat';

export type PillName = 'total' | 'bytes' | 'ttfb' | 'slow' | 'failed';

export interface PillsDetailProp {
	total: TotalDetail;
	bytes: BytesDetail;
	ttfb: TtfbDetail | null;
	slow: SlowDetail;
	failed: FailedDetail;
}

interface NetworkMetricsBarProps {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	hasCurrentPage: boolean;
	isDebugging: boolean;
	sessionMarker: SessionMarker;
	sessionDetails?: PillsDetailProp;
	currentPageDetails?: PillsDetailProp;
	onPillClick?: (pill: PillName) => void;
}

type Window = 'session' | 'page';

export function NetworkMetricsBar({
	session,
	currentPage,
	hasCurrentPage,
	isDebugging: _isDebugging,
	sessionMarker: _sessionMarker,
	sessionDetails,
	currentPageDetails,
	onPillClick,
}: NetworkMetricsBarProps) {
	const [window, setWindow] = useState<Window>('session');
	const active = window === 'session' ? session : currentPage;
	const activeDetails = window === 'session' ? sessionDetails : currentPageDetails;

	const handleClick = (pill: PillName) => {
		onPillClick?.(pill);
	};

	return (
		<div className="flex min-w-0 flex-shrink items-center gap-2 overflow-hidden">
			<Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
				<TabsList className="h-7">
					<TabsTrigger value="session" className="px-2 text-xs">
						Sessão
					</TabsTrigger>
					{hasCurrentPage ? (
						<TabsTrigger value="page" className="px-2 text-xs">
							Página
						</TabsTrigger>
					) : (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="inline-flex">
										<TabsTrigger value="page" className="px-2 text-xs" disabled>
											Página
										</TabsTrigger>
									</span>
								</TooltipTrigger>
								<TooltipContent side="bottom">Aguardando navegação na aba alvo</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</TabsList>
			</Tabs>

			{active.totalRequests === 0 ? (
				<span className="text-xs text-muted-foreground">Sem requests ainda</span>
			) : (
				<div className="flex items-center gap-1 overflow-x-auto">
					<Pill
						icon="activity"
						label="Total requests"
						name="total"
						detail={activeDetails ? <TotalDetailView data={activeDetails.total} /> : undefined}
						onClick={onPillClick ? () => handleClick('total') : undefined}
					>
						{formatCount(active.totalRequests)}
					</Pill>
					<Pill
						icon="download"
						label="Total baixado"
						name="bytes"
						detail={activeDetails ? <BytesDetailView data={activeDetails.bytes} /> : undefined}
						onClick={onPillClick ? () => handleClick('bytes') : undefined}
					>
						{formatBytes(active.totalBytes)}
					</Pill>
					<Pill
						icon="zap"
						label="TTFB médio"
						name="ttfb"
						detail={activeDetails ? <TtfbDetailView data={activeDetails.ttfb} /> : undefined}
						onClick={onPillClick ? () => handleClick('ttfb') : undefined}
					>
						{formatMs(active.avgTtfbMs)}
					</Pill>
					<Pill
						icon="hourglass"
						label="Requests lentas (> 1s)"
						name="slow"
						accent={active.slowCount > 0 ? 'warn' : undefined}
						detail={activeDetails ? <SlowDetailView data={activeDetails.slow} /> : undefined}
						onClick={onPillClick && active.slowCount > 0 ? () => handleClick('slow') : undefined}
						disabled={active.slowCount === 0}
					>
						{formatCount(active.slowCount)}
					</Pill>
					<Pill
						icon="alert-triangle"
						label="Falhas (4xx/5xx)"
						name="failed"
						accent={active.failedCount > 0 ? 'danger' : undefined}
						detail={activeDetails ? <FailedDetailView data={activeDetails.failed} /> : undefined}
						onClick={
							onPillClick && active.failedCount > 0 ? () => handleClick('failed') : undefined
						}
						disabled={active.failedCount === 0}
					>
						{formatCount(active.failedCount)}
					</Pill>
				</div>
			)}
		</div>
	);
}

interface PillProps {
	icon: LucideIconName;
	label: string;
	name: string;
	accent?: 'warn' | 'danger';
	detail?: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}

function Pill({ icon, label, name, accent, detail, onClick, disabled, children }: PillProps) {
	const accentClass =
		accent === 'warn'
			? 'text-amber-500'
			: accent === 'danger'
				? 'text-destructive'
				: 'text-foreground';

	const baseClass = `flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs ${accentClass}`;
	const interactiveClass =
		onClick && !disabled
			? 'cursor-pointer hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
			: '';
	const disabledClass = disabled ? 'cursor-default opacity-60' : '';

	const innerContent = (
		<>
			<LucideIcon name={icon} className="h-3.5 w-3.5" />
			<span>{children}</span>
		</>
	);

	const trigger =
		onClick && !disabled ? (
			<button
				type="button"
				data-pill={name}
				className={`${baseClass} ${interactiveClass}`}
				onClick={onClick}
			>
				{innerContent}
			</button>
		) : (
			<span
				data-pill={name}
				aria-disabled={disabled ? 'true' : undefined}
				className={`${baseClass} ${disabledClass}`}
			>
				{innerContent}
			</span>
		);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{trigger}</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-sm">
					{detail ?? label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =====================================================================
// Detail views — micro-componentes locais para o conteúdo do tooltip de cada pill.
// =====================================================================

function TotalDetailView({ data }: { data: TotalDetail }) {
	return (
		<div className="space-y-2 text-xs">
			<div>
				<div className="text-[9px] uppercase text-muted-foreground mb-1">Por método</div>
				<div>
					{data.byMethod.length === 0
						? '—'
						: data.byMethod.map(([method, n]) => `${method} ${n}`).join(' · ')}
				</div>
			</div>
			<div>
				<div className="text-[9px] uppercase text-muted-foreground mb-1">Por faixa de status</div>
				<div className="flex gap-3">
					<span className="text-emerald-500">2xx {data.byStatusRange['2xx']}</span>
					<span className="text-blue-400">3xx {data.byStatusRange['3xx']}</span>
					<span className="text-destructive">4xx/5xx {data.byStatusRange['4xx5xx']}</span>
				</div>
			</div>
		</div>
	);
}

function BytesDetailView({ data }: { data: BytesDetail }) {
	if (data.top.length === 0) {
		return <span className="text-xs">Nenhum transfer size capturado.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Top 3 por bytes</div>
			<div className="space-y-0.5">
				{data.top.map((entry) => (
					<div key={entry.url} className="flex items-center justify-between gap-3">
						<TruncatedUrl url={entry.url} />
						<span>{formatBytes(entry.transferSize)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function TtfbDetailView({ data }: { data: TtfbDetail | null }) {
	if (data == null) {
		return <span className="text-xs">Nenhum TTFB capturado.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Distribuição de TTFB</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
				<span>p50</span>
				<span className="text-emerald-500 text-right">{formatMs(data.p50)}</span>
				<span>p95</span>
				<span className="text-amber-500 text-right">{formatMs(data.p95)}</span>
				<span>máx</span>
				<span className="text-destructive text-right">{formatMs(data.max)}</span>
			</div>
		</div>
	);
}

function SlowDetailView({ data }: { data: SlowDetail }) {
	if (data.top.length === 0) {
		return <span className="text-xs">Nenhuma request lenta.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Top 3 mais lentas</div>
			<div className="space-y-0.5">
				{data.top.map((entry) => (
					<div
						key={`${entry.url}-${entry.durationMs}`}
						className="flex items-center justify-between gap-3"
					>
						<TruncatedUrl url={entry.url} />
						<span className="text-amber-500">{formatMs(entry.durationMs)}</span>
					</div>
				))}
			</div>
			<div className="mt-2 pt-2 border-t border-border text-[10px] text-blue-400">
				→ Click pra ver no Command Center
			</div>
		</div>
	);
}

function FailedDetailView({ data }: { data: FailedDetail }) {
	if (data.list.length === 0) {
		return <span className="text-xs">Nenhuma falha.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Falhas registradas</div>
			<div className="space-y-0.5">
				{data.list.map((entry) => (
					<div
						key={`${entry.url}-${entry.status}`}
						className="flex items-center justify-between gap-3"
					>
						<TruncatedUrl url={entry.method ? `${entry.method} ${entry.url}` : entry.url} />
						<span className="text-destructive">
							{entry.status}
							{entry.statusText ? ` ${entry.statusText}` : ''}
						</span>
					</div>
				))}
			</div>
			<div className="mt-2 pt-2 border-t border-border text-[10px] text-blue-400">
				→ Click pra ver no Command Center
			</div>
		</div>
	);
}

// Trunca URL preservando o final (mais informativo). Usa direction: rtl + bdi
// para que o ellipsis fique no INÍCIO do texto.
function TruncatedUrl({ url }: { url: string }) {
	return (
		<span
			className="max-w-[240px] truncate"
			style={{ direction: 'rtl', textAlign: 'left' }}
			title={url}
		>
			<bdi>{url}</bdi>
		</span>
	);
}
