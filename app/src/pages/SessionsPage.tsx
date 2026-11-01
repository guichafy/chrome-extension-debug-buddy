import { ImportButton } from '@/components/recording/ImportButton';
import { SessionRow } from '@/components/recording/SessionRow';
import { useSessions } from '@/hooks/useSessions';
import { useTranslation } from 'react-i18next';

export function SessionsPage() {
	const { t } = useTranslation('sessions');
	const { sessions, refresh, deleteSession } = useSessions();
	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">{t('page.title')}</h1>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{t('page.retention', { saved: sessions.length, limit: 10 })}
					</span>
					<ImportButton onImported={() => void refresh()} />
				</div>
			</div>
			{sessions.length === 0 ? (
				<p className="text-muted-foreground text-sm">{t('page.empty')}</p>
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
