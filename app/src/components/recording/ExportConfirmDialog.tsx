import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { RedactionConfig } from '@/lib/session/types';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function ExportConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
	const [config, setConfig] = useState<RedactionConfig | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		// Reset entre aberturas pra refletir mudanças que o usuário fez em
		// Configurações > Privacidade entre dois exports.
		setConfig(null);
		setLoadError(null);
		let cancelled = false;
		void (async () => {
			try {
				const res = await chrome.runtime.sendMessage({ action: 'getPrivacyConfig' });
				if (cancelled) return;
				if (!res?.ok || !res.privacyConfig) {
					setLoadError(res?.error ?? 'falha ao ler privacyConfig');
					return;
				}
				setConfig(res.privacyConfig as RedactionConfig);
			} catch (err) {
				if (!cancelled) setLoadError(String(err));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Exportar sessão — leia antes</DialogTitle>
					<DialogDescription className="text-sm">
						Este arquivo contém TUDO que foi gravado: requisições e respostas da rede (incluindo
						<strong> Authorization headers e cookies</strong> quando não mascarados), todas as
						mensagens de console (incluindo qualquer{' '}
						<strong>senha, token ou número de cartão</strong> que tenha sido logado em{' '}
						<code>console.log</code>), e o estado da aplicação. Revise antes de anexar em qualquer
						lugar público (Jira, Slack, e-mail).
					</DialogDescription>
				</DialogHeader>

				<section className="rounded border bg-muted/30 p-3 text-xs">
					<p className="mb-2 font-medium">Mascaramento que será aplicado neste export:</p>
					{loadError && (
						<p className="text-destructive">Erro ao carregar configuração: {loadError}</p>
					)}
					{!config && !loadError && <p className="text-muted-foreground">Carregando…</p>}
					{config && !config.enabled && (
						<p className="text-amber-600 dark:text-amber-400">
							<strong>Atenção:</strong> mascaramento está <strong>desabilitado</strong> em
							Configurações &gt; Privacidade. Nada será redigido neste arquivo.
						</p>
					)}
					{config && config.enabled && (
						<ul className="list-disc space-y-0.5 pl-5">
							<li>
								Headers redigidos:{' '}
								<strong>
									{config.headerKeys.length} chaves + {config.headerRegex.length} regex
								</strong>
							</li>
							<li>
								Body — regex aplicadas: <strong>{config.bodyRegex.length}</strong>
							</li>
							<li>
								Console:{' '}
								<strong>
									{config.consoleEnabled
										? `redigindo (${config.consoleRegex.length} regex)`
										: 'desabilitado para esta sessão'}
								</strong>
							</li>
							<li>
								Estado:{' '}
								<strong>
									{config.stateWhitelistPaths.length > 0
										? `whitelist (${config.stateWhitelistPaths.length} paths permitidos)`
										: `blacklist (${config.stateBlacklistPaths.length} paths redigidos)`}
								</strong>
							</li>
							<li>
								rrweb:{' '}
								<strong>
									{config.rrwebMaskAllInputs ? 'todos os inputs mascarados' : 'só password/cc/cvv'}
								</strong>
							</li>
							<li>
								Truncar paths em stacks: <strong>{config.truncateUserPaths ? 'sim' : 'não'}</strong>
							</li>
						</ul>
					)}
					<p className="mt-2 text-muted-foreground">
						Edite essas regras em <strong>Configurações &gt; Privacidade</strong>.
					</p>
				</section>

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
