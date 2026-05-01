import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';
import { useRequestSelection } from '@/hooks/useRequestSelection';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import { PendingActionDock } from '@/components/command-center/PendingActionDock';
import { EditResponseSheet } from '@/components/command-center/EditResponseSheet';
import { usePendingHotkeys } from '@/components/command-center/usePendingHotkeys';
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

const CommandCenter: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const {
		filteredRequests,
		filters,
		setFilters,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		clearAllRequests,
	} = useAllRequests();

	const {
		approveResponse,
		approveResponseWithEdit,
		ignoreResponse,
		ignoreAllPending,
		pendingResponses,
	} = useResponses();
	const { rules } = useRules();
	const { selectedId, selected, select, clear } = useRequestSelection(filteredRequests);

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [quickMockTargetId, setQuickMockTargetId] = useState<string | null>(null);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);
	const [editSheetTargetId, setEditSheetTargetId] = useState<string | null>(null);

	// Hidrata `filters` a partir da URL na primeira renderização e mantém a URL
	// sincronizada conforme o FilterBar muda. A flag de hidratação evita o ciclo
	// "URL → filters → URL → filters" — depois do mount, o estado da hook é o
	// dono dos filtros e a URL apenas espelha.
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

	// Lista ordenada (timestamp asc) + posição do selecionado em uma única passada.
	// Usado para navegação J/K e para "Aprovar próximo" ter um alvo determinístico.
	const {
		pendingIdsOrdered,
		pendingCount,
		selectedPendingIndex,
		hasSelectedPending,
		nextPendingUrl,
	} = useMemo(() => {
		const entries = Object.entries(pendingResponses).sort(
			(a, b) => (a[1]?.timestamp ?? 0) - (b[1]?.timestamp ?? 0),
		);
		const ids = entries.map(([id]) => id);
		const idx = selectedId ? ids.indexOf(selectedId) : -1;
		// URL exibida no Dock: a do request que seria afetado por "Aprovar próximo"
		// — mesma resolução usada em approveNext/ignoreCurrent: selecionado se houver,
		// caso contrário o primeiro da fila.
		const targetId = idx >= 0 && selectedId ? selectedId : ids[0];
		const url = targetId ? (pendingResponses[targetId]?.url ?? null) : null;
		return {
			pendingIdsOrdered: ids,
			pendingCount: ids.length,
			selectedPendingIndex: idx >= 0 ? idx : null,
			hasSelectedPending: idx >= 0,
			nextPendingUrl: url,
		};
	}, [pendingResponses, selectedId]);

	// Limpar o id da regra recém-criada quando o usuário troca de request selecionado.
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	// Quando o request selecionado some do snapshot (ex.: foi aprovado/ignorado e
	// removido da fila pendente, ou o histórico foi limpo), descartamos a seleção
	// para o layout voltar ao estado de tela cheia da timeline em vez de travar
	// no placeholder "Selecione uma requisição".
	useEffect(() => {
		if (selectedId && !selected) clear();
	}, [selectedId, selected, clear]);

	const editTarget = editSheetTargetId ? (pendingResponses[editSheetTargetId] ?? null) : null;

	// Fecha o sheet automaticamente se o request alvo deixar de existir
	// (aprovado em outra superfície, ou histórico limpo).
	useEffect(() => {
		if (editSheetTargetId && !editTarget) setEditSheetTargetId(null);
	}, [editSheetTargetId, editTarget]);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = (_request: InterceptedResponse, requestId: string) => {
		setQuickMockTargetId(requestId);
	};

	const quickMockTarget = quickMockTargetId
		? (filteredRequests[quickMockTargetId] ?? pendingResponses[quickMockTargetId] ?? null)
		: null;

	useEffect(() => {
		if (quickMockTargetId && !quickMockTarget) setQuickMockTargetId(null);
	}, [quickMockTargetId, quickMockTarget]);

	const approveNext = useCallback(async () => {
		const nextId = hasSelectedPending && selectedId ? selectedId : pendingIdsOrdered[0];
		if (!nextId) return;
		await approveResponse(nextId, {});
	}, [approveResponse, hasSelectedPending, pendingIdsOrdered, selectedId]);

	const ignoreCurrent = useCallback(async () => {
		const targetId = hasSelectedPending && selectedId ? selectedId : pendingIdsOrdered[0];
		if (!targetId) return;
		await ignoreResponse(targetId);
	}, [hasSelectedPending, ignoreResponse, pendingIdsOrdered, selectedId]);

	const editNext = useCallback(() => {
		const targetId = hasSelectedPending && selectedId ? selectedId : pendingIdsOrdered[0];
		if (!targetId) return;
		setEditSheetTargetId(targetId);
	}, [hasSelectedPending, pendingIdsOrdered, selectedId]);

	const createMockNext = useCallback(() => {
		const targetId = hasSelectedPending && selectedId ? selectedId : pendingIdsOrdered[0];
		if (!targetId) return;
		setQuickMockTargetId(targetId);
	}, [hasSelectedPending, pendingIdsOrdered, selectedId]);

	const navigateNext = useCallback(() => {
		if (pendingIdsOrdered.length === 0) return;
		const idx = selectedPendingIndex ?? -1;
		const nextIndex = (idx + 1 + pendingIdsOrdered.length) % pendingIdsOrdered.length;
		const target = pendingIdsOrdered[nextIndex];
		if (target) select(target);
	}, [pendingIdsOrdered, select, selectedPendingIndex]);

	const navigatePrev = useCallback(() => {
		if (pendingIdsOrdered.length === 0) return;
		const idx = selectedPendingIndex ?? 0;
		const nextIndex = (idx - 1 + pendingIdsOrdered.length) % pendingIdsOrdered.length;
		const target = pendingIdsOrdered[nextIndex];
		if (target) select(target);
	}, [pendingIdsOrdered, select, selectedPendingIndex]);

	usePendingHotkeys({
		enabled: pendingCount > 0,
		onApprove: approveNext,
		onIgnore: ignoreCurrent,
		onNext: navigateNext,
		onPrev: navigatePrev,
		onEscape: clear,
	});

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
					autoRefreshEnabled={autoRefreshEnabled}
					pauseAutoRefresh={pauseAutoRefresh}
					enableAutoRefresh={enableAutoRefresh}
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
						onCreateMock={handleCreateMock}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{quickMockTarget && quickMockTargetId && (
				<QuickMockPanel
					open
					onOpenChange={(open) => {
						if (!open) setQuickMockTargetId(null);
					}}
					request={quickMockTarget}
					requestId={quickMockTargetId}
					onCreated={(rule) => setRecentRuleId(rule.id)}
				/>
			)}

			<PendingActionDock
				pendingCount={pendingCount}
				currentIndex={selectedPendingIndex}
				hasSelectedPending={hasSelectedPending}
				nextPendingUrl={nextPendingUrl}
				onApproveNext={approveNext}
				onEditNext={editNext}
				onCreateMockNext={createMockNext}
				onIgnoreAll={ignoreAllPending}
				onViewPending={() =>
					setFilters([
						{ id: crypto.randomUUID(), field: 'state', operator: 'is', value: 'pending' },
					])
				}
			/>

			{editTarget && editSheetTargetId && (
				<EditResponseSheet
					open
					onOpenChange={(open) => {
						if (!open) setEditSheetTargetId(null);
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
