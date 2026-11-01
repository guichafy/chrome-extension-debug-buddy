import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { RedactionConfig } from '@/lib/session/types';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function ExportConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
	const { t } = useTranslation(['sessions', 'common']);
	const [config, setConfig] = useState<RedactionConfig | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		// Reset entre aberturas pra refletir mudanças que o usuário fez em
		// Configurações > Privacidade entre dois exports.
		setConfig(null);
		setLoadError(null);
		let cancelled = false;
		void (async () => {
			try {
				const res = await chrome.runtime.sendMessage({
					action: 'getPrivacyConfig',
				});
				if (cancelled) return;
				if (!res?.ok || !res.privacyConfig) {
					setLoadError(res?.error ?? t('exportDialog.loadErrorFallback'));
					return;
				}
				setConfig(res.privacyConfig as RedactionConfig);
			} catch (err) {
				if (!cancelled) setLoadError(String(err));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, t]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('exportDialog.title')}</DialogTitle>
					<DialogDescription className="text-sm">
						<Trans
							t={t}
							i18nKey="exportDialog.description"
							components={{ strong: <strong />, code: <code /> }}
						/>
					</DialogDescription>
				</DialogHeader>

				<section className="rounded border bg-muted/30 p-3 text-xs">
					<p className="mb-2 font-medium">{t('exportDialog.maskingHeading')}</p>
					{loadError && (
						<p className="text-destructive">{t('exportDialog.loadError', { error: loadError })}</p>
					)}
					{!config && !loadError && (
						<p className="text-muted-foreground">{t('exportDialog.loading')}</p>
					)}
					{config && !config.enabled && (
						<p className="text-amber-600 dark:text-amber-400">
							<Trans
								t={t}
								i18nKey="exportDialog.maskingDisabled"
								components={{ strong: <strong /> }}
							/>
						</p>
					)}
					{config && config.enabled && (
						<ul className="list-disc space-y-0.5 pl-5">
							<li>
								<Trans
									t={t}
									i18nKey="exportDialog.headers"
									values={{
										keys: config.headerKeys.length,
										regex: config.headerRegex.length,
									}}
									components={{ strong: <strong /> }}
								/>
							</li>
							<li>
								<Trans
									t={t}
									i18nKey="exportDialog.body"
									values={{ total: config.bodyRegex.length }}
									components={{ strong: <strong /> }}
								/>
							</li>
							<li>
								<Trans
									t={t}
									i18nKey="exportDialog.console"
									values={{
										state: config.consoleEnabled
											? t('exportDialog.consoleRedacting', {
													total: config.consoleRegex.length,
												})
											: t('exportDialog.consoleDisabled'),
									}}
									components={{ strong: <strong /> }}
								/>
							</li>
							<li>
								<Trans
									t={t}
									i18nKey="exportDialog.rrweb"
									values={{
										state: config.rrwebMaskAllInputs
											? t('exportDialog.rrwebAllInputs')
											: t('exportDialog.rrwebSensitiveOnly'),
									}}
									components={{ strong: <strong /> }}
								/>
							</li>
							<li>
								<Trans
									t={t}
									i18nKey="exportDialog.truncatePaths"
									values={{
										state: config.truncateUserPaths ? t('exportDialog.yes') : t('exportDialog.no'),
									}}
									components={{ strong: <strong /> }}
								/>
							</li>
						</ul>
					)}
					<p className="mt-2 text-muted-foreground">
						<Trans t={t} i18nKey="exportDialog.editHint" components={{ strong: <strong /> }} />
					</p>
				</section>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t('common:actions.cancel')}
					</Button>
					<Button
						variant="destructive"
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
					>
						{t('exportDialog.confirm')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
