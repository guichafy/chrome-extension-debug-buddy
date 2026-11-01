import { Trans, useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { HeaderOps, ResponseModifyAction } from '@/types/rules';
import { HeaderOpsEditor } from './HeaderOpsEditor';

interface ResponseModifyActionEditorProps {
	action: ResponseModifyAction;
	onChange: (action: ResponseModifyAction) => void;
}

function pickHeaderOps(action: ResponseModifyAction): HeaderOps {
	return {
		setHeaders: action.setHeaders,
		addHeaders: action.addHeaders,
		removeHeaders: action.removeHeaders,
	};
}

export const ResponseModifyActionEditor: React.FC<ResponseModifyActionEditorProps> = ({
	action,
	onChange,
}) => {
	const { t } = useTranslation('ruleEditor');
	const [activeTab, setActiveTab] = useState('basic');
	const overrideStatus = action.status !== undefined;
	const overrideBody = action.body !== undefined;
	const [statusInput, setStatusInput] = useState<string>(
		action.status !== undefined ? String(action.status) : '',
	);
	const [statusError, setStatusError] = useState<string | null>(null);

	useEffect(() => {
		setStatusInput(action.status !== undefined ? String(action.status) : '');
		setStatusError(null);
	}, [action.status]);

	const handleStatusEnabled = (next: boolean) => {
		if (next) {
			onChange({ ...action, status: action.status ?? 200 });
		} else {
			const { status: _omitStatus, statusPhrase: _omitPhrase, ...rest } = action;
			onChange(rest);
		}
	};

	const handleStatusInputChange = (raw: string) => {
		setStatusInput(raw);
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			setStatusError(t('responseModify.statusErrors.empty'));
			return;
		}
		if (!/^\d+$/.test(trimmed)) {
			setStatusError(t('responseModify.statusErrors.notDigits'));
			return;
		}
		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
			setStatusError(t('responseModify.statusErrors.outOfRange'));
			return;
		}
		setStatusError(null);
		if (parsed !== action.status) {
			onChange({ ...action, status: parsed });
		}
	};

	const handleStatusPhraseChange = (value: string) => {
		const trimmed = value.trim();
		onChange({
			...action,
			statusPhrase: trimmed.length > 0 ? trimmed : undefined,
		});
	};

	const handleBodyEnabled = (next: boolean) => {
		if (next) {
			onChange({ ...action, body: action.body ?? '' });
		} else {
			const { body: _omit, ...rest } = action;
			onChange(rest);
		}
	};

	const handleBodyChange = (value: string) => {
		onChange({ ...action, body: value });
	};

	const handleHeaderOpsChange = (next: HeaderOps) => {
		onChange({
			...action,
			setHeaders: next.setHeaders,
			addHeaders: next.addHeaders,
			removeHeaders: next.removeHeaders,
		});
	};

	return (
		<div className="space-y-4" data-testid="response-modify-action-editor">
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full">
					<TabsTrigger value="basic" className="flex-1">
						{t('modifyTabs.status')}
					</TabsTrigger>
					<TabsTrigger value="headers" className="flex-1">
						{t('modifyTabs.headers')}
					</TabsTrigger>
					<TabsTrigger value="body" className="flex-1">
						{t('modifyTabs.body')}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="basic" className="space-y-4">
					<div className="rounded-md border bg-card p-3">
						<div className="mb-2 flex items-center gap-2">
							<Checkbox
								id="response-modify-status-enabled"
								checked={overrideStatus}
								onCheckedChange={(checked) => handleStatusEnabled(checked === true)}
								data-testid="response-modify-status-enabled"
							/>
							<Label htmlFor="response-modify-status-enabled" className="font-medium">
								{t('responseModify.overrideStatus')}
							</Label>
						</div>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div>
								<Label
									htmlFor="response-modify-status-input"
									className="text-xs text-muted-foreground"
								>
									{t('responseModify.statusLabel')}
								</Label>
								<Input
									id="response-modify-status-input"
									type="number"
									inputMode="numeric"
									min={100}
									max={599}
									value={statusInput}
									onChange={(e) => handleStatusInputChange(e.target.value)}
									placeholder="200"
									disabled={!overrideStatus}
									className={cn(statusError && 'border-destructive focus-visible:ring-destructive')}
									data-testid="response-modify-status-input"
									aria-invalid={statusError ? 'true' : 'false'}
								/>
								{statusError && overrideStatus && (
									<p
										className="mt-1 text-xs text-destructive"
										data-testid="response-modify-status-error"
									>
										{statusError}
									</p>
								)}
							</div>
							<div>
								<Label
									htmlFor="response-modify-status-phrase"
									className="text-xs text-muted-foreground"
								>
									{t('responseModify.statusTextLabel')}
								</Label>
								<Input
									id="response-modify-status-phrase"
									value={action.statusPhrase ?? ''}
									onChange={(e) => handleStatusPhraseChange(e.target.value)}
									placeholder="OK"
									disabled={!overrideStatus}
									data-testid="response-modify-status-phrase"
								/>
							</div>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="headers" className="space-y-3">
					<HeaderOpsEditor
						value={pickHeaderOps(action)}
						onChange={handleHeaderOpsChange}
						testIdPrefix="response-modify-headers"
					/>
				</TabsContent>

				<TabsContent value="body" className="space-y-3">
					<div className="flex items-center gap-2">
						<Checkbox
							id="response-modify-body-enabled"
							checked={overrideBody}
							onCheckedChange={(checked) => handleBodyEnabled(checked === true)}
							data-testid="response-modify-body-enabled"
						/>
						<Label htmlFor="response-modify-body-enabled" className="font-medium">
							{t('responseModify.replaceBody')}
						</Label>
					</div>
					<Textarea
						value={action.body ?? ''}
						onChange={(e) => handleBodyChange(e.target.value)}
						placeholder='{"data": [...]}'
						className="h-48 font-mono text-sm"
						disabled={!overrideBody}
						data-testid="response-modify-body-textarea"
					/>
					<p className="text-xs text-muted-foreground">
						<Trans t={t} i18nKey="responseModify.bodyHelp" components={{ strong: <strong /> }} />
					</p>
				</TabsContent>
			</Tabs>

			<div
				className="rounded-md border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/40 dark:bg-purple-950/30"
				data-testid="response-modify-action-info"
			>
				<h4 className="mb-1 flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-200">
					<LucideIcon name="info" className="h-4 w-4" />
					{t('responseModify.infoTitle')}
				</h4>
				<p className="text-xs text-purple-800/90 dark:text-purple-200/80">
					<Trans t={t} i18nKey="responseModify.infoText" components={{ strong: <strong /> }} />
				</p>
			</div>
		</div>
	);
};

export default ResponseModifyActionEditor;
