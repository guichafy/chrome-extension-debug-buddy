import type {
	Action,
	BreakpointAction,
	Matcher,
	MockAction,
	RequestDelayAction,
	RuleDraft,
	RuleStage,
	TransformAction,
	UrlMatcher,
} from '@/types/rules';
import { PRESETS } from './rulePresets';

// Identificadores estáveis para os templates curados oferecidos no welcome do
// wizard. Cobrem os 4 tipos clássicos (mock, delay, transform, breakpoint).
export type RuleTemplateId =
	| 'mock_500'
	| 'mock_404'
	| 'mock_401'
	| 'mock_empty'
	| 'delay_3s'
	| 'transform_cors_header'
	| 'transform_remove_id'
	| 'breakpoint_manual';

export interface TemplateSpec {
	id: RuleTemplateId;
	name: string;
	description: string;
	stage: RuleStage;
	actions: Action[];
}

const mockTemplate = (
	id: RuleTemplateId,
	presetKey: keyof typeof PRESETS,
	override?: Partial<MockAction>,
): TemplateSpec => {
	const preset = PRESETS[presetKey];
	const merged = preset.actions.map((a): Action => {
		if (a.type === 'mock' && override) {
			return { ...a, ...override };
		}
		return a;
	});
	return {
		id,
		name: preset.name,
		description: preset.description,
		stage: preset.stage,
		actions: merged,
	};
};

const requestDelayAction = (timeMs: number): RequestDelayAction => ({
	type: 'requestDelay',
	enabled: true,
	timeMs,
});

const transformAddHeaderAction = (headers: Record<string, string>): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations: [],
	addHeaders: headers,
});

const transformRemoveJsonPathAction = (path: string): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations: [
		{
			id: 'op-template-remove-id',
			type: 'remove',
			path,
		},
	],
});

const breakpointAction = (description: string): BreakpointAction => ({
	type: 'breakpoint',
	enabled: true,
	description,
});

export const TEMPLATES: Record<RuleTemplateId, TemplateSpec> = {
	mock_500: mockTemplate('mock_500', 'http_error_500'),
	mock_404: mockTemplate('mock_404', 'http_error_404'),
	mock_401: mockTemplate('mock_401', 'http_error_401'),
	mock_empty: mockTemplate('mock_empty', 'empty_response'),
	delay_3s: {
		id: 'delay_3s',
		name: 'Atrasar resposta em 3s',
		description:
			'Chama o servidor normalmente e segura a resposta por 3000ms antes de devolvê-la ao cliente.',
		stage: 'request',
		actions: [requestDelayAction(3000)],
	},
	transform_cors_header: {
		id: 'transform_cors_header',
		name: 'Adicionar header CORS Access-Control-Allow-Origin: *',
		description:
			'Chama o servidor e injeta o cabeçalho CORS na resposta para permitir requisições cross-origin durante o debug.',
		stage: 'response',
		actions: [transformAddHeaderAction({ 'access-control-allow-origin': '*' })],
	},
	transform_remove_id: {
		id: 'transform_remove_id',
		name: 'Remover campo id da resposta JSON',
		description:
			'Chama o servidor e remove o campo $.id do body JSON da resposta, útil para testar como o cliente reage à ausência do identificador.',
		stage: 'response',
		actions: [transformRemoveJsonPathAction('$.id')],
	},
	breakpoint_manual: {
		id: 'breakpoint_manual',
		name: 'Pausar para inspeção/edição manual',
		description:
			'Pausa a requisição assim que casar e abre o dialog para você inspecionar e editar a resposta antes de prosseguir.',
		stage: 'response',
		actions: [
			breakpointAction('Pausa para inspeção e edição manual da resposta antes de prosseguir.'),
		],
	},
};

export interface TemplateGroup {
	id: 'mock' | 'delay' | 'transform' | 'breakpoint';
	label: string;
	templates: RuleTemplateId[];
}

// Agrupamento por tipo de ação — alinha com a paleta de cores em
// `getActionVisuals` e mantém a UX consistente entre welcome e listagem.
export const TEMPLATE_GROUPS: TemplateGroup[] = [
	{
		id: 'mock',
		label: 'Mock — não chama o servidor',
		templates: ['mock_500', 'mock_404', 'mock_401', 'mock_empty'],
	},
	{
		id: 'delay',
		label: 'Delay — segura a resposta',
		templates: ['delay_3s'],
	},
	{
		id: 'transform',
		label: 'Transform — chama o servidor e modifica a resposta',
		templates: ['transform_cors_header', 'transform_remove_id'],
	},
	{
		id: 'breakpoint',
		label: 'Breakpoint — pausa para inspeção',
		templates: ['breakpoint_manual'],
	},
];

export function createTemplateRule(
	templateId: RuleTemplateId,
	baseMatcher?: UrlMatcher,
): RuleDraft {
	const spec = TEMPLATES[templateId];
	const matchers: Matcher[] = [];
	if (baseMatcher) {
		matchers.push(baseMatcher);
	} else {
		matchers.push({ type: 'url', enabled: false, pattern: '', isRegex: false });
	}
	matchers.push({ type: 'method', enabled: true, method: 'ANY' });

	return {
		name: spec.name,
		enabled: true,
		stage: spec.stage,
		matchers,
		actions: spec.actions.map((a) => cloneAction(a)),
	};
}

function cloneAction(action: Action): Action {
	switch (action.type) {
		case 'mock':
			return { ...action, headers: { ...action.headers } };
		case 'requestDelay':
			return { ...action };
		case 'requestModify':
			return {
				...action,
				...(action.setHeaders ? { setHeaders: { ...action.setHeaders } } : {}),
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.bodyOperations
					? { bodyOperations: action.bodyOperations.map((op) => ({ ...op })) }
					: {}),
			};
		case 'responseModify':
			return {
				...action,
				...(action.setHeaders ? { setHeaders: { ...action.setHeaders } } : {}),
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.bodyOperations
					? { bodyOperations: action.bodyOperations.map((op) => ({ ...op })) }
					: {}),
			};
		case 'transform':
			return {
				...action,
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.operations ? { operations: action.operations.map((op) => ({ ...op })) } : {}),
			};
		case 'block':
			return { ...action };
		case 'breakpoint':
			return { ...action };
		default: {
			const exhaustive: never = action;
			throw new Error(
				`Tipo de ação desconhecido em template: ${(exhaustive as { type: string }).type}`,
			);
		}
	}
}
