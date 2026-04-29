import React from 'react';
import { Button } from '../ui/button';

type Variant = 'loading' | 'no-tabs' | 'no-results' | 'error';

interface EmptyStateProps {
	variant: Variant;
	query?: string;
	error?: Error;
	onClearSearch?: () => void;
	onRetry?: () => void;
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
		{children}
	</div>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
	variant,
	query,
	error,
	onClearSearch,
	onRetry,
}) => {
	if (variant === 'loading') {
		return (
			<Wrapper>
				<div
					role="status"
					aria-label="Carregando abas"
					className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
				/>
			</Wrapper>
		);
	}

	if (variant === 'no-tabs') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">Nenhuma aba disponível para interceptação</p>
			</Wrapper>
		);
	}

	if (variant === 'no-results') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">
					Nenhuma aba corresponde a <span className="font-medium text-foreground">{query}</span>
				</p>
				<Button variant="ghost" size="sm" onClick={onClearSearch}>
					Limpar busca
				</Button>
			</Wrapper>
		);
	}

	// variant === 'error'
	return (
		<Wrapper>
			<p className="text-sm font-medium text-destructive">Erro ao carregar abas</p>
			<p className="text-xs text-muted-foreground">{error?.message ?? 'Erro desconhecido'}</p>
			<Button variant="outline" size="sm" onClick={onRetry}>
				Tentar novamente
			</Button>
		</Wrapper>
	);
};
