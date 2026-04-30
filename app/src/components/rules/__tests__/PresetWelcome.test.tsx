import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { TEMPLATES, TEMPLATE_GROUPS } from '@/domain/ruleTemplates';
import { PresetWelcome } from '../PresetWelcome';

describe('PresetWelcome', () => {
	test('renderiza card "Começar do zero" e os 4 grupos com 10 templates', () => {
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={vi.fn()} />);

		expect(screen.getByTestId('preset-blank')).toBeInTheDocument();
		expect(screen.getByText('Começar do zero')).toBeInTheDocument();
		expect(screen.getByText('Usar template')).toBeInTheDocument();

		const totalTemplates = TEMPLATE_GROUPS.reduce((acc, g) => acc + g.templates.length, 0);
		expect(totalTemplates).toBeGreaterThanOrEqual(6);
		expect(totalTemplates).toBeLessThanOrEqual(10);

		for (const group of TEMPLATE_GROUPS) {
			expect(screen.getByTestId(`template-group-${group.id}`)).toBeInTheDocument();
			expect(screen.getByText(group.label)).toBeInTheDocument();
			for (const templateId of group.templates) {
				expect(screen.getByTestId(`preset-${templateId}`)).toBeInTheDocument();
				expect(screen.getByText(TEMPLATES[templateId].name)).toBeInTheDocument();
			}
		}
	});

	test('inclui pelo menos um template para cada um dos 4 tipos de regra', () => {
		const groupsByType = new Set(TEMPLATE_GROUPS.map((g) => g.id));
		expect(groupsByType.has('mock')).toBe(true);
		expect(groupsByType.has('delay')).toBe(true);
		expect(groupsByType.has('transform')).toBe(true);
		expect(groupsByType.has('breakpoint')).toBe(true);
	});

	test('cobre os templates obrigatórios listados no PRD US-011', () => {
		// IDs obrigatórios pela US-011 (cobertura mínima)
		expect(TEMPLATES.mock_500).toBeDefined();
		expect(TEMPLATES.mock_404).toBeDefined();
		expect(TEMPLATES.mock_empty).toBeDefined();
		expect(TEMPLATES.delay_3s).toBeDefined();
		expect(TEMPLATES.transform_cors_header).toBeDefined();
		expect(TEMPLATES.transform_remove_id).toBeDefined();
		expect(TEMPLATES.breakpoint_manual).toBeDefined();
	});

	test('clicar em "Começar do zero" chama onSelectBlank', () => {
		const onSelectBlank = vi.fn();
		render(<PresetWelcome onSelectBlank={onSelectBlank} onSelectPreset={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));
		expect(onSelectBlank).toHaveBeenCalledTimes(1);
	});

	test('clicar em template chama onSelectPreset com o templateId', () => {
		const onSelectPreset = vi.fn();
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={onSelectPreset} />);
		fireEvent.click(screen.getByTestId('preset-mock_500'));
		expect(onSelectPreset).toHaveBeenCalledWith('mock_500');
	});

	test('clicar em template de delay propaga o id correto', () => {
		const onSelectPreset = vi.fn();
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={onSelectPreset} />);
		fireEvent.click(screen.getByTestId('preset-delay_3s'));
		expect(onSelectPreset).toHaveBeenCalledWith('delay_3s');
	});

	test('clicar em template de transform propaga o id correto', () => {
		const onSelectPreset = vi.fn();
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={onSelectPreset} />);
		fireEvent.click(screen.getByTestId('preset-transform_cors_header'));
		expect(onSelectPreset).toHaveBeenCalledWith('transform_cors_header');
	});

	test('clicar em template de breakpoint propaga o id correto', () => {
		const onSelectPreset = vi.fn();
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={onSelectPreset} />);
		fireEvent.click(screen.getByTestId('preset-breakpoint_manual'));
		expect(onSelectPreset).toHaveBeenCalledWith('breakpoint_manual');
	});
});
