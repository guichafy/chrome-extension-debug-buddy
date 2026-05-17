import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { useDualStageMigrationNotice } from '@/hooks/useDualStageMigrationNotice';

// Phase 9: aviso breaking exibido uma única vez por instalação após o upgrade
// para o schema dual-stage. Texto literal vindo da issue bd-1pc. Persiste o
// dismiss em chrome.storage.local — re-instalar a extensão reseta.

export function DualStageMigrationNotice() {
	const { show, dismiss } = useDualStageMigrationNotice();
	const navigate = useNavigate();

	if (!show) return null;

	const handleExport = () => {
		navigate('/rules-lab');
	};

	return (
		<div
			role="alert"
			className="border-b border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
			data-testid="dual-stage-migration-notice"
		>
			<div className="mx-auto flex max-w-3xl items-start gap-3">
				<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
				<div className="min-w-0 flex-1">
					<div className="font-medium text-foreground">
						Schema das regras mudou — confira antes de seguir.
					</div>
					<p className="mt-1 text-muted-foreground">
						As regras agora atuam num <strong>stage</strong> específico (<code>request</code> ou{' '}
						<code>response</code>) e suportam um array de <strong>actions</strong> encadeadas.
						Regras antigas que não eram compatíveis foram removidas durante a migração. Exporte as
						suas regras atuais para JSON antes de continuar — assim você tem um backup caso queira
						voltar.
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={handleExport}
						data-testid="dual-stage-migration-notice-export"
					>
						<LucideIcon name="download" className="mr-1 h-3.5 w-3.5" />
						Abrir Rules Lab
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => void dismiss()}
						data-testid="dual-stage-migration-notice-dismiss"
					>
						Entendi
					</Button>
				</div>
			</div>
		</div>
	);
}

export default DualStageMigrationNotice;
