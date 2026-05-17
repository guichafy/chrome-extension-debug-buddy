import { describe, expect, test } from 'vitest';
import { findOrphanedRuleIds } from '../ruleLifecycle';
import type { Rule } from '@/types/rules';

function rule(overrides: Partial<Rule>): Rule {
	return {
		id: overrides.id ?? 'r1',
		name: overrides.name ?? 'r1',
		enabled: overrides.enabled ?? true,
		stage: overrides.stage ?? 'response',
		matchers: overrides.matchers ?? [{ type: 'url', enabled: true, pattern: '/x', isRegex: false }],
		actions: overrides.actions ?? [{ type: 'breakpoint', enabled: true }],
		createdAt: 0,
		updatedAt: 0,
	};
}

describe('findOrphanedRuleIds', () => {
	test('detecta rule removida do array como órfã', () => {
		const prev = [rule({ id: 'a' }), rule({ id: 'b' })];
		const next = [rule({ id: 'a' })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set(['b']));
	});

	test('detecta rule que mudou de enabled=true para enabled=false', () => {
		const prev = [rule({ id: 'a', enabled: true })];
		const next = [rule({ id: 'a', enabled: false })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set(['a']));
	});

	test('rule já desabilitada que continua desabilitada NÃO é órfã (não houve transição)', () => {
		const prev = [rule({ id: 'a', enabled: false })];
		const next = [rule({ id: 'a', enabled: false })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set());
	});

	test('rule enabled=false → enabled=true NÃO é órfã (reativação)', () => {
		const prev = [rule({ id: 'a', enabled: false })];
		const next = [rule({ id: 'a', enabled: true })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set());
	});

	test('rule recém-adicionada NÃO é órfã (não estava em prev)', () => {
		const prev: Rule[] = [];
		const next = [rule({ id: 'new' })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set());
	});

	test('combina remoção e desabilitação no mesmo diff', () => {
		const prev = [
			rule({ id: 'kept', enabled: true }),
			rule({ id: 'removed', enabled: true }),
			rule({ id: 'disabled', enabled: true }),
		];
		const next = [rule({ id: 'kept', enabled: true }), rule({ id: 'disabled', enabled: false })];
		expect(findOrphanedRuleIds(prev, next)).toEqual(new Set(['removed', 'disabled']));
	});

	test('arrays vazios não geram órfãos', () => {
		expect(findOrphanedRuleIds([], [])).toEqual(new Set());
	});

	test('todas as rules removidas marca todas como órfãs', () => {
		const prev = [rule({ id: 'a' }), rule({ id: 'b' }), rule({ id: 'c' })];
		expect(findOrphanedRuleIds(prev, [])).toEqual(new Set(['a', 'b', 'c']));
	});
});
