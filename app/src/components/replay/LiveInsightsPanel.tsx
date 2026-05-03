import { type ReactNode, useEffect, useReducer, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProbeStateChangePayload } from '@/probe/protocol';
import {
	CATEGORY_LABEL,
	CATEGORY_ORDER,
	RULE_CATEGORIES,
	type RecommendationCategory,
} from '@/lib/session/recommendations/categories';
import type { EnvironmentFingerprint, Recommendation, StoreKind } from '@/lib/session/types';
import type { Message } from '@/types/messages';
import type { LiveStateSnapshot } from './StateInspector';
import { StateInspector } from './StateInspector';
import { RecommendationRow } from './RecommendationRow';

const MAX_RECOMMENDATIONS = 50;

interface LiveDetection {
	url: string;
	fingerprint: EnvironmentFingerprint;
	timestamp: number;
}

interface PanelState {
	detection: LiveDetection | null;
	state: LiveStateSnapshot;
	recommendations: Recommendation[];
}

interface HydrateSnapshot {
	detection: { url: string; timestamp: number; fingerprint: EnvironmentFingerprint } | null;
	state: Record<
		string,
		{ storeKind: StoreKind; current: unknown; recentChanges: number; lastChangeAt: number }
	>;
	recommendations: Recommendation[];
}

type PanelAction =
	| { type: 'detection'; payload: LiveDetection }
	| { type: 'state-change'; payload: ProbeStateChangePayload }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'reset-state' }
	| { type: 'hydrate'; snapshot: HydrateSnapshot };

const INITIAL: PanelState = {
	detection: null,
	state: { byStoreId: {} },
	recommendations: [],
};

function reducer(s: PanelState, a: PanelAction): PanelState {
	switch (a.type) {
		case 'detection':
			return { ...s, detection: a.payload };
		case 'state-change': {
			const id = a.payload.storeId;
			const prev = s.state.byStoreId[id];
			return {
				...s,
				state: {
					byStoreId: {
						...s.state.byStoreId,
						[id]: {
							storeKind: a.payload.storeKind,
							current: a.payload.next,
							recentChanges: (prev?.recentChanges ?? 0) + 1,
							lastChangeAt: a.payload.timestamp,
						},
					},
				},
			};
		}
		case 'recommendation':
			return {
				...s,
				recommendations: [a.payload, ...s.recommendations].slice(0, MAX_RECOMMENDATIONS),
			};
		case 'clear':
			return INITIAL;
		case 'reset-state':
			return { ...s, state: { byStoreId: {} } };
		case 'hydrate':
			return {
				detection: a.snapshot.detection
					? {
							url: a.snapshot.detection.url,
							fingerprint: a.snapshot.detection.fingerprint,
							timestamp: a.snapshot.detection.timestamp,
						}
					: null,
				state: { byStoreId: a.snapshot.state },
				recommendations: a.snapshot.recommendations,
			};
	}
}

interface Props {
	tabId: number | null;
	isInterceptionActive: boolean;
	onCountChange?: (count: number) => void;
}

// Live Insights — três seções colapsáveis renderizadas dentro de um Sheet:
//   1. Framework & Libraries — fingerprint mais recente do probe.
//   2. Estado ao vivo — `StateInspector` em modo `liveSnapshot`.
//   3. Recomendações — lista (max 50) das últimas regras disparadas.
// Reseta tudo quando `tabId` muda; navegação SPA limpa apenas o estado.
// `onCountChange` notifica o pai (SiteHeader) para atualizar o badge do trigger.
//
// Hidratação: `SheetContent` (Radix) só monta seus filhos quando o drawer abre,
// então broadcasts emitidos antes ficariam perdidos no void. No mount pedimos
// `getLiveSnapshot` ao background e dispatchamos `hydrate` antes de registrar
// o listener — garantindo que o painel reflita o estado acumulado.
export function LiveInsightsPanel({ tabId, isInterceptionActive, onCountChange }: Props) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const [open, setOpen] = useState({ framework: true, state: true, recommendations: true });

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
						url: msg.payload.url,
						fingerprint: msg.payload.fingerprint,
						timestamp: msg.payload.timestamp,
					},
				});
				if (msg.payload.triggerType === 'navigation') {
					dispatch({ type: 'reset-state' });
				}
			} else if (msg.action === 'liveStateChange') {
				if (!msg.statePayload) return;
				dispatch({ type: 'state-change', payload: msg.statePayload });
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

	if (tabId == null) return null;

	return (
		<div className="flex h-full flex-col overflow-auto" aria-label="Live Insights">
			<header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
				<h2 className="font-semibold text-sm">Live Insights</h2>
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

			<Section
				title="Framework & Libraries"
				open={open.framework}
				onToggle={() => setOpen((o) => ({ ...o, framework: !o.framework }))}
			>
				<FrameworkSection detection={state.detection} />
			</Section>

			<Section
				title="Estado ao vivo"
				open={open.state}
				onToggle={() => setOpen((o) => ({ ...o, state: !o.state }))}
			>
				<StateInspector liveSnapshot={state.state} />
			</Section>

			<Section
				title={`Recomendações (${state.recommendations.length})`}
				open={open.recommendations}
				onToggle={() => setOpen((o) => ({ ...o, recommendations: !o.recommendations }))}
			>
				<RecommendationsSection items={state.recommendations} />
			</Section>
		</div>
	);
}

function Section({
	title,
	open,
	onToggle,
	children,
}: {
	title: string;
	open: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<section className="border-t">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between px-3 py-2 font-medium text-muted-foreground text-xs uppercase hover:bg-muted/40"
			>
				<span>{title}</span>
				<span aria-hidden>{open ? '▾' : '▸'}</span>
			</button>
			{open && <div>{children}</div>}
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

function FrameworkSection({ detection }: { detection: LiveDetection | null }) {
	if (!detection) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Aguardando primeira detecção do probe…
			</p>
		);
	}
	const fp = detection.fingerprint;
	const interestingHttp = fp.httpClients.filter((c) => c.name !== 'fetch' && c.name !== 'xhr');

	return (
		<div className="space-y-3 px-3 py-2">
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

			{fp.stateManagers.length > 0 && (
				<SubSection label="State">
					{fp.stateManagers.map((s) => (
						<Badge key={`state-${s.name}`} variant="secondary" className="text-xs">
							{s.name}
							{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
						</Badge>
					))}
				</SubSection>
			)}
		</div>
	);
}

function RecommendationsSection({ items }: { items: Recommendation[] }) {
	if (items.length === 0) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Nenhuma recomendação até agora. Carregue recursos da página para acionar regras.
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
						<div>
							{grouped[cat].map((r) => (
								<RecommendationRow key={r.id} item={r} />
							))}
						</div>
					</details>
				),
			)}
		</div>
	);
}
