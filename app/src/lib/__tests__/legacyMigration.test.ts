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
		const existing = [
			{
				id: 'r1',
				name: 'existing',
				enabled: true,
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'foo', isRegex: false }],
				action: { type: 'breakpoint' as const, enabled: true },
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
			matchers: [{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false }],
			action: { type: 'breakpoint', enabled: true },
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
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api/users/1', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			action: {
				type: 'mock',
				enabled: true,
				status: 404,
				headers: { 'Content-Type': 'application/json' },
				body: '{"error":"not found"}',
				contentType: 'application/json',
			},
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
		expect('contentType' in out.rules[0].action).toBe(false);
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
		expect('body' in out.rules[0].action).toBe(false);
	});

	test('preserves existing rules and appends migrated ones', () => {
		counter = 0;
		const existing = [
			{
				id: 'existing-1',
				name: 'keep me',
				enabled: true,
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'a', isRegex: false }],
				action: { type: 'breakpoint' as const, enabled: true },
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

	test('renames legacy `modify` action type to `transform` em regras existentes', () => {
		counter = 0;
		const legacyRule = {
			id: 'r-modify',
			name: 'old modify rule',
			enabled: true,
			matchers: [{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false }],
			action: { type: 'modify', enabled: true, status: 200 },
			createdAt: 1,
			updatedAt: 1,
		} as unknown as Rule;
		const out = convertLegacyStorage({ rules: [legacyRule] }, FIXED_NOW, seqId);
		expect(out.rules[0].action.type).toBe('transform');
		expect(out.hadLegacyData).toBe(true);
	});
});

describe('renameModifyToTransform', () => {
	test('substitui type modify por transform e contabiliza renames', () => {
		const rules = [
			{
				id: 'a',
				name: 'a',
				enabled: true,
				matchers: [],
				action: { type: 'modify', enabled: true },
				createdAt: 0,
				updatedAt: 0,
			},
			{
				id: 'b',
				name: 'b',
				enabled: true,
				matchers: [],
				action: { type: 'mock', enabled: true, status: 200, headers: {} },
				createdAt: 0,
				updatedAt: 0,
			},
		] as unknown as Rule[];
		const result = renameModifyToTransform(rules);
		expect(result.renamed).toBe(1);
		expect(result.rules[0].action.type).toBe('transform');
		expect(result.rules[1].action.type).toBe('mock');
	});

	test('zero renames quando nao ha modify', () => {
		const rules = [
			{
				id: 'a',
				name: 'a',
				enabled: true,
				matchers: [],
				action: { type: 'breakpoint', enabled: true },
				createdAt: 0,
				updatedAt: 0,
			},
		] as Rule[];
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
		] as Rule[];
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
