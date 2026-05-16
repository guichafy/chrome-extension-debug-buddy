import { describe, expect, test } from 'vitest';
import type { UrlMatcher } from '@/types/rules';
import {
	createTemplateRule,
	TEMPLATE_GROUPS,
	TEMPLATES,
	type RuleTemplateId,
} from '../ruleTemplates';

const baseUrlMatcher: UrlMatcher = {
	type: 'url',
	enabled: true,
	pattern: 'api.example.com/data',
	isRegex: false,
};

// Helper: extrai a "head" action de um template/draft (no schema v2 cada
// template tem `actions: Action[]` e a primeira é a head do encadeamento).
const headAction = <T extends { actions: ReadonlyArray<{ type: string }> }>(spec: T) =>
	spec.actions[0];

describe('ruleTemplates — TEMPLATES catalog', () => {
	test('a quantidade total de templates está dentro do range 6-10 do PRD', () => {
		const ids = Object.keys(TEMPLATES) as RuleTemplateId[];
		expect(ids.length).toBeGreaterThanOrEqual(6);
		expect(ids.length).toBeLessThanOrEqual(10);
	});

	test('cada template tem id, name e description não vazios + ao menos uma action habilitada', () => {
		for (const [id, spec] of Object.entries(TEMPLATES)) {
			expect(spec.id).toBe(id);
			expect(spec.name.trim().length).toBeGreaterThan(0);
			expect(spec.description.trim().length).toBeGreaterThan(0);
			expect(spec.actions.length).toBeGreaterThanOrEqual(1);
			expect(spec.actions[0].enabled).toBe(true);
		}
	});

	test('cobre os 4 tipos de regra (mock, requestDelay, transform, breakpoint)', () => {
		const types = new Set(Object.values(TEMPLATES).map((t) => headAction(t).type));
		expect(types.has('mock')).toBe(true);
		expect(types.has('requestDelay')).toBe(true);
		expect(types.has('transform')).toBe(true);
		expect(types.has('breakpoint')).toBe(true);
	});

	test('cobre todos os templates obrigatórios listados no PRD US-011', () => {
		// Mock templates
		expect(TEMPLATES.mock_500).toBeDefined();
		expect(headAction(TEMPLATES.mock_500).type).toBe('mock');
		expect(TEMPLATES.mock_404).toBeDefined();
		expect(headAction(TEMPLATES.mock_404).type).toBe('mock');
		expect(TEMPLATES.mock_empty).toBeDefined();
		expect(headAction(TEMPLATES.mock_empty).type).toBe('mock');

		// Delay template (stage='request')
		expect(TEMPLATES.delay_3s).toBeDefined();
		expect(headAction(TEMPLATES.delay_3s).type).toBe('requestDelay');
		expect(TEMPLATES.delay_3s.stage).toBe('request');

		// Transform templates
		expect(TEMPLATES.transform_cors_header).toBeDefined();
		expect(headAction(TEMPLATES.transform_cors_header).type).toBe('transform');
		expect(TEMPLATES.transform_remove_id).toBeDefined();
		expect(headAction(TEMPLATES.transform_remove_id).type).toBe('transform');

		// Breakpoint template
		expect(TEMPLATES.breakpoint_manual).toBeDefined();
		expect(headAction(TEMPLATES.breakpoint_manual).type).toBe('breakpoint');
	});

	test('TEMPLATE_GROUPS referenciam apenas IDs presentes em TEMPLATES', () => {
		for (const group of TEMPLATE_GROUPS) {
			for (const templateId of group.templates) {
				expect(TEMPLATES[templateId]).toBeDefined();
			}
		}
	});

	test('TEMPLATE_GROUPS cobrem todos os 10 templates sem duplicação', () => {
		const grouped = TEMPLATE_GROUPS.flatMap((g) => g.templates);
		const uniqueIds = new Set(grouped);
		expect(uniqueIds.size).toBe(grouped.length);
		expect(uniqueIds.size).toBe(Object.keys(TEMPLATES).length);
	});

	test('TEMPLATE_GROUPS têm um grupo por tipo de ação', () => {
		const groupIds = TEMPLATE_GROUPS.map((g) => g.id);
		expect(groupIds).toContain('mock');
		expect(groupIds).toContain('delay');
		expect(groupIds).toContain('transform');
		expect(groupIds).toContain('breakpoint');
	});
});

describe('ruleTemplates — Mock templates reuso de presets', () => {
	test('mock_500 cria mock com status 500 e statusPhrase Internal Server Error', () => {
		const draft = createTemplateRule('mock_500');
		expect(draft.actions[0]).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
		});
	});

	test('mock_404 cria mock com status 404', () => {
		const draft = createTemplateRule('mock_404');
		expect(draft.actions[0]).toMatchObject({
			type: 'mock',
			status: 404,
			statusPhrase: 'Not Found',
		});
	});

	test('mock_empty cria mock com body vazio', () => {
		const draft = createTemplateRule('mock_empty');
		expect(draft.actions[0]).toMatchObject({ type: 'mock', status: 200, body: '' });
	});
});

describe('ruleTemplates — Delay template', () => {
	test('delay_3s cria RequestDelayAction com timeMs 3000 (stage=request)', () => {
		const draft = createTemplateRule('delay_3s');
		expect(draft.stage).toBe('request');
		expect(draft.actions[0]).toEqual({
			type: 'requestDelay',
			enabled: true,
			timeMs: 3000,
		});
	});
});

describe('ruleTemplates — Transform templates', () => {
	test('transform_cors_header cria TransformAction com header CORS', () => {
		const draft = createTemplateRule('transform_cors_header');
		const action = draft.actions[0];
		expect(action.type).toBe('transform');
		if (action.type !== 'transform') return;
		expect(action.mode).toBe('declarative');
		expect(action.addHeaders).toEqual({
			'access-control-allow-origin': '*',
		});
		expect(action.operations).toEqual([]);
	});

	test('transform_remove_id cria TransformAction com operação remove em $.id', () => {
		const draft = createTemplateRule('transform_remove_id');
		const action = draft.actions[0];
		expect(action.type).toBe('transform');
		if (action.type !== 'transform') return;
		expect(action.mode).toBe('declarative');
		expect(action.operations).toHaveLength(1);
		const op = action.operations?.[0];
		expect(op?.type).toBe('remove');
		expect(op?.path).toBe('$.id');
	});
});

describe('ruleTemplates — Breakpoint template', () => {
	test('breakpoint_manual cria BreakpointAction com description útil', () => {
		const draft = createTemplateRule('breakpoint_manual');
		const action = draft.actions[0];
		expect(action.type).toBe('breakpoint');
		if (action.type !== 'breakpoint') return;
		expect(action.enabled).toBe(true);
		expect(action.description).toBeDefined();
		expect((action.description ?? '').length).toBeGreaterThan(0);
	});
});

describe('createTemplateRule — matchers default', () => {
	test('sem baseMatcher gera matcher de URL placeholder vazio + disabled', () => {
		const draft = createTemplateRule('mock_500');
		const url = draft.matchers.find((m) => m.type === 'url');
		expect(url).toEqual({ type: 'url', enabled: false, pattern: '', isRegex: false });
	});

	test('sem baseMatcher gera matcher de método ANY habilitado', () => {
		const draft = createTemplateRule('mock_500');
		const method = draft.matchers.find((m) => m.type === 'method');
		expect(method).toEqual({ type: 'method', enabled: true, method: 'ANY' });
	});

	test('aceita baseMatcher e o coloca antes do matcher de método', () => {
		const draft = createTemplateRule('mock_500', baseUrlMatcher);
		expect(draft.matchers[0]).toEqual(baseUrlMatcher);
		expect(draft.matchers[1]).toMatchObject({ type: 'method', enabled: true, method: 'ANY' });
	});
});

describe('createTemplateRule — clone defensivo', () => {
	test('mutar a action retornada não afeta o spec original', () => {
		const draft1 = createTemplateRule('transform_remove_id');
		const a1 = draft1.actions[0];
		if (a1.type !== 'transform') return;
		a1.operations?.push({ id: 'extra', type: 'add', path: '$.foo', value: '"bar"' });

		const draft2 = createTemplateRule('transform_remove_id');
		const a2 = draft2.actions[0];
		if (a2.type !== 'transform') return;
		expect(a2.operations).toHaveLength(1);
	});

	test('mutar headers do mock template não afeta o spec original', () => {
		const draft1 = createTemplateRule('mock_500');
		const a1 = draft1.actions[0];
		if (a1.type !== 'mock') return;
		a1.headers['x-test'] = 'mutado';

		const draft2 = createTemplateRule('mock_500');
		const a2 = draft2.actions[0];
		if (a2.type !== 'mock') return;
		expect(a2.headers['x-test']).toBeUndefined();
	});

	test('mutar addHeaders do template CORS não afeta o spec original', () => {
		const draft1 = createTemplateRule('transform_cors_header');
		const a1 = draft1.actions[0];
		if (a1.type !== 'transform') return;
		if (!a1.addHeaders) throw new Error('template CORS deve trazer addHeaders');
		a1.addHeaders['x-test'] = 'mutado';

		const draft2 = createTemplateRule('transform_cors_header');
		const a2 = draft2.actions[0];
		if (a2.type !== 'transform') return;
		expect(a2.addHeaders?.['x-test']).toBeUndefined();
	});
});
