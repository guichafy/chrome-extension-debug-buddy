import React from 'react';
import { render, screen } from '@testing-library/react';
import { LucideIcon } from '../lucide-icon';

describe('LucideIcon', () => {
	it('renderiza um SVG (não texto) para um ícone conhecido', () => {
		render(<LucideIcon name="play" data-testid="icon-play" />);
		const el = screen.getByTestId('icon-play');
		expect(el.tagName.toLowerCase()).toBe('svg');
	});

	it('aceita className adicional', () => {
		render(<LucideIcon name="play" className="text-red-500" data-testid="icon-play" />);
		expect(screen.getByTestId('icon-play')).toHaveClass('text-red-500');
	});

	it('lança erro se o name não estiver mapeado', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => render(<LucideIcon name={'inexistente' as any} data-testid="icon-x" />)).toThrow(
			/LucideIcon: ícone "inexistente" não está registrado/,
		);
		spy.mockRestore();
	});
});
