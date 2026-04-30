import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import RuleEditor from '@/components/rules/RuleEditor';
import { RulesEmptyState } from '@/components/rules-lab/RulesEmptyState';
import { RulesImportDialog, type ImportStrategy } from '@/components/rules-lab/RulesImportDialog';
import { RulesList } from '@/components/rules-lab/RulesList';
import { RulesPageHeader } from '@/components/rules-lab/RulesPageHeader';
import {
	type RulesActionFilter,
	type RulesSortOption,
	RulesToolbar,
} from '@/components/rules-lab/RulesToolbar';
import { useRules } from '@/hooks/useRules';
import { serializeRules, validateRuleImport } from '@/domain/rulesIO';
import type { Rule } from '@/types/rules';

function RulesLab() {
	const { rules, addRule, updateRule, removeRule, toggleRuleEnabled } = useRules();
	const [editingRule, setEditingRule] = useState<Rule | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [search, setSearch] = useState('');
	const [actionFilter, setActionFilter] = useState<RulesActionFilter>('all');
	const [sort, setSort] = useState<RulesSortOption>('updated_desc');
	const [importPreview, setImportPreview] = useState<Rule[] | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [searchParams] = useSearchParams();

	const triggerImportPicker = () => fileInputRef.current?.click();

	const focusRuleId = searchParams.get('rule');
	useEffect(() => {
		if (!focusRuleId) return;
		const target = rules.find((r) => r.id === focusRuleId);
		if (target) setEditingRule(target);
	}, [focusRuleId, rules]);

	const counts = useMemo<Record<RulesActionFilter, number>>(() => {
		const acc: Record<RulesActionFilter, number> = {
			all: rules.length,
			mock: 0,
			delay: 0,
			transform: 0,
			breakpoint: 0,
		};
		for (const rule of rules) {
			acc[rule.action.type] += 1;
		}
		return acc;
	}, [rules]);

	const orderById = useMemo(() => {
		const map = new Map<string, number>();
		rules.forEach((rule, index) => {
			map.set(rule.id, index + 1);
		});
		return map;
	}, [rules]);

	const visibleRules = useMemo(() => {
		const term = search.trim().toLowerCase();
		const filtered = rules.filter((r) => {
			if (actionFilter !== 'all' && r.action.type !== actionFilter) return false;
			if (term.length === 0) return true;
			if (r.name.toLowerCase().includes(term)) return true;
			const url = r.matchers.find((m) => m.type === 'url' && m.enabled);
			if (url && url.type === 'url' && url.pattern.toLowerCase().includes(term)) return true;
			return false;
		});

		const sorted = [...filtered];
		switch (sort) {
			case 'updated_desc':
				sorted.sort((a, b) => b.updatedAt - a.updatedAt);
				break;
			case 'updated_asc':
				sorted.sort((a, b) => a.updatedAt - b.updatedAt);
				break;
			case 'name_asc':
				sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
				break;
			case 'status_active_first':
				sorted.sort((a, b) => {
					if (a.enabled === b.enabled) return b.updatedAt - a.updatedAt;
					return a.enabled ? -1 : 1;
				});
				break;
		}
		return sorted;
	}, [rules, search, actionFilter, sort]);

	const subtitle = useMemo(() => {
		if (rules.length === 0) return 'Nenhuma regra configurada';
		const active = rules.filter((r) => r.enabled).length;
		const paused = rules.length - active;
		if (paused === 0)
			return `${rules.length} ${rules.length === 1 ? 'regra' : 'regras'} · todas ativas`;
		return `${rules.length} regras · ${active} ${active === 1 ? 'ativa' : 'ativas'}, ${paused} ${paused === 1 ? 'pausada' : 'pausadas'}`;
	}, [rules]);

	const handleExport = () => {
		const json = serializeRules(rules);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `debug-buddy-rules-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleImportFile = async (file: File) => {
		setImportError(null);
		try {
			const text = await file.text();
			const parsed: unknown = JSON.parse(text);
			const result = validateRuleImport(parsed);
			if (!result.ok) {
				setImportError(result.error);
				return;
			}
			setImportPreview(result.rules);
		} catch (err) {
			setImportError(err instanceof Error ? err.message : 'JSON inválido');
		}
	};

	const handleConfirmImport = async (importedRules: Rule[], strategy: ImportStrategy) => {
		if (strategy === 'replace') {
			await chrome.storage.local.set({ rules: importedRules });
		} else {
			for (const rule of importedRules) {
				await addRule(rule.name, rule.matchers, rule.action);
			}
		}
		setImportPreview(null);
	};

	const handleDuplicate = async (rule: Rule) => {
		await addRule(`${rule.name} (cópia)`, rule.matchers, rule.action);
	};

	return (
		<div className="space-y-3 p-4">
			<Card className="overflow-hidden p-0">
				<RulesPageHeader
					subtitle={subtitle}
					canExport={rules.length > 0}
					onCreate={() => setIsCreating(true)}
					onExport={handleExport}
					onImportClick={triggerImportPicker}
				/>

				{rules.length === 0 ? (
					<RulesEmptyState onCreate={() => setIsCreating(true)} onImport={triggerImportPicker} />
				) : (
					<>
						<RulesToolbar
							search={search}
							onSearchChange={setSearch}
							actionFilter={actionFilter}
							onActionFilterChange={setActionFilter}
							sort={sort}
							onSortChange={setSort}
							counts={counts}
						/>
						<RulesList
							rules={visibleRules}
							totalCount={rules.length}
							orderById={orderById}
							onEdit={(rule) => setEditingRule(rule)}
							onRemove={removeRule}
							onDuplicate={handleDuplicate}
							onToggle={toggleRuleEnabled}
						/>
					</>
				)}
			</Card>

			{importError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
					Erro ao importar: {importError}
					<button
						type="button"
						onClick={() => setImportError(null)}
						className="ml-2 text-xs underline"
					>
						fechar
					</button>
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				accept="application/json"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleImportFile(file);
					if (fileInputRef.current) fileInputRef.current.value = '';
				}}
			/>

			<RulesImportDialog
				open={importPreview !== null}
				onOpenChange={(open) => {
					if (!open) setImportPreview(null);
				}}
				rules={importPreview ?? []}
				onConfirm={handleConfirmImport}
			/>

			<RuleEditor
				open={isCreating}
				mode="create"
				onOpenChange={(open) => {
					if (!open) setIsCreating(false);
				}}
				onSave={async (newRule) => {
					const created = await addRule(newRule.name, newRule.matchers, newRule.action);
					if (created) {
						setIsCreating(false);
					}
					return created !== null;
				}}
			/>

			{editingRule && (
				<RuleEditor
					open={!!editingRule}
					mode="edit"
					rule={editingRule}
					onOpenChange={(open) => {
						if (!open) setEditingRule(null);
					}}
					onSave={async (updated) => {
						const ok = await updateRule(editingRule.id, updated);
						if (ok) setEditingRule(null);
						return ok;
					}}
				/>
			)}
		</div>
	);
}

export default RulesLab;
