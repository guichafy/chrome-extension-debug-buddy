import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DomainChipFilter } from '../DomainChipFilter';

const domains = [
	{ name: 'github.com', count: 3 },
	{ name: 'localhost', count: 2 },
];

describe('DomainChipFilter', () => {
	it('renderiza chip "Todos" como primeiro e ativo quando active=null', () => {
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={vi.fn()} />);
		const buttons = screen.getAllByRole('button');
		expect(buttons[0]).toHaveTextContent('Todos');
		expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('5')).toBeInTheDocument();
	});

	it('renderiza um chip por domínio com a contagem', () => {
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={vi.fn()} />);
		expect(screen.getByText('github.com')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('localhost')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('chip clicado emite onChange(domain)', () => {
		const onChange = vi.fn();
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={onChange} />);
		fireEvent.click(screen.getByRole('button', { name: /github\.com/ }));
		expect(onChange).toHaveBeenCalledWith('github.com');
	});

	it('chip "Todos" clicado emite onChange(null)', () => {
		const onChange = vi.fn();
		render(
			<DomainChipFilter domains={domains} total={5} active="github.com" onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
		expect(onChange).toHaveBeenCalledWith(null);
	});

	it('chip ativo recebe aria-pressed="true"', () => {
		render(<DomainChipFilter domains={domains} total={5} active="github.com" onChange={vi.fn()} />);
		expect(screen.getByRole('button', { name: /github\.com/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'false');
	});
});
