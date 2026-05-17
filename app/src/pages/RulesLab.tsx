import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import RuleEditor from '@/components/rules/RuleEditor';
import { RulesEmptyState } from '@/components/rules-lab/RulesEmptyState';
import { RulesImportDialog, type ImportStrategy } from '@/components/rules-lab/RulesImportDialog';
import { RulesList, type StageFilter } from '@/components/rules-lab/RulesList';
import { RulesPageHeader } from '@/components/rules-lab/RulesPageHeader';
import { RuleSaveToast } from '@/components/rules-lab/RuleSaveToast';
import { getRuleMethods } from '@/components/rules-lab/ruleVisuals';
import {
	METHOD_FILTER_OPTIONS,
	type RulesSortOption,
	RulesToolbar,
} from '@/components/rules-lab/RulesToolbar';
import { useRules } from '@/hooks/useRules';
import { serializeRules, validateRuleImport } from '@/domain/rulesIO';
import { findUnreachableRuleIds } from '@/domain/ruleReachability';
import type { ActionType, Rule } from '@/types/rules';

interface SaveToastState {
	message: string;
	previousRules: Rule[];
}

const VALID_ACTION_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
	'mock',
	'requestDelay',
	'transform',
	'breakpoint',
	'requestModify',
	'responseModify',
	'block',
]);
const VALID_SORTS: ReadonlySet<RulesSortOption> = new Set([
	'priority_asc',
	'updated_desc',
	'updated_asc',
	'name_asc',
	'status_active_first',
]);
const VALID_METHODS: ReadonlySet<string> = new Set(METHOD_FILTER_OPTIONS);
const VALID_STAGE_FILTERS: ReadonlySet<StageFilter> = new Set<StageFilter>([
	'all',
	'request',
	'response',
]);

const FILTERS_STORAGE_KEY = 'debug-buddy.rules-filters';

interface PersistedFilters {
	search: string;
	actionFilters: ActionType[];
	methodFilters: string[];
	sort: RulesSortOption;
	stageFilter: StageFilter;
}

function loadPersistedFilters(): Partial<PersistedFilters> {
	try {
		if (typeof sessionStorage === 'undefined') return {};
		const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		const candidate = parsed as Record<string, unknown>;
		const result: Partial<PersistedFilters> = {};
		if (typeof candidate.search === 'string') result.search = candidate.search;
		if (Array.isArray(candidate.actionFilters)) {
			result.actionFilters = candidate.actionFilters.filter(
				(v): v is ActionType => typeof v === 'string' && VALID_ACTION_TYPES.has(v as ActionType),
			);
		}
		if (Array.isArray(candidate.methodFilters)) {
			result.methodFilters = candidate.methodFilters.filter(
				(v): v is string => typeof v === 'string' && VALID_METHODS.has(v),
			);
		}
		if (typeof candidate.sort === 'string' && VALID_SORTS.has(candidate.sort as RulesSortOption)) {
			result.sort = candidate.sort as RulesSortOption;
		}
		if (
			typeof candidate.stageFilter === 'string' &&
			VALID_STAGE_FILTERS.has(candidate.stageFilter as StageFilter)
		) {
			result.stageFilter = candidate.stageFilter as StageFilter;
		}
		return result;
	} catch {
		return {};
	}
}

function savePersistedFilters(state: PersistedFilters): void {
	try {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignora erros de storage (modo privado, quota, etc.). Filtros são UI
		// state — perdê-los após reload é aceitável segundo o AC do US-004.
	}
}

function RulesLab() {
	const {
		rules,
		addRule,
		updateRule,
		removeRule,
		duplicateRule,
		toggleRuleEnabled,
		reorderRules,
		moveRule,
	} = useRules();
	const [editingRule, setEditingRule] = useState<Rule | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const persistedRef = useRef(loadPersistedFilters());
	const [search, setSearch] = useState<string>(persistedRef.current.search ?? '');
	const [actionFilters, setActionFilters] = useState<ActionType[]>(
		persistedRef.current.actionFilters ?? [],
	);
	const [methodFilters, setMethodFilters] = useState<string[]>(
		persistedRef.current.methodFilters ?? [],
	);
	const [sort, setSort] = useState<RulesSortOption>(persistedRef.current.sort ?? 'priority_asc');
	const [stageFilter, setStageFilter] = useState<StageFilter>(
		persistedRef.current.stageFilter ?? 'all',
	);
	const [importPreview, setImportPreview] = useState<Rule[] | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [saveToast, setSaveToast] = useState<SaveToastState | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [searchParams] = useSearchParams();

	useEffect(() => {
		savePersistedFilters({ search, actionFilters, methodFilters, sort, stageFilter });
	}, [search, actionFilters, methodFilters, sort, stageFilter]);

	const dismissSaveToast = useCallback(() => setSaveToast(null), []);

	const undoLastSave = useCallback(async () => {
		if (!saveToast) return;
		await chrome.storage.local.set({ rules: saveToast.previousRules });
		setSaveToast(null);
	}, [saveToast]);

	const triggerImportPicker = () => fileInputRef.current?.click();

	const focusRuleId = searchParams.get('rule');
	useEffect(() => {
		if (!focusRuleId) return;
		const target = rules.find((r) => r.id === focusRuleId);
		if (target) setEditingRule(target);
	}, [focusRuleId, rules]);

	const actionCounts = useMemo<Record<ActionType, number>>(() => {
		const acc: Record<ActionType, number> = {
			mock: 0,
			requestDelay: 0,
			transform: 0,
			breakpoint: 0,
			requestModify: 0,
			responseModify: 0,
			block: 0,
		};
		// Phase 1 (compat): conta pela primeira action (head) do chain.
		// Phase 4 contará por TODOS os tipos do array quando chain estiver visível.
		for (const rule of rules) {
			const head = rule.actions[0];
			if (head) acc[head.type] += 1;
		}
		return acc;
	}, [rules]);

	const methodCounts = useMemo<Record<string, number>>(() => {
		const acc: Record<string, number> = {};
		for (const method of METHOD_FILTER_OPTIONS) acc[method] = 0;
		for (const rule of rules) {
			const ruleMethods = getRuleMethods(rule);
			for (const method of ruleMethods) {
				if (acc[method] !== undefined) acc[method] += 1;
			}
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

	// Phase 6: calcula IDs de regras inalcançáveis a partir do array GLOBAL —
	// nunca do `visibleRules` filtrado, senão um filtro escondendo a regra
	// terminal acima da alvo enganaria a heurística.
	const unreachableIds = useMemo(() => findUnreachableRuleIds(rules), [rules]);

	const visibleRules = useMemo(() => {
		const term = search.trim().toLowerCase();
		const hasActionFilter = actionFilters.length > 0;
		const hasMethodFilter = methodFilters.length > 0;
		const hasStageFilter = stageFilter !== 'all';
		const filtered = rules.filter((r) => {
			if (hasStageFilter && r.stage !== stageFilter) return false;
			if (hasActionFilter && !actionFilters.includes(r.actions[0]?.type)) return false;
			if (hasMethodFilter) {
				const ruleMethods = getRuleMethods(r);
				const intersects = ruleMethods.some((m) => methodFilters.includes(m));
				if (!intersects) return false;
			}
			if (term.length === 0) return true;
			if (r.name.toLowerCase().includes(term)) return true;
			const url = r.matchers.find((m) => m.type === 'url' && m.enabled);
			if (url && url.type === 'url' && url.pattern.toLowerCase().includes(term)) return true;
			return false;
		});

		const sorted = [...filtered];
		switch (sort) {
			case 'priority_asc':
				// Mantém a ordem do array `rules` (prioridade de matching).
				break;
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
	}, [rules, search, actionFilters, methodFilters, sort, stageFilter]);

	// Drag-and-drop só é seguro quando a ordem visível casa com a ordem do array
	// `rules` — ou seja, sem busca/filtro e ordenação por prioridade.
	const canReorder =
		stageFilter === 'all' &&
		sort === 'priority_asc' &&
		search.trim() === '' &&
		actionFilters.length === 0 &&
		methodFilters.length === 0;

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
				await addRule(rule.name, rule.matchers, rule.actions[0], rule.stage);
			}
		}
		setImportPreview(null);
	};

	const handleDuplicate = async (rule: Rule) => {
		const previousRules = rules;
		const created = await duplicateRule(rule.id);
		if (created) {
			setSaveToast({
				message: `Regra "${created.name}" criada (desativada)`,
				previousRules,
			});
		}
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
							actionFilters={actionFilters}
							onActionFiltersChange={setActionFilters}
							methodFilters={methodFilters}
							onMethodFiltersChange={setMethodFilters}
							stageFilterActive={stageFilter !== 'all'}
							onClearStageFilter={() => setStageFilter('all')}
							sort={sort}
							onSortChange={setSort}
							actionCounts={actionCounts}
							methodCounts={methodCounts}
							totalCount={rules.length}
						/>
						<RulesList
							rules={visibleRules}
							totalCount={rules.length}
							orderById={orderById}
							unreachableIds={unreachableIds}
							stageFilter={stageFilter}
							onStageFilterChange={setStageFilter}
							onEdit={(rule) => setEditingRule(rule)}
							onRemove={removeRule}
							onDuplicate={handleDuplicate}
							onToggle={toggleRuleEnabled}
							canReorder={canReorder}
							onReorder={(fromId, toId, position) => reorderRules(fromId, toId, position)}
							onMove={(id, direction) => moveRule(id, direction)}
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
					const previousRules = rules;
					const created = await addRule(
						newRule.name,
						newRule.matchers,
						newRule.actions[0],
						newRule.stage,
					);
					if (created) {
						setIsCreating(false);
						setSaveToast({
							message: `Regra "${created.name}" adicionada`,
							previousRules,
						});
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
						const previousRules = rules;
						const ok = await updateRule(editingRule.id, updated);
						if (ok) {
							setEditingRule(null);
							setSaveToast({
								message: `Regra "${updated.name}" atualizada`,
								previousRules,
							});
						}
						return ok;
					}}
				/>
			)}

			<RuleSaveToast
				open={saveToast !== null}
				message={saveToast?.message ?? ''}
				onUndo={undoLastSave}
				onDismiss={dismissSaveToast}
			/>
		</div>
	);
}

export default RulesLab;
