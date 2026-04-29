import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PRESET_GROUPS } from '@/components/rules-lab/rulePresetGroups';
import { PRESETS } from '@/domain/rulePresets';
import { PresetWelcome } from '../PresetWelcome';

describe('PresetWelcome', () => {
	test('renderiza card "Em branco" e os 3 grupos com 8 presets', () => {
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={vi.fn()} />);
		expect(screen.getByTestId('preset-blank')).toBeInTheDocument();
		for (const group of PRESET_GROUPS) {
			expect(screen.getByText(group.label)).toBeInTheDocument();
			for (const presetId of group.presets) {
				expect(screen.getByTestId(`preset-${presetId}`)).toBeInTheDocument();
				expect(screen.getByText(PRESETS[presetId].name)).toBeInTheDocument();
			}
		}
	});

	test('clicar em "Em branco" chama onSelectBlank', () => {
		const onSelectBlank = vi.fn();
		render(<PresetWelcome onSelectBlank={onSelectBlank} onSelectPreset={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));
		expect(onSelectBlank).toHaveBeenCalledTimes(1);
	});

	test('clicar em preset chama onSelectPreset com presetId', () => {
		const onSelectPreset = vi.fn();
		render(<PresetWelcome onSelectBlank={vi.fn()} onSelectPreset={onSelectPreset} />);
		fireEvent.click(screen.getByTestId('preset-http_error_500'));
		expect(onSelectPreset).toHaveBeenCalledWith('http_error_500');
	});
});
