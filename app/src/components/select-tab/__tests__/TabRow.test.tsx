import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabRow } from '../TabRow';
import type { Tab } from '../types';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const baseTab: Tab = {
	id: 1,
	title: 'Issues · guichafy/chrome-extension-debug-buddy',
	url: 'https://github.com/guichafy/chrome-extension-debug-buddy/issues',
	hostname: 'github.com',
	favIconUrl: 'https://github.com/favicon.ico',
	index: 0,
};

describe('TabRow', () => {
	it('renderiza título, URL e chip de domínio', () => {
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.getByText(/Issues · guichafy/)).toBeInTheDocument();
		expect(screen.getByText(baseTab.url)).toBeInTheDocument();
		expect(screen.getByText('github.com')).toBeInTheDocument();
	});

	it('renderiza badge "Atual" quando isCurrent=true', () => {
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={true} onSelect={vi.fn()} />);
		expect(screen.getByText('Atual')).toBeInTheDocument();
	});

	it('NÃO renderiza badge "Atual" quando isCurrent=false', () => {
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.queryByText('Atual')).not.toBeInTheDocument();
	});

	it('clique chama onSelect(tab)', () => {
		const onSelect = vi.fn();
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={onSelect} />);
		fireEvent.click(screen.getByRole('option'));
		expect(onSelect).toHaveBeenCalledWith(baseTab);
	});

	it('aplica role="option" e aria-selected segundo isFocused', () => {
		const { rerender } = render(
			<TabRow tab={baseTab} isFocused={true} isCurrent={false} onSelect={vi.fn()} />,
		);
		const row = screen.getByRole('option');
		expect(row).toHaveAttribute('aria-selected', 'true');
		expect(row).toHaveAttribute('id', 'tab-row-1');
		rerender(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
	});

	it('renderiza placeholder de favicon quando favIconUrl ausente', () => {
		const tabSemFavicon = { ...baseTab, favIconUrl: undefined };
		render(<TabRow tab={tabSemFavicon} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByTestId('favicon-placeholder')).toBeInTheDocument();
	});
});
