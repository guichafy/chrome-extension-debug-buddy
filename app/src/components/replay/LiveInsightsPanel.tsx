import { useEffect, useReducer, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProbeStateChangePayload } from '@/probe/protocol';
import type { EnvironmentFingerprint, Recommendation } from '@/lib/session/types';
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

type PanelAction =
	| { type: 'detection'; payload: LiveDetection }
	| { type: 'state-change'; payload: ProbeStateChangePayload }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'reset-state' };

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
	}
}

interface Props {
	tabId: number | null;
}

// Painel passivo (Interceptação ON + Gravação OFF). Três seções colapsáveis:
//   1. Framework & Libraries — fingerprint mais recente do probe.
//   2. Estado ao vivo — `StateInspector` em modo `liveSnapshot`.
//   3. Recomendações — lista (max 50) das últimas regras disparadas.
// Reseta tudo quando `tabId` muda; navegação SPA limpa apenas o estado.
export function LiveInsightsPanel({ tabId }: Props) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const [open, setOpen] = useState({ framework: true, state: true, recommendations: true });

	useEffect(() => {
		dispatch({ type: 'clear' });
		if (tabId == null) return;
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
		return () => chrome.runtime.onMessage.removeListener(onMessage);
	}, [tabId]);

	if (tabId == null) return null;

	return (
		<aside
			className="fixed right-3 bottom-3 max-h-[70vh] w-[360px] overflow-auto rounded border bg-background shadow-lg"
			aria-label="Live Insights"
		>
			<header className="sticky top-0 flex items-center justify-between border-b bg-background px-3 py-2">
				<h2 className="font-semibold text-sm">Live Insights</h2>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => dispatch({ type: 'clear' })}
				>
					limpar
				</button>
			</header>

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
		</aside>
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

function FrameworkSection({ detection }: { detection: LiveDetection | null }) {
	if (!detection) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Aguardando primeira detecção do probe…
			</p>
		);
	}
	const fp = detection.fingerprint;
	return (
		<div className="space-y-1.5 px-3 py-2">
			<div className="flex flex-wrap items-center gap-1.5">
				<Badge variant="default" className="text-xs">
					{fp.framework.name}
					{fp.framework.version ? ` ${fp.framework.version}` : ''}
				</Badge>
				{fp.libraries.map((l) => (
					<Badge key={`lib-${l.name}`} variant="secondary" className="text-xs">
						{l.name}
						{l.version ? ` ${l.version}` : ''}
						{l.confidence !== 'high' ? ` (${l.confidence})` : ''}
					</Badge>
				))}
				{fp.httpClients.map((c) => (
					<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
						{c.name}
						{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
					</Badge>
				))}
				{fp.dataFetching.map((d) => (
					<Badge
						key={`data-${d.name}`}
						variant={d.treatment === 'tracked' ? 'secondary' : 'outline'}
						className="text-xs"
					>
						{d.name}
						{d.version ? ` ${d.version}` : ''}
						{d.treatment === 'detection-only' ? ' · detect-only' : ''}
					</Badge>
				))}
				{fp.stateManagers.map((s) => (
					<Badge key={`state-${s.name}`} variant="secondary" className="text-xs">
						{s.name}
						{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
					</Badge>
				))}
			</div>
			<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
				{detection.url}
			</p>
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
	return (
		<div>
			{items.map((r) => (
				<RecommendationRow key={r.id} item={r} />
			))}
		</div>
	);
}
