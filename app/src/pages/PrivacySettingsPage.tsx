import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePrivacyConfig } from '@/hooks/usePrivacyConfig';
import type { RedactionConfig } from '@/lib/session/types';

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
	const { config, loading, error, saving, save, purgeNow } = usePrivacyConfig();
	const [draft, setDraft] = useState<RedactionConfig | null>(null);
	const [saveMsg, setSaveMsg] = useState<string | null>(null);
	const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

	useEffect(() => {
		if (config) setDraft(config);
	}, [config]);

	if (loading) {
		return (
			<div className="p-4 text-muted-foreground text-sm">
				Carregando configuração de privacidade…
			</div>
		);
	}
	if (error) {
		return <div className="p-4 text-destructive text-sm">Erro ao carregar: {error}</div>;
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
		setSaveMsg(res.ok ? 'Configuração salva.' : `Erro: ${res.error ?? 'desconhecido'}`);
	};

	const onPurge = async () => {
		setPurgeMsg(null);
		const res = await purgeNow();
		setPurgeMsg(
			res.ok
				? `Removidas ${res.purgedCount ?? 0} sessões antigas.`
				: `Erro: ${res.error ?? 'desconhecido'}`,
		);
	};

	return (
		<div className="flex flex-col gap-6 p-4">
			<header>
				<h1 className="font-semibold text-xl">Privacidade & Redação</h1>
				<p className="text-muted-foreground text-sm">
					Controla o que é mascarado/removido das sessões antes de salvar. Mudanças aplicam-se a
					gravações futuras.
				</p>
			</header>

			<section className="flex flex-col gap-3 rounded border p-4">
				<div className="flex items-center justify-between">
					<Label htmlFor="enabled" className="font-medium">
						Redação habilitada
					</Label>
					<Switch
						id="enabled"
						checked={draft.enabled}
						onCheckedChange={(v) => update('enabled', v)}
					/>
				</div>
				<p className="text-muted-foreground text-xs">
					Quando desligada, headers/bodies/console/state são gravados sem filtro. Use só em
					localhost.
				</p>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">Network — Headers</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="headerKeys" className="text-xs">
						Chaves de header (uma por linha, case-insensitive)
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
						Header regex (uma por linha)
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
				<h2 className="font-medium text-sm">Network — Bodies</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bodyRegex" className="text-xs">
						Body regex (uma por linha — JWT, PAN, etc.)
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
				<h2 className="font-medium text-sm">Console</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="consoleEnabled">Mascarar console</Label>
					<Switch
						id="consoleEnabled"
						checked={draft.consoleEnabled}
						onCheckedChange={(v) => update('consoleEnabled', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="consoleRegex" className="text-xs">
						Console regex (uma por linha)
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
				<h2 className="font-medium text-sm">State (stores)</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="stateBlacklist" className="text-xs">
						Paths a remover (glob — ex: <code>auth.*.token</code>)
					</Label>
					<Textarea
						id="stateBlacklist"
						rows={3}
						value={listToText(draft.stateBlacklistPaths)}
						onChange={(e) => update('stateBlacklistPaths', textToList(e.target.value))}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="stateWhitelist" className="text-xs">
						Paths whitelist (se preenchido, apenas estes são mantidos)
					</Label>
					<Textarea
						id="stateWhitelist"
						rows={2}
						value={listToText(draft.stateWhitelistPaths)}
						onChange={(e) => update('stateWhitelistPaths', textToList(e.target.value))}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">rrweb (DOM/inputs)</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="maskAllInputs">Mascarar todos os inputs (não só password)</Label>
					<Switch
						id="maskAllInputs"
						checked={draft.rrwebMaskAllInputs}
						onCheckedChange={(v) => update('rrwebMaskAllInputs', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="maskTextSelector" className="text-xs">
						Seletor CSS para mascarar texto
					</Label>
					<Input
						id="maskTextSelector"
						value={draft.rrwebMaskTextSelector}
						onChange={(e) => update('rrwebMaskTextSelector', e.target.value)}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">URL gate (não gravar)</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="urlBlacklist" className="text-xs">
						Domínios bloqueados (glob — ex: <code>*.banco.com.br</code>)
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
				<h2 className="font-medium text-sm">Paths em stack traces</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="truncateUserPaths">
						Truncar caminhos de usuário (<code>/Users/foo/…</code> →{' '}
						<code>/Users/&lt;user&gt;/…</code>)
					</Label>
					<Switch
						id="truncateUserPaths"
						checked={draft.truncateUserPaths}
						onCheckedChange={(v) => update('truncateUserPaths', v)}
					/>
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded border p-4">
				<h2 className="font-medium text-sm">Retenção</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="autoPurgeEnabled">Purge automática habilitada</Label>
					<Switch
						id="autoPurgeEnabled"
						checked={draft.autoPurgeEnabled}
						onCheckedChange={(v) => update('autoPurgeEnabled', v)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="autoPurgeRetentionDays" className="text-xs">
						Reter sessões por (dias)
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
						Purgar agora
					</Button>
					{purgeMsg && <span className="text-muted-foreground text-xs">{purgeMsg}</span>}
				</div>
			</section>

			<div className="flex items-center gap-3">
				<Button onClick={() => void onSave()} disabled={saving}>
					{saving ? 'Salvando…' : 'Salvar'}
				</Button>
				{saveMsg && <span className="text-muted-foreground text-sm">{saveMsg}</span>}
			</div>
		</div>
	);
}
