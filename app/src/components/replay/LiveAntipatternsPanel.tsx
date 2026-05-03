import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { AntipatternHit, EnvironmentFingerprint } from '@/lib/session/types';
import type { Message } from '@/types/messages';
import { AntipatternHitRow } from './AntipatternHitRow';

const MAX_VISIBLE = 50;

interface Props {
	tabId: number | null;
}

interface LiveDetection {
	url: string;
	fingerprint: EnvironmentFingerprint;
	timestamp: number;
}

// Painel lateral exibido durante modo passivo (Interceptação ON, Gravação OFF).
// Mostra dois sinais ao vivo, sem persistência:
//   1. Fingerprint detectado na URL atual (framework + libs) — atualiza a cada
//      navegação SPA ou page-load via probe → pageDetected → liveDetection.
//   2. Antipatterns disparados pelo engine (network-driven) — fila com até 50
//      hits mais recentes.
//
// Em modo gravação, o painel não aparece (`tabId == null`); a UI gravada usa
// AntipatternsTab dentro do replay para evitar duplicação.
export function LiveAntipatternsPanel({ tabId }: Props) {
	const [hits, setHits] = useState<AntipatternHit[]>([]);
	const [detection, setDetection] = useState<LiveDetection | null>(null);

	useEffect(() => {
		// Sempre que a tab alvo muda (ou some), zeramos os dois para não mostrar
		// state stale de uma sessão passiva anterior.
		setHits([]);
		setDetection(null);
		if (tabId == null) return;
		const onMessage = (msg: Message) => {
			if (msg.tabId !== tabId) return;
			if (msg.action === 'liveAntipatternHit') {
				const ev = msg.antipatternHit;
				if (!ev) return;
				setHits((prev) => [ev, ...prev].slice(0, MAX_VISIBLE));
			} else if (msg.action === 'liveDetection') {
				if (!msg.payload) return;
				setDetection({
					url: msg.payload.url,
					fingerprint: msg.payload.fingerprint,
					timestamp: msg.payload.timestamp,
				});
			}
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => {
			chrome.runtime.onMessage.removeListener(onMessage);
		};
	}, [tabId]);

	if (tabId == null) return null;

	return (
		<aside className="fixed right-3 bottom-3 max-h-[70vh] w-[360px] overflow-auto rounded border bg-background shadow-lg">
			<header className="sticky top-0 flex items-center justify-between border-b bg-background px-3 py-2">
				<h2 className="font-semibold text-sm">Live Insights</h2>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => {
						setHits([]);
						setDetection(null);
					}}
				>
					limpar
				</button>
			</header>

			<DetectionSection detection={detection} />

			<div className="border-t">
				<h3 className="px-3 pt-2 pb-1 font-medium text-muted-foreground text-xs uppercase">
					Antipatterns
				</h3>
				{hits.length === 0 ? (
					<p className="p-3 text-muted-foreground text-xs">
						Nenhum antipattern detectado nesta sessão passiva.
					</p>
				) : (
					hits.map((hit, i) => (
						<AntipatternHitRow key={i} hit={hit} startedAt={hit.startTimestamp} />
					))
				)}
			</div>
		</aside>
	);
}

function DetectionSection({ detection }: { detection: LiveDetection | null }) {
	return (
		<section className="space-y-1.5 px-3 py-2">
			<h3 className="font-medium text-muted-foreground text-xs uppercase">Detected on this page</h3>
			{detection === null ? (
				<p className="text-muted-foreground text-xs">
					Aguardando primeira detecção do probe nesta tab…
				</p>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="default" className="text-xs">
							{detection.fingerprint.framework.name}
							{detection.fingerprint.framework.version
								? ` ${detection.fingerprint.framework.version}`
								: ''}
						</Badge>
						{detection.fingerprint.httpClients.map((c) => (
							<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
								{c.name}
								{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
							</Badge>
						))}
						{detection.fingerprint.dataFetching.map((d) => (
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
						{detection.fingerprint.stateManagers.map((s) => (
							<Badge
								key={`state-${s.name}`}
								variant={s.treatment === 'tracked' ? 'secondary' : 'outline'}
								className="text-xs"
								title={
									s.treatment === 'detection-only'
										? 'Detectada nesta versão; sem inspector de estado dedicado.'
										: undefined
								}
							>
								{s.name}
								{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
								{s.treatment === 'detection-only' ? ' · detect-only' : ''}
							</Badge>
						))}
					</div>
					<p
						className="break-all font-mono text-[11px] text-muted-foreground"
						title={detection.url}
					>
						{detection.url}
					</p>
				</>
			)}
		</section>
	);
}
