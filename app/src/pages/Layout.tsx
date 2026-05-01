import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
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
import type { AppOutletContext } from '@/types/outletContext';

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
			pauseAutoRefresh: allRequestsState.pauseAutoRefresh,
			enableAutoRefresh: allRequestsState.enableAutoRefresh,
			autoRefreshEnabled: allRequestsState.autoRefreshEnabled,
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
			allRequestsState.pauseAutoRefresh,
			allRequestsState.enableAutoRefresh,
			allRequestsState.autoRefreshEnabled,
			allRequestsState.clearAllRequests,
			responsesState.pendingResponses,
			responsesState.approveResponse,
			responsesState.approveResponseWithEdit,
			responsesState.ignoreResponse,
			responsesState.ignoreAllPending,
			rulesState.rules,
		],
	);

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

				<div className="main-content-container flex-1 min-h-0 min-w-0 overflow-hidden">
					<Suspense fallback={<RouteFallback />}>
						<Outlet context={outletContext} />
					</Suspense>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
