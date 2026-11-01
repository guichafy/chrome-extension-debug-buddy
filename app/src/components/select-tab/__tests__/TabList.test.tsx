import { render, screen } from '@testing-library/react';
import React from 'react';
import { TabList } from '../TabList';
import type { Tab } from '../types';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const tabs: Tab[] = [
	{
		id: 10,
		title: 'A',
		url: 'https://a.example/',
		hostname: 'a.example',
		index: 0,
	},
	{
		id: 20,
		title: 'B',
		url: 'https://b.example/',
		hostname: 'b.example',
		index: 1,
	},
	{
		id: 30,
		title: 'C',
		url: 'https://c.example/',
		hostname: 'c.example',
		index: 2,
	},
];

describe('TabList', () => {
	it('renderiza role="listbox" com id e aria-label', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={null} onSelect={vi.fn()} />);
		const list = screen.getByRole('listbox');
		expect(list).toHaveAttribute('id', 'tab-listbox');
		expect(list).toHaveAttribute('aria-label', 'Abas disponíveis');
	});

	it('aplica aria-activedescendant para a linha focada', () => {
		render(<TabList tabs={tabs} focusedIndex={1} currentTabId={null} onSelect={vi.fn()} />);
		expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', 'tab-row-20');
	});

	it('renderiza um TabRow por aba', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={null} onSelect={vi.fn()} />);
		expect(screen.getAllByRole('option')).toHaveLength(3);
	});

	it('marca a linha cujo id bate com currentTabId como Atual', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={20} onSelect={vi.fn()} />);
		expect(screen.getByText('Atual')).toBeInTheDocument();
	});
});
