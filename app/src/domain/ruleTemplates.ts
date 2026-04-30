import type {
	Action,
	BreakpointAction,
	DelayAction,
	Matcher,
	MockAction,
	RuleDraft,
	TransformAction,
	UrlMatcher,
} from '@/types/rules';
import { PRESETS } from './rulePresets';

// Identificadores estáveis para os templates curados oferecidos no welcome do
// wizard. Cobrem os 4 tipos de regra (mock, delay, transform, breakpoint)
// conforme PRD US-011.
export type RuleTemplateId =
	| 'mock_500'
	| 'mock_404'
	| 'mock_401'
	| 'mock_403'
	| 'mock_empty'
	| 'mock_latency_fixed'
	| 'delay_3s'
	| 'transform_cors_header'
	| 'transform_remove_id'
	| 'breakpoint_manual';

export interface TemplateSpec {
	id: RuleTemplateId;
	name: string;
	description: string;
	action: Action;
}

const mockSpec = (
	id: RuleTemplateId,
	presetKey: keyof typeof PRESETS,
	override?: Partial<MockAction>,
): TemplateSpec => {
	const preset = PRESETS[presetKey];
	return {
		id,
		name: preset.name,
		description: preset.description,
		action: { ...preset.action, ...override } as MockAction,
	};
};

const delayAction = (timeMs: number): DelayAction => ({
	type: 'delay',
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
	mock_500: mockSpec('mock_500', 'http_error_500'),
	mock_404: mockSpec('mock_404', 'http_error_404'),
	mock_401: mockSpec('mock_401', 'http_error_401'),
	mock_403: mockSpec('mock_403', 'http_error_403'),
	mock_empty: mockSpec('mock_empty', 'empty_response'),
	mock_latency_fixed: mockSpec('mock_latency_fixed', 'latency_fixed'),
	delay_3s: {
		id: 'delay_3s',
		name: 'Atrasar resposta em 3s',
		description:
			'Chama o servidor normalmente e segura a resposta por 3000ms antes de devolvê-la ao cliente.',
		action: delayAction(3000),
	},
	transform_cors_header: {
		id: 'transform_cors_header',
		name: 'Adicionar header CORS Access-Control-Allow-Origin: *',
		description:
			'Chama o servidor e injeta o cabeçalho CORS na resposta para permitir requisições cross-origin durante o debug.',
		action: transformAddHeaderAction({ 'access-control-allow-origin': '*' }),
	},
	transform_remove_id: {
		id: 'transform_remove_id',
		name: 'Remover campo id da resposta JSON',
		description:
			'Chama o servidor e remove o campo $.id do body JSON da resposta, útil para testar como o cliente reage à ausência do identificador.',
		action: transformRemoveJsonPathAction('$.id'),
	},
	breakpoint_manual: {
		id: 'breakpoint_manual',
		name: 'Pausar para inspeção/edição manual',
		description:
			'Pausa a requisição assim que casar e abre o dialog para você inspecionar e editar a resposta antes de prosseguir.',
		action: breakpointAction(
			'Pausa para inspeção e edição manual da resposta antes de prosseguir.',
		),
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
		templates: ['mock_500', 'mock_404', 'mock_401', 'mock_403', 'mock_empty', 'mock_latency_fixed'],
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

// Constrói um RuleDraft pré-preenchido a partir do template. Mesma forma do
// `createPresetRule`: matcher de URL placeholder (vazio + disabled) seguido de
// matcher de método ANY. O componente que aplica o template é responsável por
// reabilitar o matcher de URL quando o usuário entra no editor.
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
		matchers,
		action: cloneAction(spec.action),
	};
}

// Clone defensivo: garante que o consumer não muta o spec original.
function cloneAction(action: Action): Action {
	switch (action.type) {
		case 'mock':
			return {
				...action,
				headers: { ...action.headers },
				...(action.latency ? { latency: { ...action.latency } } : {}),
			};
		case 'delay':
			return { ...action };
		case 'transform':
			return {
				...action,
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.operations ? { operations: action.operations.map((op) => ({ ...op })) } : {}),
			};
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
