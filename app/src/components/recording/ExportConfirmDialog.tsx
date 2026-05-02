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
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function ExportConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Exportar sessão — leia antes</DialogTitle>
					<DialogDescription className="text-sm">
						Este arquivo contém TUDO que foi gravado: requisições e respostas da rede (incluindo
						<strong> Authorization headers e cookies</strong>), todas as mensagens de console
						(incluindo qualquer <strong>senha, token ou número de cartão</strong> que tenha sido
						logado em <code>console.log</code>), e o estado da aplicação. Revise antes de anexar em
						qualquer lugar público (Jira, Slack, e-mail). Mascaramento automático será adicionado em
						uma versão futura.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						variant="destructive"
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
					>
						Entendi, exportar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
