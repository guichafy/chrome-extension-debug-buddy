import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
	open: boolean;
	importedOrigin: string;
	currentOrigin: string;
	onContinue: () => void;
	onCancel: () => void;
}

export function ImportOriginWarningDialog({
	open,
	importedOrigin,
	currentOrigin,
	onContinue,
	onCancel,
}: Props) {
	const { t } = useTranslation(['sessions', 'common']);
	return (
		<Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('originWarning.title')}</DialogTitle>
					<DialogDescription>
						<Trans
							t={t}
							i18nKey="originWarning.description"
							values={{ importedOrigin, currentOrigin }}
							components={{ strong: <strong /> }}
						/>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						{t('common:actions.cancel')}
					</Button>
					<Button onClick={onContinue}>{t('originWarning.continue')}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
