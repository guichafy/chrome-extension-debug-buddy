import { useEffect, useState } from 'react';
import type { AntipatternHit } from '@/lib/session/types';
import type { Message } from '@/types/messages';
import { AntipatternHitRow } from './AntipatternHitRow';

const MAX_VISIBLE = 50;

interface Props {
	tabId: number | null;
}

export function LiveAntipatternsPanel({ tabId }: Props) {
	const [hits, setHits] = useState<AntipatternHit[]>([]);

	useEffect(() => {
		// Sempre que a tab alvo muda (ou some), zeramos a lista para não mostrar
		// hits stale de uma sessão passiva anterior.
		setHits([]);
		if (tabId == null) return;
		const onMessage = (msg: Message) => {
			if (msg.action !== 'liveAntipatternHit') return;
			if (msg.tabId !== tabId) return;
			if (!msg.antipatternHit) return;
			setHits((prev) => {
				const ev = msg.antipatternHit;
				if (!ev) return prev;
				const next = [ev, ...prev];
				return next.slice(0, MAX_VISIBLE);
			});
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => {
			chrome.runtime.onMessage.removeListener(onMessage);
		};
	}, [tabId]);

	if (tabId == null) return null;

	return (
		<aside className="fixed right-3 bottom-3 max-h-[60vh] w-[360px] overflow-auto rounded border bg-background shadow-lg">
			<header className="sticky top-0 flex items-center justify-between border-b bg-background px-3 py-2">
				<h2 className="font-semibold text-sm">Live Antipatterns</h2>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => setHits([])}
				>
					limpar
				</button>
			</header>
			{hits.length === 0 ? (
				<p className="p-3 text-muted-foreground text-xs">
					Nenhum antipattern detectado nesta sessão passiva.
				</p>
			) : (
				hits.map((hit, i) => <AntipatternHitRow key={i} hit={hit} startedAt={hit.startTimestamp} />)
			)}
		</aside>
	);
}
