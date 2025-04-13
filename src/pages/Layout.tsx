import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  // Usar o pathname completo como key para forçar remontagem total dos componentes
  const routeKey = location.pathname;

  // Limpar qualquer estado persistente quando a rota muda
  useEffect(() => {
    // Limpar o console para facilitar a depuração
    if (process.env.NODE_ENV === 'development') {
      console.clear();
      console.log('Rota alterada para:', location.pathname);
    }

    // Emitir um evento personalizado quando a rota muda
    // Isso permite que outros componentes reajam à mudança de rota
    const event = new CustomEvent('route-changed', {
      detail: { pathname: location.pathname }
    });
    window.dispatchEvent(event);
  }, [location.pathname]);

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

        <div className="main-content-container">
          <div className="p-4 pb-8">
            <Outlet key={routeKey} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
