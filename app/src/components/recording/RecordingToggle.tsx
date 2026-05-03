import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getRecordingDisabled, setRecordingDisabled } from '@/lib/session/recordingPreference';

interface Props {
	tabId: number | null;
	interceptionActive: boolean;
}

// Switch agora é opt-out: storage guarda `recordingDisabled` (boolean), default
// false. UI mostra "Gravação ON" quando storage=false (gravando junto com a
// interceptação). Click inverte e persiste.
//
// Importante: este componente NÃO chama mais startRecording/stopRecording — esse
// fluxo está acoplado ao startDebugging/stopDebugging em background.ts (Bug 1).
// O switch só decide se o auto-start vai disparar na próxima interceptação.
export function RecordingToggle({ tabId, interceptionActive }: Props) {
	const [disabled, setDisabled] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getRecordingDisabled().then((v) => {
			if (!cancelled) setDisabled(v);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const switchDisabled = tabId === null || !interceptionActive || disabled === null;
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

	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="recording-switch" className="text-sm">
				Gravação
			</Label>
			<Switch
				id="recording-switch"
				checked={checked}
				onCheckedChange={onToggle}
				disabled={switchDisabled}
				aria-label="Gravação"
			/>
		</div>
	);
}
