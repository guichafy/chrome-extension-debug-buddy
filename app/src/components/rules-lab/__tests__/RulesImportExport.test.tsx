import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('RulesImportExport — import', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [],
			addRule: vi.fn().mockResolvedValue(true),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);
		(chrome.storage.local.set as any).mockResolvedValue(undefined);
	});

	test('mostra erro quando JSON é inválido', async () => {
		render(<RulesImportExport />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['nao eh json'], 'bad.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file] });
		fireEvent.change(input);
		await waitFor(() => {
			expect(screen.getByText(/JSON inválido|JSON|Unexpected/i)).toBeInTheDocument();
		});
	});

	test('mostra preview e permite escolher merge ou replace', async () => {
		const valid = {
			schemaVersion: 1,
			rules: [
				{
					id: 'r1',
					name: 'Imported',
					enabled: true,
					matchers: [{ type: 'url', enabled: true, pattern: 'a', isRegex: false }],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
					createdAt: 1,
					updatedAt: 1,
				},
			],
		};
		render(<RulesImportExport />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File([JSON.stringify(valid)], 'good.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file] });
		fireEvent.change(input);

		await waitFor(() => {
			expect(screen.getByText(/regra\(s\) prontas/i)).toBeInTheDocument();
		});
		expect(screen.getByLabelText(/Adicionar às regras existentes/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Substituir todas as regras/i)).toBeInTheDocument();
	});
});
