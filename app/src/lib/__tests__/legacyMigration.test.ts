import { describe, expect, test } from 'vitest';
import type { Rule } from '@/types/rules';
import {
	backfillEnabled,
	convertLegacyStorage,
	renameModifyToTransform,
} from '../legacyMigration';

const FIXED_NOW = 1700000000000;
let counter = 0;
const seqId = () => `id-${++counter}`;

describe('convertLegacyStorage', () => {
	test('returns existing rules unchanged when no legacy data', () => {
		const existing: Rule[] = [
			{
				id: 'r1',
				name: 'existing',
				enabled: true,
				stage: 'response',
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'foo', isRegex: false }],
				actions: [{ type: 'breakpoint' as const, enabled: true }],
				createdAt: 1,
				updatedAt: 1,
			},
		];
		const out = convertLegacyStorage({ rules: existing }, FIXED_NOW, seqId);
		expect(out.rules).toEqual(existing);
		expect(out.hadLegacyData).toBe(false);
	});

	test('converts string urlPatterns to breakpoint rules', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{ urlPatterns: ['api.example.com/users', '*.example.com/posts'] },
			FIXED_NOW,
			seqId,
		);
		expect(out.hadLegacyData).toBe(true);
		expect(out.rules).toHaveLength(2);
		expect(out.rules[0]).toMatchObject({
			id: 'id-1',
			name: 'api.example.com/users',
			enabled: true,
			stage: 'response',
			matchers: [{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false }],
			actions: [{ type: 'breakpoint', enabled: true }],
			createdAt: FIXED_NOW,
			updatedAt: FIXED_NOW,
		});
	});

	test('converts UrlPattern objects with method to rules with method matcher', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				urlPatterns: [{ url: 'api.example.com', method: 'POST', enabled: true, isRegex: false }],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0].matchers).toEqual([
			{ type: 'url', enabled: true, pattern: 'api.example.com', isRegex: false },
			{ type: 'method', enabled: true, method: 'POST' },
		]);
	});

	test('disabled UrlPattern preserves enabled=false on the rule', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{ urlPatterns: [{ url: 'foo', method: '', enabled: false }] },
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0].enabled).toBe(false);
	});

	test('converts MockConfig to mock action rules', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				mocks: [
					{
						urlPattern: 'api/users/1',
						method: 'GET',
						status: 404,
						headers: { 'Content-Type': 'application/json' },
						body: '{"error":"not found"}',
						createdAt: 999,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0]).toMatchObject({
			id: 'id-1',
			name: 'api/users/1',
			enabled: true,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api/users/1', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			actions: [
				{
					type: 'mock',
					enabled: true,
					status: 404,
					headers: { 'Content-Type': 'application/json' },
					body: '{"error":"not found"}',
					contentType: 'application/json',
				},
			],
			createdAt: 999,
			updatedAt: FIXED_NOW,
		});
	});

	test('mock without explicit Content-Type keeps contentType absent', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				mocks: [
					{
						urlPattern: 'foo',
						method: '',
						status: 200,
						headers: {},
						body: '',
						createdAt: 0,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect('contentType' in out.rules[0].actions[0]).toBe(false);
	});

	test('legacy mock without body keeps body absent instead of inventing an empty body', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				mocks: [
					{
						urlPattern: 'foo',
						method: 'HEAD',
						status: 200,
						headers: {},
						body: undefined as unknown as string,
						createdAt: 0,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect('body' in out.rules[0].actions[0]).toBe(false);
	});

	test('preserves existing rules and appends migrated ones', () => {
		counter = 0;
		const existing: Rule[] = [
			{
				id: 'existing-1',
				name: 'keep me',
				enabled: true,
				stage: 'response',
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'a', isRegex: false }],
				actions: [{ type: 'breakpoint' as const, enabled: true }],
				createdAt: 1,
				updatedAt: 1,
			},
		];
		const out = convertLegacyStorage(
			{ rules: existing, urlPatterns: ['legacy-1'] },
			FIXED_NOW,
			seqId,
		);
		expect(out.rules).toHaveLength(2);
		expect(out.rules[0]).toEqual(existing[0]);
		expect(out.rules[1].name).toBe('legacy-1');
	});

	test('skips entries without a usable pattern', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				urlPatterns: ['', { url: '', method: 'GET' }],
				mocks: [
					{
						urlPattern: '',
						method: 'GET',
						status: 200,
						headers: {},
						body: '',
						createdAt: 0,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules).toEqual([]);
		expect(out.hadLegacyData).toBe(true);
	});

	test('no schema v2, convertLegacyStorage preserva regras existentes sem renomear modify (no-op de ensureRuleShape)', () => {
		// O rename `modify` → `transform` foi feito há muito (Phase 1) e o
		// helper foi convertido em no-op. Regras antigas com `action.type=modify`
		// passam por aqui inalteradas — a UI/import legado v1 é quem orienta o
		// usuário a recriar regras incompatíveis.
		counter = 0;
		const legacyRule = {
			id: 'r-modify',
			name: 'old modify rule',
			enabled: true,
			stage: 'response',
			matchers: [{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false }],
			actions: [{ type: 'modify', enabled: true, status: 200 }],
			createdAt: 1,
			updatedAt: 1,
		} as unknown as Rule;
		const out = convertLegacyStorage({ rules: [legacyRule] }, FIXED_NOW, seqId);
		// Sem hadLegacyData porque não tem urlPatterns/mocks — apenas regras existentes.
		expect(out.hadLegacyData).toBe(false);
		// E o action type permanece "modify" (no-op), comprovando que esse rename
		// não é mais responsabilidade do convertLegacyStorage.
		expect(out.rules[0].actions[0].type).toBe('modify');
	});
});

describe('renameModifyToTransform', () => {
	test('schema v2: helper é no-op — retorna mesmas regras e renamed=0 mesmo com modify presente', () => {
		// No schema v2 o rename foi promovido a no-op: as regras `modify` legadas
		// só precisariam ser recriadas pelo usuário; o helper continua existindo
		// para preservar a assinatura pública (Phase 9 removerá).
		const rules = [
			{
				id: 'a',
				name: 'a',
				enabled: true,
				stage: 'response',
				matchers: [],
				actions: [{ type: 'modify', enabled: true }],
				createdAt: 0,
				updatedAt: 0,
			},
			{
				id: 'b',
				name: 'b',
				enabled: true,
				stage: 'response',
				matchers: [],
				actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = renameModifyToTransform(rules);
		expect(result.renamed).toBe(0);
		expect(result.rules).toBe(rules);
	});

	test('zero renames quando nao ha modify (idêntico ao caso v2 — mantém referência)', () => {
		const rules = [
			{
				id: 'a',
				name: 'a',
				enabled: true,
				stage: 'response',
				matchers: [],
				actions: [{ type: 'breakpoint', enabled: true }],
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = renameModifyToTransform(rules);
		expect(result.renamed).toBe(0);
		expect(result.rules).toEqual(rules);
	});
});

describe('backfillEnabled', () => {
	test('preenche enabled=true quando ausente', () => {
		const rules = [
			{
				id: 'a',
				name: 'sem enabled',
				matchers: [],
				action: { type: 'breakpoint', enabled: true },
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = backfillEnabled(rules);
		expect(result.backfilled).toBe(1);
		expect(result.rules[0].enabled).toBe(true);
	});

	test('preserva enabled existente (true ou false)', () => {
		const rules = [
			{
				id: 'a',
				name: 'já habilitada',
				enabled: true,
				stage: 'response',
				matchers: [],
				actions: [{ type: 'breakpoint', enabled: true }],
				createdAt: 0,
				updatedAt: 0,
			},
			{
				id: 'b',
				name: 'desabilitada',
				enabled: false,
				stage: 'response',
				matchers: [],
				actions: [{ type: 'breakpoint', enabled: true }],
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = backfillEnabled(rules);
		expect(result.backfilled).toBe(0);
		expect(result.rules[0].enabled).toBe(true);
		expect(result.rules[1].enabled).toBe(false);
	});

	test('mistura: faz backfill apenas em quem precisa', () => {
		const rules = [
			{
				id: 'a',
				name: 'sem enabled',
				matchers: [],
				action: { type: 'breakpoint', enabled: true },
				createdAt: 0,
				updatedAt: 0,
			},
			{
				id: 'b',
				name: 'desabilitada',
				enabled: false,
				matchers: [],
				action: { type: 'breakpoint', enabled: true },
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = backfillEnabled(rules);
		expect(result.backfilled).toBe(1);
		expect(result.rules[0].enabled).toBe(true);
		expect(result.rules[1].enabled).toBe(false);
	});
});
