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
// Estética: telemetria precisa. Números em mono tabular para alinhar colunas;
// rank explícito (01/02/03) nos top-N; URLs sem protocolo, truncadas no fim;
// section labels uppercase com tracking. Inspiração: Linear / Vercel Analytics.
// =====================================================================

const SECTION_LABEL = 'mb-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80';
const ROW = 'flex items-center gap-2 text-xs';
const RANK = 'w-5 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60';
const NUM = 'font-mono tabular-nums shrink-0';
const FOOTER_HINT =
	'mt-2.5 -mx-3 -mb-2 px-3 pt-2 pb-1.5 border-t border-border/60 text-[10px] text-blue-400/90';
const EMPTY = 'text-xs text-muted-foreground italic';

// Strip protocol pra ganhar caracteres úteis no truncamento.
function compactUrl(raw: string): string {
	return raw.replace(/^https?:\/\//, '');
}

function UrlCell({ url, prefix }: { url: string; prefix?: string }) {
	return (
		<span className="flex-1 truncate text-[11px] text-foreground/90" title={url}>
			{prefix && <span className="text-muted-foreground/70 mr-1">{prefix}</span>}
			{compactUrl(url)}
		</span>
	);
}

function TotalDetailView({ data }: { data: TotalDetail }) {
	const { '2xx': ok, '3xx': redir, '4xx5xx': bad } = data.byStatusRange;
	const total = ok + redir + bad;
	return (
		<div className="space-y-2.5">
			<div>
				<div className={SECTION_LABEL}>Métodos</div>
				{data.byMethod.length === 0 ? (
					<span className={EMPTY}>—</span>
				) : (
					<div className="flex flex-wrap gap-1.5">
						{data.byMethod.map(([method, n]) => (
							<span
								key={method}
								className="inline-flex items-center gap-1.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[11px]"
							>
								<span className="text-foreground/85">{method}</span>
								<span className="font-mono tabular-nums text-foreground/60">{n}</span>
							</span>
						))}
					</div>
				)}
			</div>
			<div>
				<div className={SECTION_LABEL}>Status</div>
				<div className="flex items-center gap-3 text-[11px]">
					<span className="inline-flex items-center gap-1.5">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
						<span className="text-foreground/80">2xx</span>
						<span className="font-mono tabular-nums text-foreground">{ok}</span>
					</span>
					<span className="inline-flex items-center gap-1.5">
						<span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
						<span className="text-foreground/80">3xx</span>
						<span className="font-mono tabular-nums text-foreground">{redir}</span>
					</span>
					<span className="inline-flex items-center gap-1.5">
						<span className="h-1.5 w-1.5 rounded-full bg-destructive" />
						<span className="text-foreground/80">4xx/5xx</span>
						<span className="font-mono tabular-nums text-foreground">{bad}</span>
					</span>
				</div>
				{total > 0 && (
					<div className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-muted/40">
						{ok > 0 && (
							<span className="bg-emerald-500" style={{ flex: ok }} aria-label={`2xx ${ok}`} />
						)}
						{redir > 0 && (
							<span className="bg-blue-400" style={{ flex: redir }} aria-label={`3xx ${redir}`} />
						)}
						{bad > 0 && (
							<span
								className="bg-destructive"
								style={{ flex: bad }}
								aria-label={`4xx/5xx ${bad}`}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function BytesDetailView({ data }: { data: BytesDetail }) {
	if (data.top.length === 0) {
		return <span className={EMPTY}>Nenhum transfer size capturado.</span>;
	}
	return (
		<div>
			<div className={SECTION_LABEL}>Top transferências</div>
			<div className="space-y-1">
				{data.top.map((entry, i) => (
					<div key={entry.url} className={ROW}>
						<span className={RANK}>{String(i + 1).padStart(2, '0')}</span>
						<UrlCell url={entry.url} />
						<span className={`${NUM} text-foreground/85`}>{formatBytes(entry.transferSize)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function TtfbDetailView({ data }: { data: TtfbDetail | null }) {
	if (data == null) {
		return <span className={EMPTY}>Nenhum TTFB capturado.</span>;
	}
	return (
		<div>
			<div className={SECTION_LABEL}>Latência TTFB</div>
			<div className="grid grid-cols-3 gap-3">
				<TtfbCell label="p50" value={data.p50} accent="text-emerald-500" />
				<TtfbCell label="p95" value={data.p95} accent="text-amber-500" />
				<TtfbCell label="máx" value={data.max} accent="text-destructive" />
			</div>
		</div>
	);
}

function TtfbCell({ label, value, accent }: { label: string; value: number; accent: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
			<span className={`font-mono tabular-nums text-sm leading-none ${accent}`}>
				{formatMs(value)}
			</span>
		</div>
	);
}

function SlowDetailView({ data }: { data: SlowDetail }) {
	if (data.top.length === 0) {
		return <span className={EMPTY}>Nenhuma request lenta.</span>;
	}
	return (
		<div>
			<div className={SECTION_LABEL}>Mais lentas</div>
			<div className="space-y-1">
				{data.top.map((entry, i) => (
					<div key={`${entry.url}-${entry.durationMs}`} className={ROW}>
						<span className={RANK}>{String(i + 1).padStart(2, '0')}</span>
						<UrlCell url={entry.url} />
						<span className={`${NUM} ${slowDurationTone(entry.durationMs)}`}>
							{formatMs(entry.durationMs)}
						</span>
					</div>
				))}
			</div>
			<div className={FOOTER_HINT}>→ Click pra abrir no Command Center</div>
		</div>
	);
}

function slowDurationTone(ms: number): string {
	if (ms >= 3000) return 'text-destructive';
	return 'text-amber-500';
}

function FailedDetailView({ data }: { data: FailedDetail }) {
	if (data.list.length === 0) {
		return <span className={EMPTY}>Nenhuma falha.</span>;
	}
	return (
		<div>
			<div className={SECTION_LABEL}>Falhas</div>
			<div className="space-y-1">
				{data.list.map((entry, i) => (
					<div key={`${entry.url}-${entry.status}-${i}`} className={ROW}>
						<StatusBadge status={entry.status} />
						{entry.method && (
							<span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
								{entry.method}
							</span>
						)}
						<UrlCell url={entry.url} />
					</div>
				))}
			</div>
			<div className={FOOTER_HINT}>→ Click pra abrir no Command Center</div>
		</div>
	);
}

function StatusBadge({ status }: { status: number }) {
	// 5xx mais grave que 4xx — gradação sutil de tom.
	const tone =
		status >= 500 ? 'bg-destructive/20 text-destructive' : 'bg-amber-500/15 text-amber-500';
	return (
		<span
			className={`inline-flex h-4 min-w-[1.75rem] items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums shrink-0 ${tone}`}
		>
			{status}
		</span>
	);
}
