import { Trans, useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import type { RequestDelayAction } from '@/types/rules';

interface DelayActionEditorProps {
	action: RequestDelayAction;
	onChange: (action: RequestDelayAction) => void;
}

interface DelayPreset {
	label: string;
	timeMs: number;
}

const DELAY_PRESETS: readonly DelayPreset[] = [
	{ label: '500ms', timeMs: 500 },
	{ label: '1s', timeMs: 1000 },
	{ label: '3s', timeMs: 3000 },
	{ label: '5s', timeMs: 5000 },
	{ label: '10s', timeMs: 10000 },
];

const isNonNegativeIntegerString = (value: string): boolean => {
	if (value.trim().length === 0) return false;
	if (!/^\d+$/.test(value.trim())) return false;
	const parsed = Number.parseInt(value.trim(), 10);
	return Number.isInteger(parsed) && parsed >= 0;
};

export const DelayActionEditor: React.FC<DelayActionEditorProps> = ({ action, onChange }) => {
	const { t } = useTranslation('ruleEditor');
	const [inputValue, setInputValue] = useState<string>(String(action.timeMs));
	const [error, setError] = useState<string | null>(null);

	// Sincroniza o input quando o pai atualiza timeMs (ex.: ao clicar em preset).
	useEffect(() => {
		setInputValue(String(action.timeMs));
		setError(null);
	}, [action.timeMs]);

	const commit = (timeMs: number): void => {
		onChange({ ...action, timeMs });
	};

	const handleInputChange = (raw: string): void => {
		setInputValue(raw);
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			setError(t('delay.errors.empty'));
			return;
		}
		if (!/^\d+$/.test(trimmed)) {
			setError(t('delay.errors.notDigits'));
			return;
		}
		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isInteger(parsed) || parsed < 0) {
			setError(t('delay.errors.negative'));
			return;
		}
		setError(null);
		if (parsed !== action.timeMs) {
			commit(parsed);
		}
	};

	const applyPreset = (timeMs: number): void => {
		setInputValue(String(timeMs));
		setError(null);
		commit(timeMs);
	};

	const previewMs = isNonNegativeIntegerString(inputValue)
		? Number.parseInt(inputValue.trim(), 10)
		: action.timeMs;

	return (
		<div className="space-y-4" data-testid="delay-action-editor">
			<div>
				<Label htmlFor="delay-time-ms" className="font-medium">
					{t('delay.label')}
				</Label>
				<Input
					id="delay-time-ms"
					data-testid="delay-action-time-input"
					type="number"
					inputMode="numeric"
					min={0}
					step={100}
					value={inputValue}
					onChange={(e) => handleInputChange(e.target.value)}
					placeholder="1000"
					className={cn('w-full', error && 'border-destructive focus-visible:ring-destructive')}
					aria-invalid={error ? 'true' : 'false'}
					aria-describedby={error ? 'delay-time-ms-error' : 'delay-time-ms-help'}
				/>
				{error ? (
					<p
						id="delay-time-ms-error"
						data-testid="delay-action-error"
						className="mt-1 text-xs text-destructive"
					>
						{error}
					</p>
				) : (
					<p id="delay-time-ms-help" className="mt-1 text-xs text-muted-foreground">
						{t('delay.help')}
					</p>
				)}
			</div>

			<fieldset>
				<legend className="text-sm font-medium">{t('delay.presets')}</legend>
				<div className="mt-2 flex flex-wrap gap-2" data-testid="delay-action-presets">
					{DELAY_PRESETS.map((preset) => {
						const isSelected = action.timeMs === preset.timeMs;
						return (
							<Button
								key={preset.label}
								type="button"
								size="sm"
								variant={isSelected ? 'default' : 'outline'}
								onClick={() => applyPreset(preset.timeMs)}
								data-testid={`delay-action-preset-${preset.timeMs}`}
								data-selected={isSelected ? 'true' : 'false'}
								aria-pressed={isSelected}
							>
								{preset.label}
							</Button>
						);
					})}
				</div>
			</fieldset>

			<div
				className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30"
				data-testid="delay-action-info"
			>
				<h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
					<LucideIcon name="info" className="h-4 w-4" />
					{t('delay.infoTitle')}
				</h4>
				<p className="text-sm text-amber-800/90 dark:text-amber-200/80">
					<Trans
						t={t}
						i18nKey="delay.infoText"
						values={{ ms: previewMs }}
						components={{ strong: <strong /> }}
					/>
				</p>
			</div>
		</div>
	);
};

export default DelayActionEditor;
