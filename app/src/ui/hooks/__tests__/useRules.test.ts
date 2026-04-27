import { renderHook, waitFor } from '@testing-library/react';
import { createRuleFromLegacyUrlPattern, useRules } from '../useRules';
import { Rule } from '@/backend/types/rules';

const mockGet = jest.fn();
const mockSet = jest.fn();

beforeEach(() => {
	mockGet.mockReset();
	mockSet.mockReset();
	mockSet.mockResolvedValue(undefined);
	jest.spyOn(Date, 'now').mockReturnValue(123456);

	global.chrome = {
		...global.chrome,
		storage: {
			...global.chrome.storage,
			local: {
				...global.chrome.storage.local,
				get: mockGet,
				set: mockSet,
			},
		},
	} as any;
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('createRuleFromLegacyUrlPattern', () => {
	test('migra um padrão string para breakpoint sem criar mock falso', () => {
		const rule = createRuleFromLegacyUrlPattern('api.example.com', 1000, () => 'legacy-id');

		expect(rule).toMatchObject({
			id: 'legacy-id',
			name: 'Regra migrada: api.example.com',
			enabled: true,
			matchers: [
				{
					type: 'url',
					enabled: true,
					pattern: 'api.example.com',
					isRegex: false,
				},
			],
			action: {
				type: 'breakpoint',
				enabled: true,
			},
			createdAt: 1000,
			updatedAt: 1000,
		});
		expect(rule.action).not.toHaveProperty('status');
		expect(rule.action).not.toHaveProperty('body');
	});

	test('preserva matchers explícitos do formato legado', () => {
		const rule = createRuleFromLegacyUrlPattern(
			{
				url: '^https://api.example.com/users$',
				method: 'POST',
				headerName: 'x-debug',
				headerValue: 'true',
				headerType: 'request',
				enabled: false,
				isRegex: true,
			},
			1000,
			() => 'legacy-id',
		);

		expect(rule).toMatchObject({
			enabled: false,
			matchers: [
				{
					type: 'url',
					pattern: '^https://api.example.com/users$',
					isRegex: true,
				},
				{
					type: 'method',
					method: 'POST',
				},
				{
					type: 'header',
					name: 'x-debug',
					value: 'true',
					headerType: 'request',
				},
			],
			action: {
				type: 'breakpoint',
			},
		});
	});
});

describe('useRules', () => {
	test('migra padrões legados preservando regras existentes do storage', async () => {
		const existingRule: Rule = {
			id: 'existing-rule',
			name: 'Regra existente',
			enabled: true,
			matchers: [
				{
					type: 'url',
					enabled: true,
					pattern: 'already.example.com',
					isRegex: false,
				},
			],
			action: {
				type: 'breakpoint',
				enabled: true,
				description: 'Já existia',
			},
			createdAt: 1,
			updatedAt: 1,
		};

		mockGet.mockImplementation((keys: string[]) => {
			if (keys.includes('rules') && keys.includes('urlPatterns')) {
				return Promise.resolve({
					rules: [existingRule],
					urlPatterns: [{ url: 'api.example.com', method: 'GET', enabled: true }],
				});
			}

			if (keys.includes('rules')) {
				return Promise.resolve({ rules: [existingRule] });
			}

			if (keys.includes('urlPatterns')) {
				return Promise.resolve({
					urlPatterns: [{ url: 'api.example.com', method: 'GET', enabled: true }],
				});
			}

			return Promise.resolve({});
		});

		const { result } = renderHook(() => useRules());

		await waitFor(() => {
			expect(mockSet).toHaveBeenCalledWith({
				rules: expect.any(Array),
				urlPatterns: [],
			});
		});

		const migrationPayload = mockSet.mock.calls[0][0];
		expect(migrationPayload.rules).toHaveLength(2);
		expect(migrationPayload.rules[0]).toEqual(existingRule);
		expect(migrationPayload.rules[1]).toMatchObject({
			name: 'Regra migrada: api.example.com',
			matchers: [
				{
					type: 'url',
					pattern: 'api.example.com',
				},
				{
					type: 'method',
					method: 'GET',
				},
			],
			action: {
				type: 'breakpoint',
				enabled: true,
			},
			createdAt: 123456,
			updatedAt: 123456,
		});
		expect(migrationPayload.rules[1].action).not.toHaveProperty('body');
		expect(result.current.rules).toEqual(migrationPayload.rules);
	});
});
