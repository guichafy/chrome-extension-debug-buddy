import React from 'react';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { BlockAction, BlockErrorReason } from '@/types/rules';

interface BlockActionEditorProps {
	action: BlockAction;
	onChange: (action: BlockAction) => void;
}

interface BlockReasonOption {
	value: BlockErrorReason;
	label: string;
	description: string;
}

// Subset curado em `types/rules.ts` (9 valores). Mesma lista em ordem
// pedagógica — falhas genéricas primeiro, depois condições mais específicas.
const BLOCK_REASONS: readonly BlockReasonOption[] = [
	{
		value: 'Failed',
		label: 'Failed',
		description: 'Erro genérico — net::ERR_FAILED no devtools.',
	},
	{
		value: 'Aborted',
		label: 'Aborted',
		description: 'Requisição cancelada — net::ERR_ABORTED.',
	},
	{
		value: 'TimedOut',
		label: 'TimedOut',
		description: 'Timeout simulado — net::ERR_TIMED_OUT.',
	},
	{
		value: 'AccessDenied',
		label: 'AccessDenied',
		description: 'Acesso negado por política — net::ERR_ACCESS_DENIED.',
	},
	{
		value: 'ConnectionFailed',
		label: 'ConnectionFailed',
		description: 'Falha na conexão TCP — net::ERR_CONNECTION_FAILED.',
	},
	{
		value: 'ConnectionRefused',
		label: 'ConnectionRefused',
		description: 'Servidor recusou — net::ERR_CONNECTION_REFUSED.',
	},
	{
		value: 'NameNotResolved',
		label: 'NameNotResolved',
		description: 'DNS falhou — net::ERR_NAME_NOT_RESOLVED.',
	},
	{
		value: 'BlockedByClient',
		label: 'BlockedByClient',
		description: 'Bloqueado por extensão/cliente — net::ERR_BLOCKED_BY_CLIENT.',
	},
	{
		value: 'InternetDisconnected',
		label: 'InternetDisconnected',
		description: 'Sem conectividade — net::ERR_INTERNET_DISCONNECTED.',
	},
];

function describeReason(value: BlockErrorReason): string {
	const found = BLOCK_REASONS.find((r) => r.value === value);
	if (!found) {
		throw new Error(`BlockErrorReason desconhecido: ${value}`);
	}
	return found.description;
}

export const BlockActionEditor: React.FC<BlockActionEditorProps> = ({ action, onChange }) => {
	const handleReasonChange = (next: string) => {
		onChange({ ...action, errorReason: next as BlockErrorReason });
	};

	return (
		<div className="space-y-4" data-testid="block-action-editor">
			<div>
				<Label htmlFor="block-action-reason" className="font-medium">
					Motivo do bloqueio
				</Label>
				<Select value={action.errorReason} onValueChange={handleReasonChange}>
					<SelectTrigger
						id="block-action-reason"
						className="mt-1"
						data-testid="block-action-reason-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{BLOCK_REASONS.map((option) => (
							<SelectItem
								key={option.value}
								value={option.value}
								data-testid={`block-action-reason-option-${option.value}`}
							>
								<div className="flex flex-col">
									<span className="font-medium">{option.label}</span>
									<span className="text-xs text-muted-foreground">{option.description}</span>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="mt-2 text-xs text-muted-foreground" data-testid="block-action-reason-help">
					{describeReason(action.errorReason)}
				</p>
			</div>

			<div
				className="rounded-md border border-destructive/30 bg-destructive/10 p-4"
				data-testid="block-action-info"
			>
				<h4 className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
					<LucideIcon name="alert-triangle" className="h-4 w-4" />
					Falha imediata, sem chamada à rede
				</h4>
				<p className="text-xs text-destructive/90">
					O request será encerrado com <code>Fetch.failRequest</code> e o motivo selecionado. Útil
					pra simular cenários offline, DNS quebrado, timeout ou bloqueios por política sem mexer no
					servidor.
				</p>
			</div>
		</div>
	);
};

export default BlockActionEditor;
