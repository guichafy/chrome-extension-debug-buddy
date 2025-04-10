import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Icon } from './components/ui/icon';
import UrlForm from './components/UrlForm';
import UrlList from './components/UrlList';
import ResponseList from './components/ResponseList';
import ResponseDetails from './components/ResponseDetails';
import MockList from './components/MockList';
import MockEditor from './components/MockEditor';
import SelectTabDialog from './components/SelectTabDialog';
import { useUrlPatterns } from './hooks/useUrlPatterns';
import { useDebugging } from './hooks/useDebugging';
import { useResponses } from './hooks/useResponses';
import { useMocks } from './hooks/useMocks';

const MainApp: React.FC = () => {
  // Hooks para gerenciar o estado da aplicação
  const { urlPatterns, addUrlPattern, removeUrlPattern } = useUrlPatterns();
  const { isDebugging, targetTab, startDebugging, stopDebugging, selectTargetTab } = useDebugging();
  const {
    pendingResponses,
    currentResponseId,
    currentResponse,
    getResponseDetails,
    approveResponse,
    ignoreResponse,
    clearCurrentResponse
  } = useResponses();
  const {
    mocks,
    currentEditingMockIndex,
    saveMock,
    removeMock,
    toggleMockEnabled,
    editMock,
    createMockFromResponse,
    cancelEdit
  } = useMocks();

  // Estado local para controlar a interface
  const [activeTab, setActiveTab] = useState('settings');
  const [isEditing, setIsEditing] = useState(false);
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

  // Manipuladores de eventos
  const handleSelectResponse = async (requestId: string) => {
    await getResponseDetails(requestId);
  };

  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    clearCurrentResponse();
  };

  const handleCreateMock = () => {
    if (currentResponse) {
      // Criar um mock a partir da resposta atual
      const mockData = createMockFromResponse(currentResponse);

      // Adicionar o mock à lista de mocks
      saveMock({
        urlPattern: mockData.urlPattern,
        method: mockData.method,
        status: mockData.status,
        headers: mockData.headers,
        body: mockData.body
      });

      // Mudar para a aba de configuração de mocks
      setActiveTab('mockConfig');
    }
  };

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName);
  };

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
            className={`flex items-center gap-2 text-black ${targetTab.id ? 'bg-green-500 text-white' : ''}`}
            onClick={() => setSelectTabDialogOpen(true)}
            title={targetTab.url}
          >
            <Icon name="tab" />
            {targetTab.id ? targetTab.title.substring(0, 15) + '...' : 'Selecionar Aba'}
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
            <Button
              variant="ghost"
              className={`w-full justify-start nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => handleTabClick('settings')}
            >
              <Icon name="settings" className="mr-2" />
              <span>Configurações</span>
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start nav-item ${activeTab === 'responses' ? 'active' : ''}`}
              onClick={() => handleTabClick('responses')}
            >
              <Icon name="list" className="mr-2" />
              <span>Requisições</span>
              {Object.keys(pendingResponses).length > 0 && (
                <span className="ml-auto bg-gray-200 px-2 rounded-full text-xs badge">
                  {Object.keys(pendingResponses).length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start nav-item ${activeTab === 'mockConfig' ? 'active' : ''}`}
              onClick={() => handleTabClick('mockConfig')}
            >
              <Icon name="build" className="mr-2" />
              <span>Mocks</span>
              {mocks.length > 0 && (
                <span className="ml-auto bg-gray-200 px-2 rounded-full text-xs badge">
                  {mocks.length}
                </span>
              )}
            </Button>
          </nav>
        </div>

        <div className="flex-1 p-4 overflow-auto content-area">
          <div className={`tab-content ${activeTab === 'settings' ? 'active' : 'hidden'}`}>
            <Card className="panel">
              <CardHeader>
                <CardTitle>Configurar interceptação</CardTitle>
              </CardHeader>
              <CardContent className="input-group">
                <UrlForm onAdd={addUrlPattern} />
              </CardContent>
            </Card>

            <Card className="panel">
              <CardHeader>
                <CardTitle>URLs configuradas</CardTitle>
              </CardHeader>
              <CardContent>
                <UrlList urlPatterns={urlPatterns} onRemove={removeUrlPattern} />
              </CardContent>
            </Card>
          </div>

          <div className={`tab-content ${activeTab === 'responses' ? 'active' : 'hidden'}`}>
            <Card className="panel">
              <CardHeader>
                <CardTitle>Requisições interceptadas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponseList
                  responses={pendingResponses}
                  onSelect={handleSelectResponse}
                />
              </CardContent>
            </Card>

            {currentResponse && (
              <Card className="panel response-details mt-4">
                <CardContent>
                  <ResponseDetails
                    response={currentResponse}
                    requestId={currentResponseId}
                    onApprove={approveResponse}
                    onIgnore={ignoreResponse}
                    onMock={handleCreateMock}
                    onEdit={handleEditResponse}
                    onCancel={handleCancelEdit}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className={`tab-content ${activeTab === 'mockConfig' ? 'active' : 'hidden'}`}>
            <Card className="panel">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Configuração de Mocks</CardTitle>
                  <Button
                    className="primary-button flex items-center gap-2"
                    onClick={() => editMock(-1)}
                  >
                    <Icon name="add" />
                    Adicionar Mock
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MockList
                  mocks={mocks}
                  onEdit={editMock}
                  onRemove={removeMock}
                  onToggle={toggleMockEnabled}
                />
              </CardContent>
            </Card>

            {currentEditingMockIndex !== -1 && (
              <Card className="panel mt-4">
                <CardHeader>
                  <CardTitle>Configuração de Mock</CardTitle>
                </CardHeader>
                <CardContent>
                  <MockEditor
                    initialData={currentEditingMockIndex >= 0 ? mocks[currentEditingMockIndex] : undefined}
                    onSave={saveMock}
                    onCancel={cancelEdit}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Inicializar a aplicação React
document.addEventListener('DOMContentLoaded', () => {
  // Criar o container para o React
  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);

  // Renderizar o componente React
  const root = ReactDOM.createRoot(container);
  root.render(<MainApp />);
});
