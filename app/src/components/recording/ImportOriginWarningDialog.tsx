import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface Props {
	open: boolean;
	importedOrigin: string;
	currentOrigin: string;
	onContinue: () => void;
	onCancel: () => void;
}

export function ImportOriginWarningDialog({
	open,
	importedOrigin,
	currentOrigin,
	onContinue,
	onCancel,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Sessão de origem diferente</DialogTitle>
					<DialogDescription>
						Esta sessão foi gravada em <strong>{importedOrigin}</strong>, mas a tab atual está em
						<strong> {currentOrigin}</strong>. O replay funciona normalmente, mas verifique se a
						origem é confiável antes de prosseguir — sessões de origem desconhecida podem conter
						conteúdo inesperado.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						Cancelar
					</Button>
					<Button onClick={onContinue}>Continuar</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
