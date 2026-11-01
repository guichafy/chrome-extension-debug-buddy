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
import { i18n } from '@/i18n/instance';
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

// `name`/`description` (e as actions com texto) são getters: resolvem no
// idioma ativo da UI a cada leitura (textos em rules:templates.<chave>).
export interface TemplateSpec {
	id: RuleTemplateId;
	readonly name: string;
	readonly description: string;
	stage: RuleStage;
	readonly actions: Action[];
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
		get name() {
			return preset.name;
		},
		get description() {
			return preset.description;
		},
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
		get name() {
			return i18n.t('rules:templates.delay3s.name');
		},
		get description() {
			return i18n.t('rules:templates.delay3s.description');
		},
		stage: 'request',
		actions: [requestDelayAction(3000)],
	},
	transform_cors_header: {
		id: 'transform_cors_header',
		get name() {
			return i18n.t('rules:templates.transformCorsHeader.name');
		},
		get description() {
			return i18n.t('rules:templates.transformCorsHeader.description');
		},
		stage: 'response',
		actions: [transformAddHeaderAction({ 'access-control-allow-origin': '*' })],
	},
	transform_remove_id: {
		id: 'transform_remove_id',
		get name() {
			return i18n.t('rules:templates.transformRemoveId.name');
		},
		get description() {
			return i18n.t('rules:templates.transformRemoveId.description');
		},
		stage: 'response',
		actions: [transformRemoveJsonPathAction('$.id')],
	},
	breakpoint_manual: {
		id: 'breakpoint_manual',
		get name() {
			return i18n.t('rules:templates.breakpointManual.name');
		},
		get description() {
			return i18n.t('rules:templates.breakpointManual.description');
		},
		stage: 'response',
		get actions() {
			return [breakpointAction(i18n.t('rules:templates.breakpointManual.actionDescription'))];
		},
	},
};

export interface TemplateGroup {
	id: 'mock' | 'delay' | 'transform' | 'breakpoint';
	// Getter traduzido: rules:templateGroups.<id>.
	readonly label: string;
	templates: RuleTemplateId[];
}

// Agrupamento por tipo de ação — alinha com a paleta de cores em
// `getActionVisuals` e mantém a UX consistente entre welcome e listagem.
export const TEMPLATE_GROUPS: TemplateGroup[] = [
	{
		id: 'mock',
		get label() {
			return i18n.t('rules:templateGroups.mock');
		},
		templates: ['mock_500', 'mock_404', 'mock_401', 'mock_empty'],
	},
	{
		id: 'delay',
		get label() {
			return i18n.t('rules:templateGroups.delay');
		},
		templates: ['delay_3s'],
	},
	{
		id: 'transform',
		get label() {
			return i18n.t('rules:templateGroups.transform');
		},
		templates: ['transform_cors_header', 'transform_remove_id'],
	},
	{
		id: 'breakpoint',
		get label() {
			return i18n.t('rules:templateGroups.breakpoint');
		},
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
