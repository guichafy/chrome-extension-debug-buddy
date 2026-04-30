import React, { Suspense, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebugging } from '../hooks/useDebugging';
import { useAllRequests } from '../hooks/useAllRequests';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';

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
			<AppSidebar variant="inset" />
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
					<Suspense fallback={<RouteFallback />}>
						<Outlet />
					</Suspense>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
