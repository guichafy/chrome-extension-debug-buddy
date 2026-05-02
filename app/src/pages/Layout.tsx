import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebugging } from '../hooks/useDebugging';
import { useAllRequests } from '../hooks/useAllRequests';
import { useResponses } from '../hooks/useResponses';
import { useRules } from '../hooks/useRules';
import { useRequestSelection } from '../hooks/useRequestSelection';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';
import { PendingActionDock } from '@/components/command-center/PendingActionDock';
import { usePendingHotkeys } from '@/components/command-center/usePendingHotkeys';
import type { AppOutletContext } from '@/types/outletContext';
import { RecordingBanner } from '@/components/recording/RecordingBanner';
import { LiveAntipatternsPanel } from '@/components/replay/LiveAntipatternsPanel';
import { useRecording } from '../hooks/useRecording';

const RouteFallback: React.FC = () => (
	<div className="flex flex-col gap-3 p-6">
		<Skeleton className="h-8 w-48" />
		<Skeleton className="h-4 w-full max-w-md" />
		<div className="mt-4 grid gap-2">
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
		</div>
	</div>
);

const Layout: React.FC = () => {
	const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();

	// Estado consolidado: o Layout passa a ser dono dos hooks que antes eram
	// instanciados duplicadamente por CommandCenter. As rotas filhas consomem
	// o estado via useOutletContext (ver useAppOutlet em types/outletContext.ts).
	const allRequestsState = useAllRequests();
	const responsesState = useResponses();
	const rulesState = useRules();
	const selectionState = useRequestSelection(allRequestsState.filteredRequests);

	const sessionMarker = useSessionMarker();
	const metrics = useNetworkMetrics(allRequestsState.allRequests, sessionMarker);

	// Modo passivo: interceptação ON + gravação OFF. Nesse caso, queremos
	// exibir os hits de antipattern recebidos via runtime.onMessage para a tab
	// alvo. Quando a gravação está ativa, os hits são exibidos pelo painel da
	// sessão (AntipatternsTab dentro do replay) — não duplicar aqui.
	const targetTabId = targetTab?.id ?? null;
	const recording = useRecording(targetTabId);
	const passiveTabId = isDebugging && !recording.status.active && targetTabId ? targetTabId : null;

	const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);

	useEffect(() => {
		const messageListener = (message: any) => {
			if (message.action === 'openSelectTabDialog') {
				setSelectTabDialogOpen(true);
			}
		};
		chrome.runtime.onMessage.addListener(messageListener);
		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, []);

	const handleSelectTab = (tabId: number, tabTitle: string, tabUrl: string) => {
		chrome.runtime.sendMessage({
			action: 'setTargetTab',
			tabId,
			tabTitle,
			tabUrl,
		});
	};

	// Memoizar o objeto context para evitar re-render em cascata em todas as
	// rotas filhas a cada render do Layout. Os campos individuais já são
	// estáveis (useState/useCallback nos hooks); só agregamos.
	const outletContext = useMemo<AppOutletContext>(
		() => ({
			selectedId: selectionState.selectedId,
			selected: selectionState.selected,
			select: selectionState.select,
			clear: selectionState.clear,
			filteredRequests: allRequestsState.filteredRequests,
			filters: allRequestsState.filters,
			setFilters: allRequestsState.setFilters,
			clearAllRequests: allRequestsState.clearAllRequests,
			pendingResponses: responsesState.pendingResponses,
			approveResponse: responsesState.approveResponse,
			approveResponseWithEdit: responsesState.approveResponseWithEdit,
			ignoreResponse: responsesState.ignoreResponse,
			ignoreAllPending: responsesState.ignoreAllPending,
			rules: rulesState.rules,
		}),
		[
			selectionState.selectedId,
			selectionState.selected,
			selectionState.select,
			selectionState.clear,
			allRequestsState.filteredRequests,
			allRequestsState.filters,
			allRequestsState.setFilters,
			allRequestsState.clearAllRequests,
			responsesState.pendingResponses,
			responsesState.approveResponse,
			responsesState.approveResponseWithEdit,
			responsesState.ignoreResponse,
			responsesState.ignoreAllPending,
			rulesState.rules,
		],
	);

	const navigate = useNavigate();
	const location = useLocation();

	// Derivação do alvo do Dock — mesma fórmula que vivia em CommandCenter:
	// "selectedId se for pendente, senão primeiro pendente". Promovida para o
	// Layout porque o Dock agora é global.
	const { pendingIdsOrdered, pendingCount, dockTargetIndex, hasSelectedPending, nextPendingUrl } =
		useMemo(() => {
			const entries = Object.entries(responsesState.pendingResponses).sort(
				(a, b) => (a[1]?.timestamp ?? 0) - (b[1]?.timestamp ?? 0),
			);
			const ids = entries.map(([id]) => id);
			const manualIdx = selectionState.selectedId ? ids.indexOf(selectionState.selectedId) : -1;
			const targetIndex = manualIdx >= 0 ? manualIdx : ids.length > 0 ? 0 : null;
			const targetId = targetIndex !== null ? ids[targetIndex] : undefined;
			const url = targetId ? (responsesState.pendingResponses[targetId]?.url ?? null) : null;
			return {
				pendingIdsOrdered: ids,
				pendingCount: ids.length,
				dockTargetIndex: targetIndex,
				hasSelectedPending: targetIndex !== null,
				nextPendingUrl: url,
			};
		}, [responsesState.pendingResponses, selectionState.selectedId]);

	const dockTargetId =
		hasSelectedPending && selectionState.selectedId
			? selectionState.selectedId
			: pendingIdsOrdered[0];

	const approveNext = useCallback(async () => {
		if (!dockTargetId) return;
		await responsesState.approveResponse(dockTargetId, {});
	}, [dockTargetId, responsesState.approveResponse]);

	const ignoreCurrent = useCallback(async () => {
		if (!dockTargetId) return;
		await responsesState.ignoreResponse(dockTargetId);
	}, [dockTargetId, responsesState.ignoreResponse]);

	// Editar / Criar Mock: navegam para /command-center com query param. Quando
	// já estamos lá, react-router só atualiza search params (sem unmount).
	// CommandCenter hidrata o param e abre o sheet/panel correspondente
	// (hidratação é feita na Task 6 deste refactor).
	const editNext = useCallback(() => {
		if (!dockTargetId) return;
		navigate(`/command-center?edit=${encodeURIComponent(dockTargetId)}`);
	}, [dockTargetId, navigate]);

	const createMockNext = useCallback(() => {
		if (!dockTargetId) return;
		navigate(`/command-center?createRule=${encodeURIComponent(dockTargetId)}&type=mock`);
	}, [dockTargetId, navigate]);

	const handleIgnoreAll = useCallback(async () => {
		const { succeeded, failed } = await responsesState.ignoreAllPending();
		if (failed.length === 0) return;
		const detail = failed.map((f) => `- ${f.requestId}: ${f.error}`).join('\n');
		alert(`${succeeded} ignorada(s) com sucesso, ${failed.length} falha(s):\n${detail}`);
	}, [responsesState.ignoreAllPending]);

	const navigateNext = useCallback(() => {
		if (pendingIdsOrdered.length === 0) return;
		const idx = dockTargetIndex ?? -1;
		const nextIndex = (idx + 1 + pendingIdsOrdered.length) % pendingIdsOrdered.length;
		const target = pendingIdsOrdered[nextIndex];
		if (target) selectionState.select(target);
	}, [pendingIdsOrdered, selectionState.select, dockTargetIndex]);

	const navigatePrev = useCallback(() => {
		if (pendingIdsOrdered.length === 0) return;
		const idx = dockTargetIndex ?? 0;
		const nextIndex = (idx - 1 + pendingIdsOrdered.length) % pendingIdsOrdered.length;
		const target = pendingIdsOrdered[nextIndex];
		if (target) selectionState.select(target);
	}, [pendingIdsOrdered, selectionState.select, dockTargetIndex]);

	const onViewPending = useCallback(() => {
		const alreadyPending = allRequestsState.filters.some(
			(f) => f.field === 'state' && f.value === 'pending',
		);
		if (!alreadyPending) {
			allRequestsState.setFilters([
				...allRequestsState.filters,
				{ id: crypto.randomUUID(), field: 'state', operator: 'is', value: 'pending' },
			]);
		}
		if (location.pathname !== '/command-center') {
			navigate('/command-center');
		}
	}, [allRequestsState.filters, allRequestsState.setFilters, location.pathname, navigate]);

	usePendingHotkeys({
		enabled: pendingCount > 0,
		// J/K só fazem sentido quando há ao menos 2 pausadas — caso contrário
		// `navigateNext`/`navigatePrev` seriam no-ops e ainda assim consumiriam
		// o keystroke do usuário (que pode estar usando J/K para scroll).
		navEnabled: pendingCount > 1,
		onApprove: approveNext,
		onIgnore: ignoreCurrent,
		onNext: navigateNext,
		onPrev: navigatePrev,
		onEscape: selectionState.clear,
	});

	return (
		<SidebarProvider>
			<AppSidebar variant="inset" />
			<SidebarInset className="min-w-0 overflow-hidden">
				<SelectTabDialog
					open={selectTabDialogOpen}
					onOpenChange={setSelectTabDialogOpen}
					onSelectTab={handleSelectTab}
				/>
				<SiteHeader
					targetTab={targetTab}
					isDebugging={isDebugging}
					onSelectTabClick={() => setSelectTabDialogOpen(true)}
					onStartDebugging={() => startDebugging()}
					onStopDebugging={() => stopDebugging()}
					metrics={metrics}
					sessionMarker={sessionMarker}
					sessionDetails={metrics.sessionDetails}
					currentPageDetails={metrics.currentPageDetails}
				/>
				<RecordingBanner tabId={targetTab?.id ?? null} />

				<div className="main-content-container flex-1 min-h-0 min-w-0 overflow-hidden">
					<Suspense fallback={<RouteFallback />}>
						<Outlet context={outletContext} />
					</Suspense>
				</div>
				<PendingActionDock
					pendingCount={pendingCount}
					currentIndex={dockTargetIndex}
					hasSelectedPending={hasSelectedPending}
					nextPendingUrl={nextPendingUrl}
					onApproveNext={approveNext}
					onEditNext={editNext}
					onCreateMockNext={createMockNext}
					onIgnoreAll={handleIgnoreAll}
					onViewPending={onViewPending}
				/>
				<LiveAntipatternsPanel tabId={passiveTabId} />
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
