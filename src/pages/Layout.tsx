import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Icon } from '../components/ui/icon';
import SelectTabDialog from '../components/SelectTabDialog';
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
    <div className="min-h-screen bg-background app-container">
      <SelectTabDialog
        open={selectTabDialogOpen}
        onOpenChange={setSelectTabDialogOpen}
        onSelectTab={handleSelectTab}
      />
      <header className="border-b p-4 flex justify-between items-center app-header">
        <div className="flex items-center gap-2 logo-container">
          <img src="images/icon48.png" alt="Logo" className="w-8 h-8 logo" />
          <h1 className="text-xl font-bold">Network Request Interceptor</h1>
        </div>
        <div className="flex items-center gap-2 header-controls">
          <Button
            variant="outline"
            className={`flex items-center gap-2 ${targetTab.id ? 'bg-green-500 text-white' : 'text-black'}`}
            onClick={() => setSelectTabDialogOpen(true)}
            title={targetTab.url}
          >
            <Icon name="tab" />
            {targetTab.id ?
              (targetTab.title.length > 15 ? targetTab.title.substring(0, 15) + '...' : targetTab.title) :
              'Selecionar Aba'
            }
          </Button>
          {!isDebugging ? (
            <Button
              variant="default"
              className="flex items-center gap-2 primary-button"
              onClick={() => startDebugging()}
            >
              <Icon name="play_arrow" />
              Iniciar Interceptação
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="flex items-center gap-2 danger-button"
              onClick={() => stopDebugging()}
            >
              <Icon name="stop" />
              Parar Interceptação
            </Button>
          )}
          <div className="flex items-center gap-2 ml-4 status-indicator">
            <span className={`w-3 h-3 rounded-full ${isDebugging ? 'bg-green-500' : 'bg-gray-400'} status-dot`}></span>
            <span>{isDebugging ? 'Ativo' : 'Inativo'}</span>
            {isDebugging && <span className="ml-2 bg-gray-200 px-2 rounded-full text-xs badge">{Object.keys(pendingResponses).length}</span>}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] main-content">
        <div className="w-64 border-r p-4 sidebar">
          <nav className="space-y-2 nav-menu">
            <NavLink to="/" className={({ isActive }) => 
              `flex items-center w-full p-2 rounded-md ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }>
              <Icon name="settings" className="mr-2" />
              <span>Configurações</span>
            </NavLink>
            <NavLink to="/requests" className={({ isActive }) => 
              `flex items-center w-full p-2 rounded-md ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }>
              <Icon name="list" className="mr-2" />
              <span>Requisições</span>
              {Object.keys(pendingResponses).length > 0 && (
                <span className="ml-auto bg-gray-200 px-2 rounded-full text-xs badge">
                  {Object.keys(pendingResponses).length}
                </span>
              )}
            </NavLink>
            <NavLink to="/mocks" className={({ isActive }) => 
              `flex items-center w-full p-2 rounded-md ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }>
              <Icon name="build" className="mr-2" />
              <span>Mocks</span>
              {mocks.length > 0 && (
                <span className="ml-auto bg-gray-200 px-2 rounded-full text-xs badge">
                  {mocks.length}
                </span>
              )}
            </NavLink>
          </nav>
        </div>

        <div className="flex-1 p-4 overflow-auto content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
