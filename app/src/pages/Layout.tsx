import React, { Suspense, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';

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
	const { pendingResponses } = useResponses();
	const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);

	// Listener para mensagens do background script
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
		// Enviar mensagem para o background script com o ID da aba selecionada
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
