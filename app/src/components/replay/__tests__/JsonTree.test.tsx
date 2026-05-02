import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonTree } from '../JsonTree';

describe('JsonTree', () => {
	it('renderiza primitivos com label', () => {
		const { rerender } = render(<JsonTree name="count" value={42} />);
		expect(screen.getByText('count:')).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();

		rerender(<JsonTree name="title" value="hello" />);
		expect(screen.getByText('title:')).toBeInTheDocument();
		expect(screen.getByText('"hello"')).toBeInTheDocument();

		rerender(<JsonTree name="ok" value={true} />);
		expect(screen.getByText('ok:')).toBeInTheDocument();
		expect(screen.getByText('true')).toBeInTheDocument();
	});

	it('renderiza null', () => {
		render(<JsonTree name="empty" value={null} />);
		expect(screen.getByText('empty:')).toBeInTheDocument();
		expect(screen.getByText('null')).toBeInTheDocument();
	});

	it('expande objeto até depth 2 por padrão e colapsa via clique', () => {
		render(<JsonTree value={{ a: { b: 1 } }} />);
		expect(screen.getAllByText(/Object\(1\)/).length).toBeGreaterThan(0);
		expect(screen.getByText('a:')).toBeInTheDocument();
		expect(screen.getByText('b:')).toBeInTheDocument();
		// Colapsar root
		const toggles = screen.getAllByRole('button');
		fireEvent.click(toggles[0]);
		expect(screen.queryByText('a:')).not.toBeInTheDocument();
	});

	it('renderiza arrays com tamanho', () => {
		render(<JsonTree value={[1, 2, 3]} />);
		expect(screen.getByText(/Array\(3\)/)).toBeInTheDocument();
		expect(screen.getByText('0:')).toBeInTheDocument();
		expect(screen.getByText('1:')).toBeInTheDocument();
		expect(screen.getByText('2:')).toBeInTheDocument();
	});
});
