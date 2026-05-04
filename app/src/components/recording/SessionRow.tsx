import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { base64ToArrayBuffer } from '@/lib/session/binaryTransport';
import type { Session } from '@/lib/session/types';
import { ExportConfirmDialog } from './ExportConfirmDialog';

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | null): string {
	if (ms === null) return 'em andamento';
	const totalSec = Math.floor(ms / 1000);
	const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
	const ss = String(totalSec % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}

interface Props {
	session: Session;
	onDelete: (id: string) => void;
}

export function SessionRow({ session, onDelete }: Props) {
	// Estimativa quick — bytes reais persistidos são ~5% maior por overhead IDB.
	const sizeBytes = JSON.stringify(session).length;
	const duration = session.endedAt !== null ? session.endedAt - session.startedAt : null;

	const [exportOpen, setExportOpen] = useState(false);

	const onConfirmExport = async () => {
		const res = await chrome.runtime.sendMessage({
			action: 'exportSession',
			sessionId: session.id,
		});
		if (!res?.ok || typeof res.data !== 'string') return;
		// Background entrega ArrayBuffer encodado em base64 (sendMessage não
		// preserva ArrayBuffer cru no transporte). Decodamos antes do Blob.
		const buf = base64ToArrayBuffer(res.data);
		const blob = new Blob([buf], { type: 'application/zip' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${session.id}.dbsession`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b px-4 py-2 text-sm">
			<Badge variant={session.origin === 'recorded' ? 'default' : 'secondary'}>
				{session.origin === 'recorded' ? 'Gravada' : 'Importada'}
			</Badge>
			<Link to={`/replay/${session.id}`} className="truncate font-mono text-xs hover:underline">
				{session.metadata.initialUrl}
			</Link>
			<span className="font-mono text-xs">{formatDuration(duration)}</span>
			<span className="font-mono text-xs">{formatBytes(sizeBytes)}</span>
			<span className="text-muted-foreground text-xs">
				{new Date(session.startedAt).toLocaleString('pt-BR')}
			</span>
			<Button size="sm" variant="ghost" onClick={() => setExportOpen(true)}>
				Exportar
			</Button>
			<Button size="sm" variant="ghost" onClick={() => onDelete(session.id)}>
				Excluir
			</Button>
			<ExportConfirmDialog
				open={exportOpen}
				onOpenChange={setExportOpen}
				onConfirm={() => void onConfirmExport()}
			/>
		</div>
	);
}
