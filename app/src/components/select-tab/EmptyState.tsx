import type React from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('selectTab');
	if (variant === 'loading') {
		return (
			<Wrapper>
				<div
					role="status"
					aria-label={t('empty.loading')}
					className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
				/>
			</Wrapper>
		);
	}

	if (variant === 'no-tabs') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">{t('empty.noTabs')}</p>
			</Wrapper>
		);
	}

	if (variant === 'no-results') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">
					<Trans
						t={t}
						i18nKey="empty.noResults"
						values={{ query }}
						components={{
							query: <span className="font-medium text-foreground" />,
						}}
					/>
				</p>
				<Button variant="ghost" size="sm" onClick={onClearSearch}>
					{t('empty.clearSearch')}
				</Button>
			</Wrapper>
		);
	}

	// variant === 'error'
	return (
		<Wrapper>
			<p className="text-sm font-medium text-destructive">{t('empty.loadError')}</p>
			<p className="text-xs text-muted-foreground">{error?.message ?? t('empty.unknownError')}</p>
			<Button variant="outline" size="sm" onClick={onRetry}>
				{t('empty.retry')}
			</Button>
		</Wrapper>
	);
};
