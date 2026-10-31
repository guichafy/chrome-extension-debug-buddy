import { useEffect, useMemo, useReducer, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { groupTechsByCategory } from '@/lib/insights/groupByCategory';
import type { TechHit } from '@/lib/insights/types';
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
import { TechCategorySection } from './TechCategorySection';

const MAX_RECOMMENDATIONS = 50;

interface LiveDetectionEntry {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	techs?: TechHit[]; // sub-projeto 4 — vem do sub-projeto 3 (techsUpdates / hidratação)
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
		techs?: TechHit[];
	}>;
	recommendations: Recommendation[];
}

type PanelAction =
	| { type: 'detection'; payload: { host: string; entry: LiveDetectionEntry } }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'hydrate'; snapshot: HydrateSnapshot }
	| { type: 'techsUpdate'; payload: { host: string; techs: TechHit[] } };

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

function pickerLabel(entry: LiveDetectionEntry): string | null {
	if (entry.techs && entry.techs.length > 0) {
		const groups = groupTechsByCategory(entry.techs);
		const top = groups[0]?.techs[0];
		if (top) return top.version ? `${top.name} ${top.version}` : top.name;
	}
	return null;
}

function reducer(s: PanelState, a: PanelAction): PanelState {
	switch (a.type) {
		case 'detection': {
			const next = new Map(s.detectionsByHost);
			const existingForHost = next.get(a.payload.host);
			if (next.has(a.payload.host)) next.delete(a.payload.host);
			next.set(a.payload.host, {
				...a.payload.entry,
				techs: a.payload.entry.techs ?? existingForHost?.techs,
			});
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
			const next = new Map<string, LiveDetectionEntry>();
			// Snapshot vem mais-recente-primeiro; reinserir invertido pra que a
			// ordem do Map (ascendente) reflita a do backend.
			for (let i = a.snapshot.detections.length - 1; i >= 0; i--) {
				const d = a.snapshot.detections[i];
				next.set(d.host, {
					url: d.url,
					timestamp: d.timestamp,
					fingerprint: d.fingerprint,
					techs: d.techs,
				});
			}
			return {
				detectionsByHost: next,
				recommendations: a.snapshot.recommendations,
			};
		}
		case 'techsUpdate': {
			const next = new Map(s.detectionsByHost);
			const existing = next.get(a.payload.host);
			if (existing) {
				next.set(a.payload.host, { ...existing, techs: a.payload.techs });
			} else {
				// host ainda sem detection (pode acontecer se bg pipeline detectar
				// antes do probe scan). Cria placeholder com metadata mínima.
				next.set(a.payload.host, {
					url: `https://${a.payload.host}/`,
					timestamp: Date.now(),
					fingerprint: {
						detectedAt: Date.now(),
						isProductionBuild: false,
					},
					techs: a.payload.techs,
				});
			}
			return { ...s, detectionsByHost: next };
		}
	}
}

interface Props {
	tabId: number | null;
	isInterceptionActive: boolean;
	onCountChange?: (count: number) => void;
}

// Live Insights — drawer focado em UM host por vez. Picker (shadcn Select) no
// topo lista todos os hosts visitados na sessão de interceptação atual; o
// conteúdo abaixo mostra Framework + Libraries + recomendações apenas do host
// selecionado (default = host mais recente). Trocar pra single-host evita o
// muro de seções empilhadas que poluía a UI quando havia 3+ hosts.
//
// Hidratação: `SheetContent` (Radix) só monta seus filhos quando o drawer abre,
// então broadcasts emitidos antes ficariam perdidos. No mount pedimos
// `getLiveSnapshot` ao background e dispatchamos `hydrate` antes de registrar
// o listener — garantindo que o painel reflita o estado acumulado da sessão.
export function LiveInsightsPanel({ tabId, isInterceptionActive, onCountChange }: Props) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const [selectedHost, setSelectedHost] = useState<string | null>(null);

	useEffect(() => {
		dispatch({ type: 'clear' });
		setSelectedHost(null);
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
				if (msg.payload) {
					dispatch({
						type: 'detection',
						payload: {
							host: extractHost(msg.payload.url),
							entry: {
								url: msg.payload.url,
								fingerprint: msg.payload.fingerprint,
								timestamp: msg.payload.timestamp,
								techs: msg.payload.techs,
							},
						},
					});
				}
				if (msg.techsUpdates) {
					for (const u of msg.techsUpdates) {
						dispatch({ type: 'techsUpdate', payload: u });
					}
				}
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

	// Recomendações por host: alimenta tanto o badge de cada opção do select
	// quanto o conteúdo do host selecionado. Memoizado pra recomputar só quando
	// a lista de recomendações realmente muda.
	const recsByHost = useMemo(() => {
		const map = new Map<string, Recommendation[]>();
		for (const r of state.recommendations) {
			const arr = map.get(r.host);
			if (arr) arr.push(r);
			else map.set(r.host, [r]);
		}
		return map;
	}, [state.recommendations]);

	// Hosts em ordem mais-recente-primeiro: detection-hosts (Map reverso) +
	// hosts órfãos que só têm recomendações (sem detection ainda).
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

	// Auto-seleção: ao popular hostList pela primeira vez ou se o host selecionado
	// "sair" da lista (clear), pular pro mais recente. Não trocamos automaticamente
	// quando uma nova detection chega: ficaria jarring trocar a tela pra um host
	// que o usuário não pediu.
	useEffect(() => {
		if (hostList.length === 0) {
			if (selectedHost !== null) setSelectedHost(null);
			return;
		}
		if (selectedHost === null || !hostList.includes(selectedHost)) {
			setSelectedHost(hostList[0]);
		}
	}, [hostList, selectedHost]);

	if (tabId == null) return null;

	const totalRecommendations = state.recommendations.length;
	const totalHosts = hostList.length;
	const activeDetection = selectedHost ? (state.detectionsByHost.get(selectedHost) ?? null) : null;
	const activeRecommendations = selectedHost ? (recsByHost.get(selectedHost) ?? []) : [];

	return (
		<div className="flex h-full flex-col" aria-label="Live Insights">
			<header className="sticky top-0 z-10 border-b bg-background">
				<div className="flex items-center justify-between px-4 py-3">
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
						onClick={() => {
							dispatch({ type: 'clear' });
							setSelectedHost(null);
						}}
					>
						limpar
					</button>
				</div>

				{totalHosts > 0 && (
					<div className="px-3 pb-3">
						<HostPicker
							hosts={hostList}
							detectionsByHost={state.detectionsByHost}
							recsByHost={recsByHost}
							value={selectedHost ?? hostList[0]}
							onChange={setSelectedHost}
						/>
					</div>
				)}
			</header>

			{!isInterceptionActive && (
				<div className="border-b bg-warning/10 px-3 py-2 text-foreground text-xs">
					Inicie a análise para coletar insights desta página.
				</div>
			)}

			{totalHosts === 0 ? (
				<EmptyState />
			) : (
				<div
					key={selectedHost ?? 'none'}
					className="flex-1 overflow-auto animate-in fade-in-0 duration-150"
				>
					<HostTechs detection={activeDetection} />
					<HostRecommendations items={activeRecommendations} />
				</div>
			)}
		</div>
	);
}

function HostPicker({
	hosts,
	detectionsByHost,
	recsByHost,
	value,
	onChange,
}: {
	hosts: string[];
	detectionsByHost: Map<string, LiveDetectionEntry>;
	recsByHost: Map<string, Recommendation[]>;
	value: string;
	onChange: (host: string) => void;
}) {
	const selectedDetection = detectionsByHost.get(value) ?? null;
	const selectedRecs = recsByHost.get(value)?.length ?? 0;
	const frameworkLabel = selectedDetection ? pickerLabel(selectedDetection) : null;

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger
				data-testid="live-insights-host-picker"
				className="h-auto min-h-[44px] w-full px-3 py-2 text-left"
			>
				<SelectValue>
					<div className="flex min-w-0 flex-col gap-0.5">
						<div className="flex min-w-0 items-center gap-2">
							<span className="truncate font-mono font-medium text-sm" title={value}>
								{value}
							</span>
							{frameworkLabel && (
								<Badge variant="default" className="shrink-0 text-[10px]">
									{frameworkLabel}
								</Badge>
							)}
						</div>
						{selectedRecs > 0 && (
							<span className="text-[10px] text-muted-foreground">
								{selectedRecs} {selectedRecs === 1 ? 'recomendação' : 'recomendações'} neste host
							</span>
						)}
					</div>
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="max-h-[60vh]">
				{hosts.map((host, idx) => {
					const det = detectionsByHost.get(host) ?? null;
					const recs = recsByHost.get(host)?.length ?? 0;
					const fw = det ? pickerLabel(det) : null;
					return (
						<SelectItem
							key={host}
							value={host}
							data-testid={`live-insights-host-option-${host}`}
							className="py-2"
						>
							<div className="flex min-w-0 flex-col gap-0.5">
								<div className="flex min-w-0 items-center gap-2">
									<span className="truncate font-mono font-medium text-xs" title={host}>
										{host}
									</span>
									{idx === 0 && (
										<span
											className="size-1.5 shrink-0 rounded-full bg-info"
											aria-label="host mais recente"
										/>
									)}
								</div>
								<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
									{fw ? <span>{fw}</span> : <span className="italic">sem detecção</span>}
									{recs > 0 && (
										<>
											<span aria-hidden>·</span>
											<span>
												{recs} {recs === 1 ? 'rec' : 'recs'}
											</span>
										</>
									)}
								</div>
							</div>
						</SelectItem>
					);
				})}
			</SelectContent>
		</Select>
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

function HostTechs({ detection }: { detection: LiveDetectionEntry | null }) {
	const techs = detection?.techs ?? [];
	const groups = useMemo(() => groupTechsByCategory(techs), [techs]);

	if (!detection) {
		return (
			<p className="border-b px-3 py-2 text-muted-foreground text-xs">
				Sem detecção do probe para este host. Recomendações abaixo são derivadas de respostas HTTP
				capturadas.
			</p>
		);
	}
	if (groups.length === 0) {
		return (
			<div className="border-b">
				<div className="px-3 py-2">
					<p
						className="break-all font-mono text-[11px] text-muted-foreground"
						title={detection.url}
					>
						{detection.url}
					</p>
				</div>
				<p className="px-3 pb-3 text-muted-foreground text-xs">
					Nenhuma tecnologia detectada para este host ainda. Aguarde o próximo Fetch ou navegação
					SPA.
				</p>
			</div>
		);
	}
	return (
		<div className="border-b">
			<div className="px-3 py-2">
				<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
					{detection.url}
				</p>
			</div>
			{groups.map((g, idx) => (
				<TechCategorySection key={g.categoryId} group={g} defaultOpen={idx < 3} />
			))}
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
