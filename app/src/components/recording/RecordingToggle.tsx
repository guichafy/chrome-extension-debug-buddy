import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRecording } from '@/hooks/useRecording';
import { useSessions } from '@/hooks/useSessions';

const RETENTION_LIMIT = 10;

interface Props {
	tabId: number | null;
	interceptionActive: boolean;
}

export function RecordingToggle({ tabId, interceptionActive }: Props) {
	const { status, startRecording, stopRecording } = useRecording(tabId);
	const { sessions } = useSessions();
	const [openCanvas, setOpenCanvas] = useState(false);
	const [openRetention, setOpenRetention] = useState(false);
	const [canvasOpt, setCanvasOpt] = useState(false);

	const disabled = tabId === null || !interceptionActive;

	const onToggle = async (checked: boolean) => {
		if (!checked) {
			await stopRecording();
			return;
		}
		// Verifica limite de retenção
		if (sessions.length >= RETENTION_LIMIT) {
			setOpenRetention(true);
			return;
		}
		setCanvasOpt(false);
		setOpenCanvas(true);
	};

	const onConfirmStart = async () => {
		setOpenCanvas(false);
		await startRecording(canvasOpt);
	};

	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="recording-switch" className="text-sm">
				Gravação
			</Label>
			<Switch
				id="recording-switch"
				checked={status.active}
				onCheckedChange={onToggle}
				disabled={disabled}
				aria-label="Gravação"
			/>

			<Dialog open={openCanvas} onOpenChange={setOpenCanvas}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Iniciar gravação</DialogTitle>
						<DialogDescription>
							A sessão será gravada localmente até você parar ou atingir o limite (50 MB / 10 min).
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-start gap-3 py-2">
						<Checkbox
							id="canvas-opt"
							checked={canvasOpt}
							onCheckedChange={(v) => setCanvasOpt(v === true)}
						/>
						<div>
							<Label htmlFor="canvas-opt">Capturar canvas (overhead alto)</Label>
							<p className="text-muted-foreground text-xs">
								Necessário para apps com charts, jogos ou editores. Aumenta tamanho da sessão.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setOpenCanvas(false)}>
							Cancelar
						</Button>
						<Button onClick={onConfirmStart}>Iniciar gravação</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={openRetention} onOpenChange={setOpenRetention}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Limite de sessões atingido</DialogTitle>
						<DialogDescription>
							Você já tem {RETENTION_LIMIT} sessões salvas. Delete pelo menos uma na página
							"Sessões" antes de iniciar uma nova gravação.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={() => setOpenRetention(false)}>Entendi</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
