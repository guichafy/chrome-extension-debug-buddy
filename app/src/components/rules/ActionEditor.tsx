import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Action, BreakpointAction, DelayAction, MockAction, TransformAction } from '@/types/rules';
import { TransformActionEditor } from './TransformActionEditor';
import { DelayActionEditor } from './DelayActionEditor';
import { MockActionEditor } from './MockActionEditor';

interface ActionEditorProps {
	action: Action;
	onChange: (action: Action) => void;
	/**
	 * Body capturado da response que originou a regra (quando aplicável).
	 * Repassado ao TransformActionEditor para popular o painel de preview com
	 * o JSON real do servidor em vez do exemplo fixo.
	 */
	samplePayload?: string;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({ action, onChange, samplePayload }) => {
	// Renderizar editor específico para cada tipo de ação
	const renderActionEditor = () => {
		switch (action.type) {
			case 'mock':
				return <MockActionEditor action={action as MockAction} onChange={onChange} />;
			case 'delay':
				return <DelayActionEditor action={action as DelayAction} onChange={onChange} />;
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
			default:
				return null;
		}
	};

	// Editor para ação de breakpoint
	const renderBreakpointActionEditor = (breakpointAction: BreakpointAction) => (
		<div className="space-y-4" data-testid="breakpoint-action-editor">
			<div>
				<Label htmlFor="breakpoint-description" className="font-medium">
					Descrição (opcional)
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
					placeholder="Ex: pausar para conferir token de autenticação antes de prosseguir"
					className="h-24"
				/>
				<p className="mt-2 text-xs text-muted-foreground">
					Esta descrição aparecerá no inspector de respostas quando a regra disparar — útil para
					lembrar por que o breakpoint foi configurado.
				</p>
			</div>

			<div
				className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30"
				data-testid="breakpoint-action-info"
			>
				<h4 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
					Sobre o Breakpoint
				</h4>
				<p className="text-sm text-blue-700 dark:text-blue-200/80">
					Quando esta regra casar, o request será pausado e o dialog de inspeção será aberto para
					edição manual da resposta antes de prosseguir.
				</p>
			</div>
		</div>
	);

	return <div className="space-y-4">{renderActionEditor()}</div>;
};
