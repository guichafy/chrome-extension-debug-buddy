import { useRecording } from '@/hooks/useRecording';

const SIZE_LIMIT_MB = 50;
const DURATION_LIMIT_MIN = 10;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
	tabId: number | null;
}

export function RecordingBanner({ tabId }: Props) {
	// Continuamos lendo `status` via useRecording (polling de tamanho/duração
	// em curso) — mas o "Parar" agora dispara stopDebugging para respeitar o
	// lifecycle binding (Bug 1): gravação acompanha interceptação. Parar só a
	// gravação enquanto o debugger continua atachado é o caso ruim invertido.
	const { status } = useRecording(tabId);
	if (!status.active) return null;

	const stopAll = (): void => {
		void chrome.runtime.sendMessage({ action: 'stopDebugging' });
	};

	const sizeMB = status.sizeBytes / (1024 * 1024);
	const durationMin = status.durationMs / 60000;
	const sizePercent = Math.min(100, (sizeMB / SIZE_LIMIT_MB) * 100);
	const timePercent = Math.min(100, (durationMin / DURATION_LIMIT_MIN) * 100);
	const nearLimit = sizePercent >= 80 || timePercent >= 80;

	return (
		<button
			type="button"
			onClick={stopAll}
			className="fixed inset-x-0 top-0 z-50 flex w-full items-center justify-center gap-3 bg-red-600 px-4 py-2 text-white shadow-lg hover:bg-red-700"
			aria-label="Gravando — clique para parar"
		>
			<span
				className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"
				aria-hidden="true"
			/>
			<span className="font-bold">GRAVANDO</span>
			<span className="font-mono text-xs">
				{formatBytes(status.sizeBytes)} / {SIZE_LIMIT_MB} MB · {durationMin.toFixed(1)} /{' '}
				{DURATION_LIMIT_MIN} min
			</span>
			{nearLimit && (
				<span className="rounded bg-yellow-300 px-2 py-0.5 font-semibold text-red-900 text-xs">
					próximo do limite
				</span>
			)}
			<span className="text-xs underline">clique para parar</span>
		</button>
	);
}
