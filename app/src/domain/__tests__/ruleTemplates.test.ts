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

describe('ruleTemplates — TEMPLATES catalog', () => {
	test('a quantidade total de templates está dentro do range 6-10 do PRD', () => {
		const ids = Object.keys(TEMPLATES) as RuleTemplateId[];
		expect(ids.length).toBeGreaterThanOrEqual(6);
		expect(ids.length).toBeLessThanOrEqual(10);
	});

	test('cada template tem id, name e description não vazios', () => {
		for (const [id, spec] of Object.entries(TEMPLATES)) {
			expect(spec.id).toBe(id);
			expect(spec.name.trim().length).toBeGreaterThan(0);
			expect(spec.description.trim().length).toBeGreaterThan(0);
			expect(spec.action).toBeDefined();
			expect(spec.action.enabled).toBe(true);
		}
	});

	test('cobre os 4 tipos de regra (mock, delay, transform, breakpoint)', () => {
		const types = new Set(Object.values(TEMPLATES).map((t) => t.action.type));
		expect(types.has('mock')).toBe(true);
		expect(types.has('delay')).toBe(true);
		expect(types.has('transform')).toBe(true);
		expect(types.has('breakpoint')).toBe(true);
	});

	test('cobre todos os templates obrigatórios listados no PRD US-011', () => {
		// Mock templates
		expect(TEMPLATES.mock_500).toBeDefined();
		expect(TEMPLATES.mock_500.action.type).toBe('mock');
		expect(TEMPLATES.mock_404).toBeDefined();
		expect(TEMPLATES.mock_404.action.type).toBe('mock');
		expect(TEMPLATES.mock_empty).toBeDefined();
		expect(TEMPLATES.mock_empty.action.type).toBe('mock');

		// Delay template
		expect(TEMPLATES.delay_3s).toBeDefined();
		expect(TEMPLATES.delay_3s.action.type).toBe('delay');

		// Transform templates
		expect(TEMPLATES.transform_cors_header).toBeDefined();
		expect(TEMPLATES.transform_cors_header.action.type).toBe('transform');
		expect(TEMPLATES.transform_remove_id).toBeDefined();
		expect(TEMPLATES.transform_remove_id.action.type).toBe('transform');

		// Breakpoint template
		expect(TEMPLATES.breakpoint_manual).toBeDefined();
		expect(TEMPLATES.breakpoint_manual.action.type).toBe('breakpoint');
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
		expect(draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
		});
	});

	test('mock_404 cria mock com status 404', () => {
		const draft = createTemplateRule('mock_404');
		expect(draft.action).toMatchObject({ type: 'mock', status: 404, statusPhrase: 'Not Found' });
	});

	test('mock_empty cria mock com body vazio', () => {
		const draft = createTemplateRule('mock_empty');
		expect(draft.action).toMatchObject({ type: 'mock', status: 200, body: '' });
	});
});

describe('ruleTemplates — Delay template', () => {
	test('delay_3s cria DelayAction com timeMs 3000', () => {
		const draft = createTemplateRule('delay_3s');
		expect(draft.action).toEqual({
			type: 'delay',
			enabled: true,
			timeMs: 3000,
		});
	});
});

describe('ruleTemplates — Transform templates', () => {
	test('transform_cors_header cria TransformAction com header CORS', () => {
		const draft = createTemplateRule('transform_cors_header');
		expect(draft.action.type).toBe('transform');
		if (draft.action.type !== 'transform') return;
		expect(draft.action.mode).toBe('declarative');
		expect(draft.action.addHeaders).toEqual({
			'access-control-allow-origin': '*',
		});
		expect(draft.action.operations).toEqual([]);
	});

	test('transform_remove_id cria TransformAction com operação remove em $.id', () => {
		const draft = createTemplateRule('transform_remove_id');
		expect(draft.action.type).toBe('transform');
		if (draft.action.type !== 'transform') return;
		expect(draft.action.mode).toBe('declarative');
		expect(draft.action.operations).toHaveLength(1);
		const op = draft.action.operations?.[0];
		expect(op?.type).toBe('remove');
		expect(op?.path).toBe('$.id');
	});
});

describe('ruleTemplates — Breakpoint template', () => {
	test('breakpoint_manual cria BreakpointAction com description útil', () => {
		const draft = createTemplateRule('breakpoint_manual');
		expect(draft.action.type).toBe('breakpoint');
		if (draft.action.type !== 'breakpoint') return;
		expect(draft.action.enabled).toBe(true);
		expect(draft.action.description).toBeDefined();
		expect((draft.action.description ?? '').length).toBeGreaterThan(0);
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
		if (draft1.action.type !== 'transform') return;
		draft1.action.operations?.push({ id: 'extra', type: 'add', path: '$.foo', value: '"bar"' });

		const draft2 = createTemplateRule('transform_remove_id');
		if (draft2.action.type !== 'transform') return;
		expect(draft2.action.operations).toHaveLength(1);
	});

	test('mutar headers do mock template não afeta o spec original', () => {
		const draft1 = createTemplateRule('mock_500');
		if (draft1.action.type !== 'mock') return;
		draft1.action.headers['x-test'] = 'mutado';

		const draft2 = createTemplateRule('mock_500');
		if (draft2.action.type !== 'mock') return;
		expect(draft2.action.headers['x-test']).toBeUndefined();
	});

	test('mutar addHeaders do template CORS não afeta o spec original', () => {
		const draft1 = createTemplateRule('transform_cors_header');
		if (draft1.action.type !== 'transform') return;
		draft1.action.addHeaders!['x-test'] = 'mutado';

		const draft2 = createTemplateRule('transform_cors_header');
		if (draft2.action.type !== 'transform') return;
		expect(draft2.action.addHeaders?.['x-test']).toBeUndefined();
	});
});
