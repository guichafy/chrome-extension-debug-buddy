import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Session } from '@/lib/session/types';

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
	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b px-4 py-2 text-sm">
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
			<Button size="sm" variant="ghost" onClick={() => onDelete(session.id)}>
				Excluir
			</Button>
		</div>
	);
}
