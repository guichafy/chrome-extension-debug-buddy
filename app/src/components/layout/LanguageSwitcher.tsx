import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { isSupportedLanguage, LANGUAGE_NATIVE_NAMES, SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { selectUiLanguage } from '@/i18n/ui';

// Seletor de idioma da UI. A escolha é persistida em chrome.storage.local e
// aplicada em todas as páginas abertas da extensão (aba + side panel).
export function LanguageSwitcher() {
	const { t, i18n } = useTranslation('layout');
	const [saveError, setSaveError] = useState<string | null>(null);

	const handleChange = (value: string) => {
		if (!isSupportedLanguage(value)) {
			throw new Error(`LanguageSwitcher: idioma não suportado ${JSON.stringify(value)}`);
		}
		setSaveError(null);
		selectUiLanguage(value).catch((err: unknown) => {
			setSaveError(err instanceof Error ? err.message : String(err));
		});
	};

	return (
		<div className="flex flex-col gap-1">
			<Select value={i18n.language} onValueChange={handleChange}>
				<SelectTrigger aria-label={t('language.label')} className="h-8 gap-2 text-xs">
					<LucideIcon name="languages" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{SUPPORTED_LANGUAGES.map((code) => (
						<SelectItem key={code} value={code} lang={code}>
							{LANGUAGE_NATIVE_NAMES[code]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{saveError && (
				<p role="alert" className="text-destructive text-xs">
					{t('language.saveError', { message: saveError })}
				</p>
			)}
		</div>
	);
}
