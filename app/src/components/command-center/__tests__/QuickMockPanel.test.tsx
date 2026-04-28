import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { QuickMockPanel } from '../QuickMockPanel';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

const baseRequest = {
	url: 'https://api.example.com/users?page=1',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	response: { headers: { 'content-type': 'application/json' }, body: '{"ok":true}' },
	request: { headers: { authorization: 'Bearer secret', accept: 'application/json' } },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"ok":true}',
};

describe('QuickMockPanel', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [],
			addRule: vi.fn().mockResolvedValue(true),
		} as any);
	});

	test('preview mostra pattern host+pathname (sem query)', () => {
		render(
			<QuickMockPanel open onOpenChange={vi.fn()} request={baseRequest as any} requestId="r1" />,
		);
		expect(screen.getByText('api.example.com/users')).toBeInTheDocument();
		expect(screen.queryByText(/page=1/)).toBeNull();
	});

	test('clica salvar chama addRule com matchers default', async () => {
		const addRule = vi.fn().mockResolvedValue(true);
		vi.mocked(useRules).mockReturnValue({ rules: [], addRule } as any);
		render(
			<QuickMockPanel open onOpenChange={vi.fn()} request={baseRequest as any} requestId="r1" />,
		);

		fireEvent.click(screen.getByRole('button', { name: /Salvar mock/i }));

		await waitFor(() => expect(addRule).toHaveBeenCalledTimes(1));
		const [name, matchers, action] = addRule.mock.calls[0];
		expect(name).toBe('Mock para api.example.com/users');
		expect(matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'url', pattern: 'api.example.com/users' }),
				expect.objectContaining({ type: 'method', method: 'GET' }),
			]),
		);
		expect(action.type).toBe('mock');
	});
});
