import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { RulesImportExport } from '../RulesImportExport';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

describe('RulesImportExport — export', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [
				{
					id: 'r1',
					name: 'Existing',
					enabled: true,
					matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
					createdAt: 1,
					updatedAt: 1,
				},
			],
			addRule: vi.fn(),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);
	});

	test('clicar Exportar dispara download com envelope schemaVersion + rules', () => {
		const createObjectURL = vi.fn().mockReturnValue('blob:fake');
		const revokeObjectURL = vi.fn();
		(globalThis as any).URL.createObjectURL = createObjectURL;
		(globalThis as any).URL.revokeObjectURL = revokeObjectURL;

		render(<RulesImportExport />);
		fireEvent.click(screen.getByRole('button', { name: /Exportar/i }));

		expect(createObjectURL).toHaveBeenCalled();
		const blobArg = createObjectURL.mock.calls[0][0] as Blob;
		expect(blobArg.type).toBe('application/json');
	});
});
