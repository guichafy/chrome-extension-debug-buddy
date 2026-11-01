import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
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

// Chave da descrição em ruleEditor:block.reasons.<chave>.
type BlockReasonKey =
	| 'failed'
	| 'aborted'
	| 'timedOut'
	| 'accessDenied'
	| 'connectionFailed'
	| 'connectionRefused'
	| 'nameNotResolved'
	| 'blockedByClient'
	| 'internetDisconnected';

interface BlockReasonOption {
	value: BlockErrorReason;
	descriptionKey: BlockReasonKey;
}

// Subset curado em `types/rules.ts` (9 valores). Mesma lista em ordem
// pedagógica — falhas genéricas primeiro, depois condições mais específicas.
// O rótulo é o próprio valor do CDP (não traduzido).
const BLOCK_REASONS: readonly BlockReasonOption[] = [
	{ value: 'Failed', descriptionKey: 'failed' },
	{ value: 'Aborted', descriptionKey: 'aborted' },
	{ value: 'TimedOut', descriptionKey: 'timedOut' },
	{ value: 'AccessDenied', descriptionKey: 'accessDenied' },
	{ value: 'ConnectionFailed', descriptionKey: 'connectionFailed' },
	{ value: 'ConnectionRefused', descriptionKey: 'connectionRefused' },
	{ value: 'NameNotResolved', descriptionKey: 'nameNotResolved' },
	{ value: 'BlockedByClient', descriptionKey: 'blockedByClient' },
	{ value: 'InternetDisconnected', descriptionKey: 'internetDisconnected' },
];

function reasonDescriptionKey(value: BlockErrorReason): BlockReasonKey {
	const found = BLOCK_REASONS.find((r) => r.value === value);
	if (!found) {
		throw new Error(`BlockErrorReason desconhecido: ${value}`);
	}
	return found.descriptionKey;
}

export const BlockActionEditor: React.FC<BlockActionEditorProps> = ({ action, onChange }) => {
	const { t } = useTranslation('ruleEditor');
	const handleReasonChange = (next: string) => {
		onChange({ ...action, errorReason: next as BlockErrorReason });
	};

	return (
		<div className="space-y-4" data-testid="block-action-editor">
			<div>
				<Label htmlFor="block-action-reason" className="font-medium">
					{t('block.reasonLabel')}
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
									<span className="font-medium">{option.value}</span>
									<span className="text-xs text-muted-foreground">
										{t(`block.reasons.${option.descriptionKey}`)}
									</span>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="mt-2 text-xs text-muted-foreground" data-testid="block-action-reason-help">
					{t(`block.reasons.${reasonDescriptionKey(action.errorReason)}`)}
				</p>
			</div>

			<div
				className="rounded-md border border-destructive/30 bg-destructive/10 p-4"
				data-testid="block-action-info"
			>
				<h4 className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
					<LucideIcon name="alert-triangle" className="h-4 w-4" />
					{t('block.infoTitle')}
				</h4>
				<p className="text-xs text-destructive/90">
					<Trans t={t} i18nKey="block.infoText" components={{ code: <code /> }} />
				</p>
			</div>
		</div>
	);
};

export default BlockActionEditor;
