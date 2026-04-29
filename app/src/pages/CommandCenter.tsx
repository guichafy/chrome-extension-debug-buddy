import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';
import { useRequestSelection } from '@/hooks/useRequestSelection';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import { PendingAlertBanner } from '@/components/command-center/PendingAlertBanner';
import { PendingActionDock } from '@/components/command-center/PendingActionDock';
import { usePendingHotkeys } from '@/components/command-center/usePendingHotkeys';
import { cn } from '@/lib/utils';
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
	const {
		filteredRequests,
		filters,
		setFilters,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		clearAllRequests,
	} = useAllRequests();
	const { approveResponse, ignoreResponse, pendingResponses } = useResponses();
	const { rules } = useRules();
	const { selectedId, selected, select, clear } = useRequestSelection(filteredRequests);

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [quickMockOpen, setQuickMockOpen] = useState(false);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);

	// Lista ordenada (timestamp asc) + posição do selecionado em uma única passada.
	// Usado para navegação J/K e para "Aprovar próximo" ter um alvo determinístico.
	const { pendingIdsOrdered, pendingCount, selectedPendingIndex, hasSelectedPending } =
		useMemo(() => {
			const entries = Object.entries(pendingResponses).sort(
				(a, b) => (a[1]?.timestamp ?? 0) - (b[1]?.timestamp ?? 0),
			);
			const ids = entries.map(([id]) => id);
			const idx = selectedId ? ids.indexOf(selectedId) : -1;
			return {
				pendingIdsOrdered: ids,
				pendingCount: ids.length,
				selectedPendingIndex: idx >= 0 ? idx : null,
				hasSelectedPending: idx >= 0,
			};
		}, [pendingResponses, selectedId]);

	// Limpar o id da regra recém-criada quando o usuário troca de request selecionado.
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = (_request: InterceptedResponse, _requestId: string) => {
		setQuickMockOpen(true);
	};

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

	const ignoreAll = useCallback(async () => {
		for (const id of pendingIdsOrdered) {
			// Sequencial para preservar a ordem das respostas no background.
			await ignoreResponse(id);
		}
	}, [ignoreResponse, pendingIdsOrdered]);

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
		<div className="flex h-full min-h-0 flex-col lg:flex-row">
			<section
				className={cn(
					'flex min-h-0 flex-col gap-3 overflow-hidden p-4',
					selectedId ? 'lg:w-[28%] lg:min-w-[320px] lg:flex-shrink-0' : 'flex-1',
				)}
			>
				<PendingAlertBanner
					pendingCount={pendingCount}
					onApproveNext={approveNext}
					onIgnoreAll={ignoreAll}
				/>
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

			{selectedId && (
				<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t lg:border-l lg:border-t-0">
					<RequestInspector
						request={
							selected
								? {
										...selected,
										generatedRuleId: recentRuleId ?? selected.generatedRuleId,
									}
								: null
						}
						requestId={selectedId}
						onApprove={approveResponse}
						onIgnore={ignoreResponse}
						onCreateMock={handleCreateMock}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{quickMockOpen && selected && selectedId && (
				<QuickMockPanel
					open={quickMockOpen}
					onOpenChange={setQuickMockOpen}
					request={selected}
					requestId={selectedId}
					onCreated={(rule) => setRecentRuleId(rule.id)}
				/>
			)}

			<PendingActionDock
				pendingCount={pendingCount}
				currentIndex={selectedPendingIndex}
				hasSelectedPending={hasSelectedPending}
			/>

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
