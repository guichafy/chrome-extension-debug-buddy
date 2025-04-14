import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import SelectTabDialog from '../components/SelectTabDialog';
import { AppSidebar } from '../components/AppSidebar';
import { SiteHeader } from '../components/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useMocks } from '../hooks/useMocks';
import { chromeAPI } from '@/utils/chromeAPI';

const Layout: React.FC = () => {
  const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();
  const { pendingResponses } = useResponses();
  const { mocks } = useMocks();
  const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);

  // Listener para mensagens do background script
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === 'openSelectTabDialog') {
        setSelectTabDialogOpen(true);
      }
    };

    chromeAPI.runtime.onMessage.addListener(messageListener);

    return () => {
      chromeAPI.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handleSelectTab = (tabId: number, tabTitle: string, tabUrl: string) => {
    // Enviar mensagem para o background script com o ID da aba selecionada
    chromeAPI.runtime.sendMessage({
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

        <div className="main-content-container">
          <div className="p-4 pb-8">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
