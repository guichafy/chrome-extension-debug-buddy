import { type ReactNode, useEffect, useMemo, useReducer, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
	CATEGORY_LABEL,
	CATEGORY_ORDER,
	RULE_CATEGORIES,
	type RecommendationCategory,
} from '@/lib/session/recommendations/categories';
import type {
	EnvironmentFingerprint,
	Recommendation,
	RecommendationRuleId,
} from '@/lib/session/types';
import type { Message } from '@/types/messages';
import { RECOMMENDATION_ROW_TOKENS, RecommendationRow } from './RecommendationRow';

const MAX_RECOMMENDATIONS = 50;

interface LiveDetectionEntry {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
}

interface PanelState {
	// Map<host, detection-mais-recente>. Re-set bumps host pra ordem mais
	// recente preservando a ordem de inserção do Map.
	detectionsByHost: Map<string, LiveDetectionEntry>;
	recommendations: Recommendation[];
}

interface HydrateSnapshot {
	detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
	}>;
	recommendations: Recommendation[];
}

type PanelAction =
	| { type: 'detection'; payload: { host: string; entry: LiveDetectionEntry } }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'hydrate'; snapshot: HydrateSnapshot };

const INITIAL: PanelState = {
	detectionsByHost: new Map(),
	recommendations: [],
};

function extractHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return 'unknown';
	}
}

function reducer(s: PanelState, a: PanelAction): PanelState {
	switch (a.type) {
		case 'detection': {
			const next = new Map(s.detectionsByHost);
			// Bump host pra "mais recente" deletando + re-inserindo no fim.
			if (next.has(a.payload.host)) next.delete(a.payload.host);
			next.set(a.payload.host, a.payload.entry);
			return { ...s, detectionsByHost: next };
		}
		case 'recommendation':
			return {
				...s,
				recommendations: [a.payload, ...s.recommendations].slice(0, MAX_RECOMMENDATIONS),
			};
		case 'clear':
			return { detectionsByHost: new Map(), recommendations: [] };
		case 'hydrate': {
			// Snapshot vem mais-recente-primeiro; reinserir invertido pra que
			// Map.entries() (ascendente) coincida com a ordem do backend.
			const next = new Map<string, LiveDetectionEntry>();
			for (let i = a.snapshot.detections.length - 1; i >= 0; i--) {
				const d = a.snapshot.detections[i];
				next.set(d.host, { url: d.url, timestamp: d.timestamp, fingerprint: d.fingerprint });
			}
			return {
				detectionsByHost: next,
				recommendations: a.snapshot.recommendations,
			};
		}
	}
}

interface Props {
	tabId: number | null;
	isInterceptionActive: boolean;
	onCountChange?: (count: number) => void;
}

// Live Insights — drawer agrupa todos os insights da sessão de interceptação atual
// por host (DNS). Para cada host:
//   1. Framework & Libraries — fingerprint mais recente daquele host
//   2. Recomendações daquele host — agrupadas por categoria (segurança/performance)
//      e sub-agrupadas por ruleId
// Hosts são ordenados por última atividade (mais recente primeiro). Reseta tudo
// quando `tabId` muda. `onCountChange` notifica o pai (SiteHeader) com o total
// de recomendações para alimentar o badge.
//
// Hidratação: `SheetContent` (Radix) só monta seus filhos quando o drawer abre,
// então broadcasts emitidos antes ficariam perdidos no void. No mount pedimos
// `getLiveSnapshot` ao background e dispatchamos `hydrate` antes de registrar
// o listener — garantindo que o painel reflita o estado acumulado da sessão.
export function LiveInsightsPanel({ tabId, isInterceptionActive, onCountChange }: Props) {
	const [state, dispatch] = useReducer(reducer, INITIAL);

	useEffect(() => {
		dispatch({ type: 'clear' });
		if (tabId == null) return;

		let cancelled = false;
		chrome.runtime
			.sendMessage({ action: 'getLiveSnapshot', tabId })
			.then((response) => {
				if (cancelled) return;
				if (response?.ok && response.liveSnapshot) {
					dispatch({ type: 'hydrate', snapshot: response.liveSnapshot });
				}
			})
			.catch(() => {
				// Background indisponível ou worker reciclando — broadcasts futuras
				// ainda chegam via listener registrado abaixo.
			});

		const onMessage = (msg: Message) => {
			if (msg.tabId !== tabId) return;
			if (msg.action === 'liveDetection') {
				if (!msg.payload) return;
				dispatch({
					type: 'detection',
					payload: {
						host: extractHost(msg.payload.url),
						entry: {
							url: msg.payload.url,
							fingerprint: msg.payload.fingerprint,
							timestamp: msg.payload.timestamp,
						},
					},
				});
			} else if (msg.action === 'liveRecommendation') {
				if (!msg.recommendation) return;
				dispatch({ type: 'recommendation', payload: msg.recommendation });
			}
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => {
			cancelled = true;
			chrome.runtime.onMessage.removeListener(onMessage);
		};
	}, [tabId]);

	useEffect(() => {
		onCountChange?.(state.recommendations.length);
	}, [state.recommendations.length, onCountChange]);

	// Agrupa recomendações por host para renderização. Memoizado pra evitar
	// O(n) a cada re-render quando outras props mudam.
	const recsByHost = useMemo(() => {
		const map = new Map<string, Recommendation[]>();
		for (const r of state.recommendations) {
			const arr = map.get(r.host);
			if (arr) arr.push(r);
			else map.set(r.host, [r]);
		}
		return map;
	}, [state.recommendations]);

	// Lista de hosts a renderizar: união de hosts com detection + hosts com
	// recomendações. Ordem mais-recente-primeiro = ordem reversa da inserção
	// no Map.detectionsByHost; hosts órfãos (só recomendações, sem detection)
	// vão pro final.
	const hostList = useMemo(() => {
		const ordered: string[] = [];
		const seen = new Set<string>();
		const detectionHosts = [...state.detectionsByHost.keys()].reverse();
		for (const h of detectionHosts) {
			if (!seen.has(h)) {
				ordered.push(h);
				seen.add(h);
			}
		}
		for (const h of recsByHost.keys()) {
			if (!seen.has(h)) {
				ordered.push(h);
				seen.add(h);
			}
		}
		return ordered;
	}, [state.detectionsByHost, recsByHost]);

	if (tabId == null) return null;

	const totalRecommendations = state.recommendations.length;
	const totalHosts = hostList.length;

	return (
		<div className="flex h-full flex-col overflow-auto" aria-label="Live Insights">
			<header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
				<div className="flex flex-col">
					<h2 className="font-semibold text-sm">Live Insights</h2>
					{totalHosts > 0 && (
						<span className="text-[11px] text-muted-foreground">
							{totalHosts} {totalHosts === 1 ? 'host' : 'hosts'} · {totalRecommendations}{' '}
							{totalRecommendations === 1 ? 'recomendação' : 'recomendações'}
						</span>
					)}
				</div>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => dispatch({ type: 'clear' })}
				>
					limpar
				</button>
			</header>

			{!isInterceptionActive && (
				<div className="border-b bg-warning/10 px-3 py-2 text-foreground text-xs">
					Inicie a interceptação para coletar insights desta página.
				</div>
			)}

			{totalHosts === 0 ? (
				<EmptyState />
			) : (
				hostList.map((host) => (
					<HostSection
						key={host}
						host={host}
						detection={state.detectionsByHost.get(host) ?? null}
						recommendations={recsByHost.get(host) ?? []}
					/>
				))
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
			<p className="text-muted-foreground text-xs">Aguardando primeira detecção do probe…</p>
			<p className="text-[11px] text-muted-foreground/80">
				Nenhuma recomendação até agora. Carregue recursos da página para acionar regras.
			</p>
		</div>
	);
}

function HostSection({
	host,
	detection,
	recommendations,
}: {
	host: string;
	detection: LiveDetectionEntry | null;
	recommendations: Recommendation[];
}) {
	// Sessões iniciam expandidas: usuário abriu o drawer pra ver tudo. Pode
	// recolher manualmente para focar em um host específico.
	const [open, setOpen] = useState(true);

	const recCount = recommendations.length;
	const frameworkLabel = detection
		? `${detection.fingerprint.framework.name}${
				detection.fingerprint.framework.version ? ` ${detection.fingerprint.framework.version}` : ''
			}`
		: null;

	return (
		<section className="border-t" data-host={host}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				data-testid={`live-insights-host-toggle-${host}`}
				className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
			>
				<div className="flex min-w-0 items-center gap-2">
					<span aria-hidden className="text-muted-foreground text-xs">
						{open ? '▾' : '▸'}
					</span>
					<span className="truncate font-mono font-medium text-sm" title={host}>
						{host}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{frameworkLabel && (
						<Badge variant="default" className="text-[10px]">
							{frameworkLabel}
						</Badge>
					)}
					{recCount > 0 && (
						<Badge variant="secondary" className="text-[10px]">
							{recCount} {recCount === 1 ? 'rec' : 'recs'}
						</Badge>
					)}
				</div>
			</button>

			{open && (
				<div className="border-t">
					<HostFramework detection={detection} />
					<HostRecommendations items={recommendations} />
				</div>
			)}
		</section>
	);
}

function SubSection({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div>
			<h4 className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</h4>
			<div className="flex flex-wrap items-center gap-1.5">{children}</div>
		</div>
	);
}

function HostFramework({ detection }: { detection: LiveDetectionEntry | null }) {
	if (!detection) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Sem detecção do probe para este host.
			</p>
		);
	}
	const fp = detection.fingerprint;
	const interestingHttp = fp.httpClients.filter((c) => c.name !== 'fetch' && c.name !== 'xhr');

	return (
		<div className="space-y-3 border-b px-3 py-2">
			<SubSection label="URL">
				<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
					{detection.url}
				</p>
			</SubSection>

			<SubSection label="Framework">
				<Badge variant="default" className="text-xs">
					{fp.framework.name}
					{fp.framework.version ? ` ${fp.framework.version}` : ''}
				</Badge>
			</SubSection>

			{fp.libraries.length > 0 && (
				<SubSection label="Libraries">
					{fp.libraries.map((l) => (
						<Badge key={`lib-${l.name}`} variant="secondary" className="text-xs">
							{l.name}
							{l.version ? ` ${l.version}` : ''}
							{l.confidence !== 'high' ? ` (${l.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{interestingHttp.length > 0 && (
				<SubSection label="HTTP Clients">
					{interestingHttp.map((c) => (
						<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
							{c.name}
							{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{fp.dataFetching.length > 0 && (
				<SubSection label="Data Fetching">
					{fp.dataFetching.map((d) => (
						<Badge
							key={`data-${d.name}`}
							variant={d.treatment === 'tracked' ? 'secondary' : 'outline'}
							className="text-xs"
							title={
								d.treatment === 'detection-only'
									? 'Detectada nesta versão; sem agrupamento de operations / cache inspector dedicado.'
									: undefined
							}
						>
							{d.name}
							{d.version ? ` ${d.version}` : ''}
							{d.treatment === 'detection-only' ? ' · detect-only' : ''}
						</Badge>
					))}
				</SubSection>
			)}
		</div>
	);
}

function HostRecommendations({ items }: { items: Recommendation[] }) {
	if (items.length === 0) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Nenhuma recomendação para este host.
			</p>
		);
	}

	const grouped: Record<RecommendationCategory, Recommendation[]> = {
		security: [],
		performance: [],
	};
	for (const r of items) {
		const cat = RULE_CATEGORIES[r.ruleId];
		if (cat) grouped[cat].push(r);
	}

	return (
		<div>
			{CATEGORY_ORDER.map((cat) =>
				grouped[cat].length === 0 ? null : (
					<details key={cat} open className="border-b last:border-b-0">
						<summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hover:bg-muted/40">
							{CATEGORY_LABEL[cat]} ({grouped[cat].length})
						</summary>
						<RuleGroups items={grouped[cat]} />
					</details>
				),
			)}
		</div>
	);
}

function RuleGroups({ items }: { items: Recommendation[] }) {
	const byRule = new Map<RecommendationRuleId, Recommendation[]>();
	for (const r of items) {
		const arr = byRule.get(r.ruleId) ?? [];
		arr.push(r);
		byRule.set(r.ruleId, arr);
	}

	return (
		<div>
			{[...byRule.entries()].map(([ruleId, instances]) => (
				<RuleGroup key={ruleId} ruleId={ruleId} instances={instances} />
			))}
		</div>
	);
}

function RuleGroup({
	ruleId,
	instances,
}: {
	ruleId: RecommendationRuleId;
	instances: Recommendation[];
}) {
	const severity = instances[0].severity;
	// First class in the SEVERITY_CLASSES string is the border-l-* token.
	const borderClass = RECOMMENDATION_ROW_TOKENS.classes[severity].split(' ')[0];
	const labelClass = RECOMMENDATION_ROW_TOKENS.labelClasses[severity];
	const label = RECOMMENDATION_ROW_TOKENS.label[severity];

	return (
		<details className="border-t first:border-t-0">
			<summary
				className={`flex cursor-pointer select-none items-center gap-2 border-l-2 px-4 py-1.5 text-xs hover:bg-muted/40 ${borderClass}`}
			>
				<span className={`font-semibold text-[10px] ${labelClass}`}>{label}</span>
				<span className="font-medium">{ruleId}</span>
				<span className="ml-auto text-muted-foreground">({instances.length})</span>
			</summary>
			<div>
				{instances.map((r) => (
					<RecommendationRow key={r.id} item={r} compact />
				))}
			</div>
		</details>
	);
}
