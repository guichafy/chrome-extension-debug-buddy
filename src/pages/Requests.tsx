import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ResponseList from '../components/ResponseList';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useMocks } from '../hooks/useMocks';
import { useNavigate, useLocation } from 'react-router-dom';
import { indexedDBService } from '../services/indexedDB';
import CustomTabs from '../components/CustomTabs';

const Requests: React.FC = () => {
  // Estado para controlar a inicialização do IndexedDB
  const [dbStatus, setDbStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');

  // Inicializar o IndexedDB quando o componente for montado
  useEffect(() => {
    const initDB = async () => {
      try {
        await indexedDBService.init();
        setDbStatus('ready');
      } catch (error) {
        console.error('Erro ao inicializar IndexedDB:', error);
        setDbStatus('error');
      }
    };

    initDB();
  }, []);
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
    filteredRequests,
    currentRequestId,
    currentRequest,
    getRequestDetails,
    filter,
    setFilter,
    pauseAutoRefresh,
    enableAutoRefresh,
    autoRefreshEnabled,
    dbInitialized
  } = useAllRequests();

  const { createMockFromResponse, saveMock } = useMocks();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('intercepted');
  const location = useLocation();
  const isInitialMount = useRef(true);

  // Resetar estados quando o componente é montado
  useEffect(() => {
    // Resetar estados
    setIsEditing(false);
    setDialogOpen(false);

    // Limpar quaisquer seleções anteriores
    if (!isInitialMount.current) {
      clearCurrentResponse();
    }
    isInitialMount.current = false;
  }, [clearCurrentResponse]); // Executar apenas na montagem do componente

  // Ouvir o evento personalizado de mudança de rota
  useEffect(() => {
    const handleRouteChange = (event: Event) => {
      // Resetar estados quando a rota muda
      setActiveTab('intercepted');
      setIsEditing(false);
      setDialogOpen(false);
      clearCurrentResponse();

      console.log('Requests: Evento de mudança de rota detectado, resetando estado');
    };

    const handleForceRemount = (event: Event) => {
      // Resetar estados quando ocorre uma remontagem forçada
      setActiveTab('intercepted');
      setIsEditing(false);
      setDialogOpen(false);
      clearCurrentResponse();

      console.log('Requests: Evento de remontagem forçada detectado, resetando estado');
    };

    window.addEventListener('route-changed', handleRouteChange);
    window.addEventListener('force-remount', handleForceRemount);

    // Resetar para a aba intercepted imediatamente após a montagem
    setActiveTab('intercepted');

    return () => {
      window.removeEventListener('route-changed', handleRouteChange);
      window.removeEventListener('force-remount', handleForceRemount);
    };
  }, [clearCurrentResponse]);

  // Função para lidar com a mudança de aba
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    console.log('Aba alterada para:', value);

    // Se a aba for alterada para "all" (Histórico), adicionar uma classe ao body
    // para indicar que estamos na aba de histórico
    if (value === 'all') {
      document.body.classList.add('history-tab-active');
    } else {
      document.body.classList.remove('history-tab-active');
    }
  };

  // Remover a classe quando o componente for desmontado
  useEffect(() => {
    return () => {
      document.body.classList.remove('history-tab-active');
    };
  }, []);

  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (activeTab === 'intercepted') {
      clearCurrentResponse();
    }
  };

  const handleCreateMock = () => {
    const response = activeTab === 'intercepted' ? currentResponse : currentRequest;

    if (response) {
      // Criar um mock a partir da resposta atual
      const mockData = createMockFromResponse(response);

      // Adicionar o mock à lista de mocks
      saveMock({
        urlPattern: mockData.urlPattern,
        method: mockData.method,
        status: mockData.status,
        headers: mockData.headers,
        body: mockData.body
      });

      // Navegar para a página de mocks
      navigate('/mocks');
    }
  };

  const handleSelectResponse = async (requestId: string) => {
    if (activeTab === 'intercepted') {
      await getResponseDetails(requestId);
    } else {
      await getRequestDetails(requestId);
    }
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Requisições</CardTitle>
            {/* {dbStatus === 'ready' && dbInitialized && (
              <Badge variant="outline" className="ml-2">
                Database - Ready
              </Badge>
            )} */}
          </div>
        </CardHeader>
        <CardContent>
          <CustomTabs defaultValue="intercepted" onTabChange={handleTabChange} className="w-full">
            <CustomTabs.List>
              <CustomTabs.Trigger value="intercepted">Interceptadas</CustomTabs.Trigger>
              <CustomTabs.Trigger value="all">Histórico</CustomTabs.Trigger>
            </CustomTabs.List>

            <CustomTabs.Content value="intercepted">
              <CardDescription className="mb-4">
                Requisições interceptadas que estão aguardando aprovação ou modificação antes de serem enviadas ao navegador.
              </CardDescription>
              <ResponseList
                responses={pendingResponses}
                onSelect={handleSelectResponse}
                onIgnore={ignoreResponse}
              />
            </CustomTabs.Content>

            <CustomTabs.Content value="all">
              <CardDescription className="mb-4">
                Histórico de todas as requisições capturadas enquanto o debugger estava ativo, incluindo as interceptadas e as apenas observadas.
              </CardDescription>
              <RequestTable
                requests={filteredRequests}
                onSelect={handleSelectResponse}
                searchValue={filter}
                onSearchChange={setFilter}
                pauseAutoRefresh={pauseAutoRefresh}
                enableAutoRefresh={enableAutoRefresh}
                autoRefreshEnabled={autoRefreshEnabled}
              />
            </CustomTabs.Content>
          </CustomTabs>
        </CardContent>
      </Card>

      <ResponseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        response={activeTab === 'intercepted' ? currentResponse : currentRequest}
        requestId={activeTab === 'intercepted' ? currentResponseId : currentRequestId}
        onApprove={approveResponse}
        onIgnore={ignoreResponse}
        onMock={handleCreateMock}
        onEdit={handleEditResponse}
        onCancel={handleCancelEdit}
        isEditing={isEditing}
        readOnly={activeTab === 'all'}
      />
    </>
  );
};

export default Requests;
