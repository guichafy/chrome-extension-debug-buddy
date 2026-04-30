import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';

const Layout: React.FC = () => {
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
				/>

				<div className="main-content-container flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
