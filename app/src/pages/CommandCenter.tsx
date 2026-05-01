import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import type { ActionType, Rule } from '@/types/rules';
import { useAppOutlet } from '@/types/outletContext';
import { useRules } from '@/hooks/useRules';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import RuleEditor from '@/components/rules/RuleEditor';
import { EditResponseSheet } from '@/components/command-center/EditResponseSheet';
import { buildRuleDraftFromRequest } from '@/domain/quickMock';
import { cn } from '@/lib/utils';
import { filtersEqualUrl, parseFiltersFromUrl, serializeFiltersToUrl } from '@/lib/filterUrl';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const VALID_RULE_TYPES: ReadonlySet<ActionType> = new Set([
	'mock',
	'breakpoint',
	'transform',
	'delay',
]);

const isActionType = (value: string | null): value is ActionType =>
	value !== null && VALID_RULE_TYPES.has(value as ActionType);

const CommandCenter: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	const {
		filteredRequests,
		filters,
		setFilters,
		clearAllRequests,
		approveResponseWithEdit,
		pendingResponses,
		rules,
		selectedId,
		selected,
		select,
		clear,
	} = useAppOutlet();

	const { addRule } = useRules();

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);
	const [createRuleError, setCreateRuleError] = useState<string | null>(null);

	const hydratedFromUrlRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: hidrata uma única vez
	useEffect(() => {
		if (hydratedFromUrlRef.current) return;
		hydratedFromUrlRef.current = true;
		const fromUrl = parseFiltersFromUrl(searchParams);
		if (fromUrl.length > 0) setFilters(fromUrl);
	}, []);

	useEffect(() => {
		if (!hydratedFromUrlRef.current) return;
		const desired = serializeFiltersToUrl(filters);
		const current = searchParams.getAll('filter');
		if (filtersEqualUrl(desired, current)) return;
		const next = new URLSearchParams(searchParams);
		next.delete('filter');
		for (const value of desired) next.append('filter', value);
		setSearchParams(next, { replace: true });
	}, [filters, searchParams, setSearchParams]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	useEffect(() => {
		if (selectedId && !selected) clear();
	}, [selectedId, selected, clear]);

	const editParam = searchParams.get('edit');
	const createRuleParam = searchParams.get('createRule');
	const createRuleTypeParam = searchParams.get('type');

	const editSheetTargetId = editParam;
	const createRuleTargetId = !editParam && createRuleParam ? createRuleParam : null;
	const createRuleType = isActionType(createRuleTypeParam) ? createRuleTypeParam : null;

	const editTarget = editSheetTargetId ? (pendingResponses[editSheetTargetId] ?? null) : null;
	const createRuleTarget = createRuleTargetId
		? (filteredRequests[createRuleTargetId] ?? pendingResponses[createRuleTargetId] ?? null)
		: null;

	useEffect(() => {
		const next = new URLSearchParams(searchParams);
		let changed = false;
		if (editParam && !editTarget) {
			next.delete('edit');
			changed = true;
		}
		if (createRuleParam && (!createRuleTarget || !createRuleType) && !editParam) {
			next.delete('createRule');
			next.delete('type');
			changed = true;
		}
		if (editParam && editTarget && (createRuleParam || createRuleTypeParam)) {
			next.delete('createRule');
			next.delete('type');
			changed = true;
		}
		if (changed) setSearchParams(next, { replace: true });
	}, [
		editParam,
		createRuleParam,
		createRuleTypeParam,
		editTarget,
		createRuleTarget,
		createRuleType,
		searchParams,
		setSearchParams,
	]);

	const closeEditSheet = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('edit');
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const closeCreateRule = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('createRule');
		next.delete('type');
		setSearchParams(next, { replace: true });
		setCreateRuleError(null);
	}, [searchParams, setSearchParams]);

	const openCreateRuleFor = useCallback(
		(requestId: string, actionType: ActionType) => {
			const next = new URLSearchParams(searchParams);
			next.set('createRule', requestId);
			next.set('type', actionType);
			next.delete('edit');
			setSearchParams(next, { replace: true });
			setCreateRuleError(null);
		},
		[searchParams, setSearchParams],
	);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateRule = (
		_request: InterceptedResponse,
		requestId: string,
		actionType: ActionType,
	) => {
		openCreateRuleFor(requestId, actionType);
	};

	const draftResult = useMemo(() => {
		if (!createRuleTarget || !createRuleType) return null;
		return buildRuleDraftFromRequest(createRuleTarget, {
			type: createRuleType,
			includeQueryString: false,
			headerMatchers: [],
		});
	}, [createRuleTarget, createRuleType]);

	const handleCreateRuleSave = async (
		newRule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<boolean> => {
		const created = await addRule(newRule.name, newRule.matchers, newRule.action);
		if (created) {
			setRecentRuleId(created.id);
			closeCreateRule();
			return true;
		}
		setCreateRuleError('Falha ao gravar a regra em chrome.storage.local.');
		return false;
	};

	const headerMatcherSource = useMemo(
		() =>
			createRuleTarget
				? {
						requestHeaders: createRuleTarget.request?.headers ?? {},
						responseHeaders: createRuleTarget.response?.headers ?? createRuleTarget.headers,
					}
				: undefined,
		[createRuleTarget],
	);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden lg:flex-row">
			<section
				className={cn(
					'flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-4',
					selected ? 'lg:w-[28%] lg:min-w-[320px] lg:flex-shrink-0' : 'flex-1',
				)}
			>
				<RequestTimeline
					requests={filteredRequests}
					selectedId={selectedId}
					onSelect={select}
					filters={filters}
					onFiltersChange={setFilters}
					onClearHistory={() => setClearDialogOpen(true)}
				/>
			</section>

			{selected && selectedId && (
				<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t lg:border-l lg:border-t-0">
					<RequestInspector
						request={{
							...selected,
							generatedRuleId: recentRuleId ?? selected.generatedRuleId,
						}}
						requestId={selectedId}
						onCreateRule={handleCreateRule}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{createRuleTarget && createRuleTargetId && createRuleType && draftResult?.ok && (
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={draftResult.draft}
					headerMatcherSource={headerMatcherSource}
					onOpenChange={(open) => {
						if (!open) closeCreateRule();
					}}
					onSave={handleCreateRuleSave}
				/>
			)}

			{createRuleTarget && draftResult && !draftResult.ok && (
				<AlertDialog open onOpenChange={(o) => !o && closeCreateRule()}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Não foi possível criar regra</AlertDialogTitle>
							<AlertDialogDescription>{draftResult.error.message}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={closeCreateRule}>Fechar</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{createRuleError && (
				<AlertDialog open onOpenChange={() => setCreateRuleError(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Erro ao salvar</AlertDialogTitle>
							<AlertDialogDescription>{createRuleError}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={() => setCreateRuleError(null)}>OK</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{editTarget && editSheetTargetId && (
				<EditResponseSheet
					open
					onOpenChange={(open) => {
						if (!open) closeEditSheet();
					}}
					request={editTarget}
					requestId={editSheetTargetId}
					onSubmit={approveResponseWithEdit}
				/>
			)}

			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove todas as requisições. Não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleClearHistory} className="bg-red-500 hover:bg-red-600">
							Limpar histórico
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default CommandCenter;
