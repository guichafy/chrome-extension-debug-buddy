import { useTranslation } from 'react-i18next';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
	Action,
	BlockAction,
	BreakpointAction,
	MockAction,
	RequestDelayAction,
	RequestModifyAction,
	ResponseModifyAction,
	RuleStage,
	TransformAction,
} from '@/types/rules';
import { TransformActionEditor } from './TransformActionEditor';
import { DelayActionEditor } from './DelayActionEditor';
import { MockActionEditor } from './MockActionEditor';
import { BlockActionEditor } from './BlockActionEditor';
import { RequestModifyActionEditor } from './RequestModifyActionEditor';
import { ResponseModifyActionEditor } from './ResponseModifyActionEditor';

interface ActionEditorProps {
	action: Action;
	onChange: (action: Action) => void;
	/**
	 * Stage da regra onde esta action vai rodar. Usado pelos editores que
	 * mudam mensagem/banner por estágio (`MockActionEditor`). Default
	 * mantém compatibilidade com o wizard legado (stage='response').
	 */
	stage?: RuleStage;
	/**
	 * Body capturado da response que originou a regra (quando aplicável).
	 * Repassado ao TransformActionEditor para popular o painel de preview com
	 * o JSON real do servidor em vez do exemplo fixo.
	 */
	samplePayload?: string;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({
	action,
	onChange,
	stage,
	samplePayload,
}) => {
	const { t } = useTranslation('ruleEditor');
	const renderActionEditor = () => {
		switch (action.type) {
			case 'mock':
				return <MockActionEditor action={action as MockAction} onChange={onChange} stage={stage} />;
			case 'requestDelay':
				return <DelayActionEditor action={action as RequestDelayAction} onChange={onChange} />;
			case 'transform':
				return (
					<TransformActionEditor
						action={action as TransformAction}
						onChange={onChange}
						initialSampleResponse={samplePayload}
					/>
				);
			case 'breakpoint':
				return renderBreakpointActionEditor(action as BreakpointAction);
			case 'requestModify':
				return (
					<RequestModifyActionEditor action={action as RequestModifyAction} onChange={onChange} />
				);
			case 'responseModify':
				return (
					<ResponseModifyActionEditor action={action as ResponseModifyAction} onChange={onChange} />
				);
			case 'block':
				return <BlockActionEditor action={action as BlockAction} onChange={onChange} />;
			default:
				return null;
		}
	};

	const renderBreakpointActionEditor = (breakpointAction: BreakpointAction) => (
		<div className="space-y-4" data-testid="breakpoint-action-editor">
			<div>
				<Label htmlFor="breakpoint-description" className="font-medium">
					{t('breakpoint.descriptionLabel')}
				</Label>
				<Textarea
					id="breakpoint-description"
					data-testid="breakpoint-action-description"
					value={breakpointAction.description || ''}
					onChange={(e) => {
						onChange({
							...breakpointAction,
							description: e.target.value,
						});
					}}
					placeholder={t('breakpoint.descriptionPlaceholder')}
					className="h-24"
				/>
				<p className="mt-2 text-xs text-muted-foreground">{t('breakpoint.descriptionHelp')}</p>
			</div>

			<div
				className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30"
				data-testid="breakpoint-action-info"
			>
				<h4 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
					{t('breakpoint.infoTitle')}
				</h4>
				<p className="text-sm text-blue-700 dark:text-blue-200/80">{t('breakpoint.infoText')}</p>
			</div>
		</div>
	);

	return <div className="space-y-4">{renderActionEditor()}</div>;
};
