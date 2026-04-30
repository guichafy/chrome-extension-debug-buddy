import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import type { PillName } from '../components/layout/NetworkMetricsBar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';
import { encodeFiltersToParams } from '@/lib/filterUrlSerialization';
import type { Filter } from '@/types/filters';

const Layout: React.FC = () => {
	const navigate = useNavigate();
	const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();
	const { pendingResponses } = useResponses();
	const { allRequests } = useAllRequests();
	const sessionMarker = useSessionMarker();
	const metrics = useNetworkMetrics(allRequests, sessionMarker);
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

	// Click handler unificado para as pills do NetworkMetricsBar.
	// Constrói filtros que reproduzem o que a pill descreve, herdando a janela
	// ativa (Sessão ou Página) como filtro de tempo. Navega para /command-center
	// com os filtros serializados na URL — o /command-center hidrata na montagem.
	const handlePillClick = useCallback(
		(pill: PillName) => {
			// Janela ativa é estado interno do NetworkMetricsBar; não temos acesso direto.
			// Aproximação: usar `currentPageNavigatedAt` quando disponível, senão `sessionStartedAt`.
			// Esta heurística casa com o estado padrão da Tabs: quando há página, ela é o foco
			// (a pill exibida coincide). Caso o usuário esteja com a tab "Sessão" ativa,
			// o filtro pode mostrar mais requests do que a pill — aceitável v1; caminho
			// "exato" exige levantar `window` para o pai (refactor maior, fora de escopo).
			const since = sessionMarker.currentPageNavigatedAt ?? sessionMarker.sessionStartedAt;
			const filters: Filter[] = [];
			if (since != null) {
				filters.push({
					id: crypto.randomUUID(),
					field: 'timestamp',
					operator: 'gte',
					value: String(since),
				});
			}
			if (pill === 'slow') {
				filters.push({
					id: crypto.randomUUID(),
					field: 'duration',
					operator: 'gte',
					value: '1000',
				});
			} else if (pill === 'failed') {
				filters.push({
					id: crypto.randomUUID(),
					field: 'status',
					operator: 'gte',
					value: '400',
				});
			}
			const params = encodeFiltersToParams(filters);
			const query = params.toString();
			navigate(query ? `/command-center?${query}` : '/command-center');
		},
		[navigate, sessionMarker.currentPageNavigatedAt, sessionMarker.sessionStartedAt],
	);

	return (
		<SidebarProvider>
			<AppSidebar variant="inset" pendingResponsesCount={Object.keys(pendingResponses).length} />
			<SidebarInset>
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
					onPillClick={handlePillClick}
				/>

				<div className="main-content-container flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
