import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import SelectTabDialog from '../components/SelectTabDialog';
import { AppSidebar } from '../components/AppSidebar';
import { SiteHeader } from '../components/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useMocks } from '../hooks/useMocks';

const Layout: React.FC = () => {
  const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();
  const { pendingResponses } = useResponses();
  const { mocks } = useMocks();
  const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);
  const navigate = useNavigate();

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
      tabUrl
    });
  };

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        pendingResponsesCount={Object.keys(pendingResponses).length}
        mocksCount={mocks.length}
      />
      <SidebarInset>
        <SelectTabDialog
          open={selectTabDialogOpen}
          onOpenChange={setSelectTabDialogOpen}
          onSelectTab={handleSelectTab}
        />
        <SiteHeader
          targetTab={targetTab}
          isDebugging={isDebugging}
          pendingResponsesCount={Object.keys(pendingResponses).length}
          onSelectTabClick={() => setSelectTabDialogOpen(true)}
          onStartDebugging={() => startDebugging()}
          onStopDebugging={() => stopDebugging()}
        />

        <div className="flex-1 p-4 overflow-auto content-area">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
