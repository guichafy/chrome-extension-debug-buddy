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
import { encodeFiltersToParams, encodeSortToParam } from '@/lib/filterUrlSerialization';
import type { Filter, Sort } from '@/types/filters';

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

	// Click handler por pill. Cada pill tem um contrato distinto de URL no
	// /command-center pra responder a pergunta natural daquela métrica:
	//
	//   total  → sort por timestamp desc                     (cronológico, default)
	//   bytes  → sort por transferSize desc                  ("o que pesou mais?")
	//   ttfb   → sort por ttfbMs desc                        ("o que demorou pra responder?")
	//   slow   → filter duration ≥ 1000 + janela + sort dur. (drilldown nas lentas)
	//   failed → filter status ≥ 400 + janela + sort time    (drilldown nas falhas)
	//
	// A janela ativa (Sessão/Página) só acompanha `slow`/`failed` — nas pills
	// neutras o usuário quer explorar todo o histórico ordenado pela métrica,
	// não restringir pelo tempo. Nada de URL idêntica entre pills neutras.
	//
	// Janela: como o estado da Tabs é interno do NetworkMetricsBar, usamos
	// `currentPageNavigatedAt ?? sessionStartedAt` como heurística (combina com
	// o tab default quando há página). Se o usuário tiver "Sessão" selecionada
	// manualmente mas houver página, o filtro pode estreitar mais que a pill —
	// aceitável v1; lift do estado é refactor maior fora de escopo.
	const handlePillClick = useCallback(
		(pill: PillName) => {
			const since = sessionMarker.currentPageNavigatedAt ?? sessionMarker.sessionStartedAt;
			const filters: Filter[] = [];
			let sort: Sort;

			switch (pill) {
				case 'total':
					sort = { field: 'timestamp', dir: 'desc' };
					break;
				case 'bytes':
					sort = { field: 'transferSize', dir: 'desc' };
					break;
				case 'ttfb':
					sort = { field: 'ttfbMs', dir: 'desc' };
					break;
				case 'slow':
					sort = { field: 'duration', dir: 'desc' };
					filters.push({
						id: crypto.randomUUID(),
						field: 'duration',
						operator: 'gte',
						value: '1000',
					});
					if (since != null) {
						filters.push({
							id: crypto.randomUUID(),
							field: 'timestamp',
							operator: 'gte',
							value: String(since),
						});
					}
					break;
				case 'failed':
					sort = { field: 'timestamp', dir: 'desc' };
					filters.push({
						id: crypto.randomUUID(),
						field: 'status',
						operator: 'gte',
						value: '400',
					});
					if (since != null) {
						filters.push({
							id: crypto.randomUUID(),
							field: 'timestamp',
							operator: 'gte',
							value: String(since),
						});
					}
					break;
			}

			const params = encodeFiltersToParams(filters);
			const sortStr = encodeSortToParam(sort);
			if (sortStr) params.set('sort', sortStr);
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
