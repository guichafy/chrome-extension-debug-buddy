// Defaults canônicos pra cada `ActionType`. Usado pelo editor de chain para
// inicializar uma action recém-adicionada e pelo helper de stage-aware
// fallback que troca actions inválidas quando o stage muda.

import {
	type Action,
	type ActionType,
	type RuleStage,
	REQUEST_STAGE_ACTIONS,
	RESPONSE_STAGE_ACTIONS,
	isActionValidForStage,
} from '@/types/rules';

export function createDefaultActionFor(type: ActionType): Action {
	switch (type) {
		case 'mock':
			return { type: 'mock', enabled: true, status: 200, headers: {} };
		case 'requestDelay':
			return { type: 'requestDelay', enabled: true, timeMs: 1000 };
		case 'transform':
			return { type: 'transform', enabled: true, mode: 'declarative', operations: [] };
		case 'breakpoint':
			return { type: 'breakpoint', enabled: true, description: '' };
		case 'requestModify':
			return { type: 'requestModify', enabled: true };
		case 'responseModify':
			return { type: 'responseModify', enabled: true };
		case 'block':
			return { type: 'block', enabled: true, errorReason: 'Failed' };
		default: {
			const exhaustive: never = type;
			throw new Error(`Tipo de ação não suportado: ${String(exhaustive)}`);
		}
	}
}

// Ordem canônica em que os tipos aparecem no picker de "Adicionar ação".
// Modificadores antes; terminais por último.
const REQUEST_STAGE_ORDER: readonly ActionType[] = [
	'requestModify',
	'requestDelay',
	'mock',
	'block',
	'breakpoint',
];

const RESPONSE_STAGE_ORDER: readonly ActionType[] = [
	'responseModify',
	'transform',
	'mock',
	'breakpoint',
];

export function availableActionTypesForStage(stage: RuleStage): readonly ActionType[] {
	if (stage === 'request') return REQUEST_STAGE_ORDER;
	return RESPONSE_STAGE_ORDER;
}

// Rótulo/descrição de cada tipo de ação vivem no i18n (rules:actionTypes,
// rules:actionDescriptions) — este módulo fica sem texto de UI.

// Quando o usuário troca o stage da regra, descartamos actions que deixaram
// de fazer sentido naquele stage. Mantemos a ordem das válidas.
export function filterActionsForStage(actions: Action[], stage: RuleStage): Action[] {
	return actions.filter((a) => isActionValidForStage(a.type, stage));
}

// Reexport pra quem só importa esse helper saber checar diretamente.
export { REQUEST_STAGE_ACTIONS, RESPONSE_STAGE_ACTIONS, isActionValidForStage };
