import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePrivacyConfig } from '@/hooks/usePrivacyConfig';
import type { RedactionConfig } from '@/lib/session/types';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

function listToText(list: string[]): string {
	return list.join('\n');
}

function textToList(text: string): string[] {
	return text
		.split('\n')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export function PrivacySettingsPage() {
	const { t } = useTranslation(['privacy', 'common']);
	const { config, loading, error, saving, save, purgeNow } = usePrivacyConfig();
	const [draft, setDraft] = useState<RedactionConfig | null>(null);
	const [saveMsg, setSaveMsg] = useState<string | null>(null);
	const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

	useEffect(() => {
		if (config) setDraft(config);
	}, [config]);

	if (loading) {
		return <div className="p-4 text-muted-foreground text-sm">{t('loading')}</div>;
	}
	if (error) {
		return <div className="p-4 text-destructive text-sm">{t('loadError', { error })}</div>;
	}
	if (!draft) {
		return null;
	}

	const update = <K extends keyof RedactionConfig>(key: K, value: RedactionConfig[K]) => {
		setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
	};

	const onSave = async () => {
		setSaveMsg(null);
		const res = await save(draft);
		setSaveMsg(res.ok ? t('saved') : t('error', { error: res.error ?? t('unknownError') }));
	};

	const onPurge = async () => {
		setPurgeMsg(null);
		const res = await purgeNow();
		setPurgeMsg(
			res.ok
				? t('purged', { count: res.purgedCount ?? 0 })
				: t('error', { error: res.error ?? t('unknownError') }),
		);
	};

	return (
		<div className="flex flex-col gap-6 p-4">
			<header>
				<h1 className="font-semibold text-xl">{t('title')}</h1>
				<p className="text-muted-foreground text-sm">{t('description')}</p>
			</header>

			<section className="flex flex-col gap-3 rounded border p-4">
				<div className="flex items-center justify-between">
					<Label htmlFor="enabled" className="font-medium">
						{t('enabled.label')}
					</Label>
					<Switch
						id="enabled"
						checked={draft.enabled}
						onCheckedChange={(v) => update('enabled', v)}
					/>
				</div>
				<p className="text-muted-foreground text-xs">{t('enabled.hint')}</p>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('headers.title')}</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="headerKeys" className="text-xs">
						{t('headers.keys')}
					</Label>
					<Textarea
						id="headerKeys"
						rows={4}
						value={listToText(draft.headerKeys)}
						onChange={(e) => update('headerKeys', textToList(e.target.value))}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="headerRegex" className="text-xs">
						{t('headers.regex')}
					</Label>
					<Textarea
						id="headerRegex"
						rows={3}
						value={listToText(draft.headerRegex)}
						onChange={(e) => update('headerRegex', textToList(e.target.value))}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('bodies.title')}</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bodyRegex" className="text-xs">
						{t('bodies.regex')}
					</Label>
					<Textarea
						id="bodyRegex"
						rows={4}
						value={listToText(draft.bodyRegex)}
						onChange={(e) => update('bodyRegex', textToList(e.target.value))}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('console.title')}</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="consoleEnabled">{t('console.mask')}</Label>
					<Switch
						id="consoleEnabled"
						checked={draft.consoleEnabled}
						onCheckedChange={(v) => update('consoleEnabled', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="consoleRegex" className="text-xs">
						{t('console.regex')}
					</Label>
					<Textarea
						id="consoleRegex"
						rows={3}
						value={listToText(draft.consoleRegex)}
						onChange={(e) => update('consoleRegex', textToList(e.target.value))}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('rrweb.title')}</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="maskAllInputs">{t('rrweb.maskAllInputs')}</Label>
					<Switch
						id="maskAllInputs"
						checked={draft.rrwebMaskAllInputs}
						onCheckedChange={(v) => update('rrwebMaskAllInputs', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="maskTextSelector" className="text-xs">
						{t('rrweb.maskTextSelector')}
					</Label>
					<Input
						id="maskTextSelector"
						value={draft.rrwebMaskTextSelector}
						onChange={(e) => update('rrwebMaskTextSelector', e.target.value)}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('urlGate.title')}</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="urlBlacklist" className="text-xs">
						<Trans t={t} i18nKey="urlGate.blacklist" components={{ code: <code /> }} />
					</Label>
					<Textarea
						id="urlBlacklist"
						rows={3}
						value={listToText(draft.urlBlacklist)}
						onChange={(e) => update('urlBlacklist', textToList(e.target.value))}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('stackPaths.title')}</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="truncateUserPaths">
						<Trans
							t={t}
							i18nKey="stackPaths.truncate"
							components={{ code: <code /> }}
							shouldUnescape
						/>
					</Label>
					<Switch
						id="truncateUserPaths"
						checked={draft.truncateUserPaths}
						onCheckedChange={(v) => update('truncateUserPaths', v)}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">{t('retention.title')}</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="autoPurgeEnabled">{t('retention.autoPurge')}</Label>
					<Switch
						id="autoPurgeEnabled"
						checked={draft.autoPurgeEnabled}
						onCheckedChange={(v) => update('autoPurgeEnabled', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="autoPurgeRetentionDays" className="text-xs">
						{t('retention.days')}
					</Label>
					<Input
						id="autoPurgeRetentionDays"
						type="number"
						min={1}
						value={draft.autoPurgeRetentionDays}
						onChange={(e) => update('autoPurgeRetentionDays', Number(e.target.value))}
					/>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="outline" size="sm" onClick={() => void onPurge()}>
						{t('retention.purgeNow')}
					</Button>
					{purgeMsg && <span className="text-muted-foreground text-xs">{purgeMsg}</span>}
				</div>
			</section>

			<div className="flex items-center gap-3">
				<Button onClick={() => void onSave()} disabled={saving}>
					{saving ? t('saving') : t('common:actions.save')}
				</Button>
				{saveMsg && <span className="text-muted-foreground text-sm">{saveMsg}</span>}
			</div>
		</div>
	);
}
