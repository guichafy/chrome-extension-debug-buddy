import { Trans, useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LucideIcon } from '@/components/ui/lucide-icon';
import type { HeaderOps } from '@/types/rules';

interface HeaderOpsEditorProps {
	value: HeaderOps;
	onChange: (next: HeaderOps) => void;
	// Prefixo dos `data-testid` para diferenciar entre Request/Response modify
	// editors quando ambos coexistem na DOM (ex.: chain editor com duas rows).
	testIdPrefix: string;
}

interface HeaderRecordSectionProps {
	title: string;
	helper: string;
	value: Record<string, string> | undefined;
	onChange: (next: Record<string, string> | undefined) => void;
	testIdPrefix: string;
	mode: 'set' | 'add';
}

const HeaderRecordSection: React.FC<HeaderRecordSectionProps> = ({
	title,
	helper,
	value,
	onChange,
	testIdPrefix,
	mode,
}) => {
	const { t } = useTranslation('ruleEditor');
	const [name, setName] = useState('');
	const [val, setVal] = useState('');
	const entries = Object.entries(value ?? {});

	const commitEntries = (next: Array<[string, string]>) => {
		if (next.length === 0) {
			onChange(undefined);
			return;
		}
		const record: Record<string, string> = {};
		for (const [k, v] of next) record[k] = v;
		onChange(record);
	};

	const handleAdd = () => {
		const trimmedName = name.trim();
		const trimmedVal = val.trim();
		if (trimmedName.length === 0 || trimmedVal.length === 0) return;
		const next = entries.filter(([k]) => k.toLowerCase() !== trimmedName.toLowerCase());
		next.push([trimmedName, trimmedVal]);
		commitEntries(next);
		setName('');
		setVal('');
	};

	const handleRemove = (key: string) => {
		commitEntries(entries.filter(([k]) => k !== key));
	};

	return (
		<section className="rounded-md border bg-card p-3" data-testid={`${testIdPrefix}-${mode}`}>
			<header className="mb-2 flex items-center justify-between">
				<div>
					<h5 className="text-sm font-medium">{title}</h5>
					<p className="text-xs text-muted-foreground">{helper}</p>
				</div>
				<span
					className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
					data-testid={`${testIdPrefix}-${mode}-count`}
				>
					{entries.length}
				</span>
			</header>
			<div className="grid grid-cols-[1fr_1fr_auto] gap-2">
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder={t('headerOps.namePlaceholder')}
					data-testid={`${testIdPrefix}-${mode}-name`}
					aria-label={t('headerOps.nameAriaLabel', { mode })}
				/>
				<Input
					value={val}
					onChange={(e) => setVal(e.target.value)}
					placeholder={t('headerOps.valuePlaceholder')}
					data-testid={`${testIdPrefix}-${mode}-value`}
					aria-label={t('headerOps.valueAriaLabel', { mode })}
				/>
				<Button
					type="button"
					onClick={handleAdd}
					disabled={name.trim().length === 0 || val.trim().length === 0}
					data-testid={`${testIdPrefix}-${mode}-add`}
				>
					<LucideIcon name="plus" className="mr-1 h-3.5 w-3.5" />
					{t('headerOps.add')}
				</Button>
			</div>
			{entries.length > 0 && (
				<ul className="mt-2 space-y-1" data-testid={`${testIdPrefix}-${mode}-list`}>
					{entries.map(([k, v]) => (
						<li
							key={k}
							className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs"
							data-testid={`${testIdPrefix}-${mode}-row-${k}`}
						>
							<span className="break-all">
								<span className="font-medium">{k}</span>: {v}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => handleRemove(k)}
								className="h-6 w-6 p-0 text-destructive"
								aria-label={t('headerOps.removeHeader', { name: k })}
								data-testid={`${testIdPrefix}-${mode}-remove-${k}`}
							>
								<LucideIcon name="x" className="h-3.5 w-3.5" />
							</Button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

interface RemoveSectionProps {
	value: string[] | undefined;
	onChange: (next: string[] | undefined) => void;
	testIdPrefix: string;
}

const RemoveSection: React.FC<RemoveSectionProps> = ({ value, onChange, testIdPrefix }) => {
	const { t } = useTranslation('ruleEditor');
	const [name, setName] = useState('');
	const list = value ?? [];

	const commitList = (next: string[]) => {
		if (next.length === 0) {
			onChange(undefined);
			return;
		}
		onChange(next);
	};

	const handleAdd = () => {
		const trimmed = name.trim();
		if (trimmed.length === 0) return;
		if (list.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
			setName('');
			return;
		}
		commitList([...list, trimmed]);
		setName('');
	};

	const handleRemove = (target: string) => {
		commitList(list.filter((n) => n !== target));
	};

	return (
		<section className="rounded-md border bg-card p-3" data-testid={`${testIdPrefix}-remove`}>
			<header className="mb-2 flex items-center justify-between">
				<div>
					<h5 className="text-sm font-medium">{t('headerOps.removeTitle')}</h5>
					<p className="text-xs text-muted-foreground">
						<Trans t={t} i18nKey="headerOps.removeHelp" components={{ strong: <strong /> }} />
					</p>
				</div>
				<span
					className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
					data-testid={`${testIdPrefix}-remove-count`}
				>
					{list.length}
				</span>
			</header>
			<div className="grid grid-cols-[1fr_auto] gap-2">
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Authorization"
					data-testid={`${testIdPrefix}-remove-name`}
					aria-label={t('headerOps.removeNameAriaLabel')}
				/>
				<Button
					type="button"
					onClick={handleAdd}
					disabled={name.trim().length === 0}
					data-testid={`${testIdPrefix}-remove-add`}
				>
					<LucideIcon name="plus" className="mr-1 h-3.5 w-3.5" />
					{t('headerOps.add')}
				</Button>
			</div>
			{list.length > 0 && (
				<ul className="mt-2 flex flex-wrap gap-1" data-testid={`${testIdPrefix}-remove-list`}>
					{list.map((n) => (
						<li
							key={n}
							className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
							data-testid={`${testIdPrefix}-remove-row-${n}`}
						>
							<span className="font-mono">{n}</span>
							<button
								type="button"
								onClick={() => handleRemove(n)}
								aria-label={t('headerOps.undoRemove', { name: n })}
								data-testid={`${testIdPrefix}-remove-undo-${n}`}
								className="rounded p-0.5 hover:bg-destructive/20"
							>
								<LucideIcon name="x" className="h-3 w-3" />
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

export const HeaderOpsEditor: React.FC<HeaderOpsEditorProps> = ({
	value,
	onChange,
	testIdPrefix,
}) => {
	const { t } = useTranslation('ruleEditor');
	const updateSet = (next: Record<string, string> | undefined) => {
		onChange({ ...value, setHeaders: next });
	};
	const updateAdd = (next: Record<string, string> | undefined) => {
		onChange({ ...value, addHeaders: next });
	};
	const updateRemove = (next: string[] | undefined) => {
		onChange({ ...value, removeHeaders: next });
	};

	return (
		<div className="space-y-3" data-testid={`${testIdPrefix}-root`}>
			<RemoveSection
				value={value.removeHeaders}
				onChange={updateRemove}
				testIdPrefix={testIdPrefix}
			/>
			<HeaderRecordSection
				title={t('headerOps.setTitle')}
				helper={t('headerOps.setHelp')}
				value={value.setHeaders}
				onChange={updateSet}
				testIdPrefix={testIdPrefix}
				mode="set"
			/>
			<HeaderRecordSection
				title={t('headerOps.addTitle')}
				helper={t('headerOps.addHelp')}
				value={value.addHeaders}
				onChange={updateAdd}
				testIdPrefix={testIdPrefix}
				mode="add"
			/>
			<p className="text-xs text-muted-foreground">
				<Trans t={t} i18nKey="headerOps.order" components={{ strong: <strong /> }} />
			</p>
		</div>
	);
};

export default HeaderOpsEditor;
