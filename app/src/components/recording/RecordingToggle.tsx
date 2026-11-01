import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecording } from '@/hooks/useRecording';
import { getRecordingDisabled, setRecordingDisabled } from '@/lib/session/recordingPreference';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
	tabId: number | null;
	interceptionActive: boolean;
}

const SIZE_LIMIT_MB = 50;
const DURATION_LIMIT_MIN = 10;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Switch agora é opt-out: storage guarda `recordingDisabled` (boolean), default
// false. UI mostra "Gravação ON" quando storage=false (gravando junto com a
// interceptação). Click inverte e persiste.
//
// Importante: este componente NÃO chama mais startRecording/stopRecording — esse
// fluxo está acoplado ao startDebugging/stopDebugging em background.ts (Bug 1).
// O switch só decide se o auto-start vai disparar na próxima interceptação.
//
// Quando há sessão ativa (status.active && interceptionActive), exibe métricas
// (size/duration) + dot pulsante + warning quando próximo do limite. Substitui
// o RecordingBanner descontinuado consolidando tudo dentro do header.
export function RecordingToggle({ tabId, interceptionActive }: Props) {
	const { t } = useTranslation('sessions');
	const [disabled, setDisabled] = useState<boolean | null>(null);
	const { status } = useRecording(tabId);

	useEffect(() => {
		let cancelled = false;
		void getRecordingDisabled().then((v) => {
			if (!cancelled) setDisabled(v);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Switch reflete preferência global (recordingDisabled em storage). Continua
	// editável mesmo sem interceptação ativa para o usuário pré-configurar
	// "gravação OFF por default" antes de clicar em Iniciar Interceptação.
	// Quando há interceptação rodando, onToggle abaixo aplica live via
	// setRecordingLive; sem interceptação, apenas persiste a preferência.
	const switchDisabled = disabled === null;
	// UI mostra ligado quando storage=false. Loading (null) também mostra ligado
	// para não enganar o usuário durante o carregamento inicial — controle vira
	// editável ao terminar o load.
	const checked = disabled === false || disabled === null;

	const onToggle = async (next: boolean) => {
		// next = true significa usuário quer ligar gravação = recordingDisabled=false
		const newDisabled = !next;
		setDisabled(newDisabled);
		await setRecordingDisabled(newDisabled);
		// Live toggle: se já há interceptação rodando, aplicar a mudança imediatamente
		// na sessão ativa em vez de esperar o próximo start.
		if (interceptionActive && tabId !== null) {
			try {
				await chrome.runtime.sendMessage({
					action: 'setRecordingLive',
					tabId,
					active: next,
				});
			} catch (err) {
				console.warn('[recording] setRecordingLive falhou:', err);
			}
		}
	};

	const sizeMB = status.sizeBytes / (1024 * 1024);
	const durationMin = status.durationMs / 60000;
	const sizePercent = Math.min(100, (sizeMB / SIZE_LIMIT_MB) * 100);
	const timePercent = Math.min(100, (durationMin / DURATION_LIMIT_MIN) * 100);
	const nearLimit = sizePercent >= 80 || timePercent >= 80;
	const isRecording = status.active && interceptionActive;

	const switchEl = (
		<Switch
			id="recording-switch"
			checked={checked}
			onCheckedChange={onToggle}
			disabled={switchDisabled}
			aria-label={t('recording.label')}
			className={isRecording ? 'data-[state=checked]:bg-red-600' : undefined}
		/>
	);

	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="recording-switch" className="flex items-center gap-1.5 text-sm">
				{isRecording && (
					<span
						className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500"
						aria-hidden="true"
					/>
				)}
				{t('recording.label')}
			</Label>

			{isRecording ? (
				<TooltipProvider delayDuration={150}>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-2">
								{switchEl}
								<span
									className="font-mono text-muted-foreground text-xs tabular-nums"
									aria-label={t('recording.statusAriaLabel', {
										size: formatBytes(status.sizeBytes),
										sizeLimit: SIZE_LIMIT_MB,
										minutes: durationMin.toFixed(1),
										durationLimit: DURATION_LIMIT_MIN,
									})}
								>
									{formatBytes(status.sizeBytes)} · {durationMin.toFixed(1)}m
								</span>
								{nearLimit && (
									<output className="rounded bg-yellow-300 px-1.5 py-0.5 font-semibold text-[10px] text-red-900">
										{t('recording.nearLimit')}
									</output>
								)}
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="min-w-[220px]">
							<div className="space-y-2 text-xs">
								<div>
									<div className="mb-1 flex justify-between">
										<span>{t('recording.size')}</span>
										<span className="tabular-nums">
											{formatBytes(status.sizeBytes)} / {SIZE_LIMIT_MB} MB
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded bg-muted">
										<div
											className={
												sizePercent >= 80
													? 'h-full bg-red-500 transition-all'
													: 'h-full bg-foreground/60 transition-all'
											}
											style={{ width: `${sizePercent}%` }}
										/>
									</div>
								</div>
								<div>
									<div className="mb-1 flex justify-between">
										<span>{t('recording.duration')}</span>
										<span className="tabular-nums">
											{durationMin.toFixed(1)} / {DURATION_LIMIT_MIN} min
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded bg-muted">
										<div
											className={
												timePercent >= 80
													? 'h-full bg-red-500 transition-all'
													: 'h-full bg-foreground/60 transition-all'
											}
											style={{ width: `${timePercent}%` }}
										/>
									</div>
								</div>
								<div className="text-muted-foreground">{t('recording.stopHint')}</div>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : (
				switchEl
			)}
		</div>
	);
}
