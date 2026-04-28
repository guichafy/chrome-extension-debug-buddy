import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RulePresetCard } from '../RulePresetCard';

describe('RulePresetCard', () => {
	test('chama onCreate ao clicar', () => {
		const onCreate = vi.fn();
		render(<RulePresetCard presetId="latency_fixed" onCreate={onCreate} />);
		fireEvent.click(screen.getByRole('button', { name: /Criar a partir/i }));
		expect(onCreate).toHaveBeenCalled();
	});

	test('mostra descrição que inclui o status ou latência do preset', () => {
		render(<RulePresetCard presetId="http_error_500" onCreate={vi.fn()} />);
		const elements = screen.getAllByText(/500/);
		expect(elements.length).toBeGreaterThan(0);
	});
});
