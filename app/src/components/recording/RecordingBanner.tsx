import { Button } from '@/components/ui/button';
import { useRecording } from '@/hooks/useRecording';

const SIZE_LIMIT_MB = 50;
const DURATION_LIMIT_MIN = 10;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
	const ss = String(totalSec % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}

interface Props {
	tabId: number | null;
}

export function RecordingBanner({ tabId }: Props) {
	const { status, stopRecording } = useRecording(tabId);
	if (!status.active) return null;
	const sizeMB = status.sizeBytes / (1024 * 1024);
	const durationMin = status.durationMs / (60 * 1000);
	const nearLimit = sizeMB >= SIZE_LIMIT_MB * 0.8 || durationMin >= DURATION_LIMIT_MIN * 0.8;

	return (
		<output
			aria-label="Gravação ativa"
			className={`flex items-center justify-between border-b px-4 py-2 text-sm ${
				nearLimit ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
			}`}
		>
			<div className="flex items-center gap-3">
				<span className="size-2 rounded-full bg-current animate-pulse" aria-hidden="true" />
				<span className="font-medium">Gravando sessão</span>
				<span className="font-mono">
					{formatDuration(status.durationMs)} / {DURATION_LIMIT_MIN}:00
				</span>
				<span className="font-mono">
					{formatBytes(status.sizeBytes)} / {SIZE_LIMIT_MB} MB
				</span>
				{nearLimit && <span>(perto do limite — exporte ou pare)</span>}
			</div>
			<Button size="sm" variant="outline" onClick={() => void stopRecording()}>
				Parar gravação
			</Button>
		</output>
	);
}
