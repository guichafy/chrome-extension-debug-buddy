import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
	it('variant="loading" renderiza spinner com role="status"', () => {
		render(<EmptyState variant="loading" />);
		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	it('variant="no-tabs" mostra mensagem padrão', () => {
		render(<EmptyState variant="no-tabs" />);
		expect(screen.getByText('Nenhuma aba disponível para análise')).toBeInTheDocument();
	});

	it('variant="no-results" mostra a query e botão "Limpar busca"', () => {
		const onClearSearch = vi.fn();
		render(<EmptyState variant="no-results" query="github" onClearSearch={onClearSearch} />);
		expect(screen.getByText(/Nenhuma aba corresponde a/)).toBeInTheDocument();
		expect(screen.getByText('github')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Limpar busca/ }));
		expect(onClearSearch).toHaveBeenCalled();
	});

	it('variant="error" mostra error.message e botão "Tentar novamente"', () => {
		const onRetry = vi.fn();
		render(<EmptyState variant="error" error={new Error('Tab access denied')} onRetry={onRetry} />);
		expect(screen.getByText('Tab access denied')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
		expect(onRetry).toHaveBeenCalled();
	});

	it('variant="error" exibe "Erro desconhecido" quando error não é fornecido', () => {
		render(<EmptyState variant="error" onRetry={vi.fn()} />);
		expect(screen.getByText('Erro desconhecido')).toBeInTheDocument();
	});
});
