import { ImportButton } from '@/components/recording/ImportButton';
import { SessionRow } from '@/components/recording/SessionRow';
import { useSessions } from '@/hooks/useSessions';

export function SessionsPage() {
	const { sessions, refresh, deleteSession } = useSessions();
	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Sessões salvas</h1>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{sessions.length} / 10 (limite de retenção)
					</span>
					<ImportButton onImported={() => void refresh()} />
				</div>
			</div>
			{sessions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nenhuma sessão salva. Inicie uma gravação para criar a primeira.
				</p>
			) : (
				<div className="flex flex-col">
					{sessions.map((s) => (
						<SessionRow key={s.id} session={s} onDelete={(id) => void deleteSession(id)} />
					))}
				</div>
			)}
		</div>
	);
}
