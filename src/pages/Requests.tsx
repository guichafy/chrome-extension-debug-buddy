import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ResponseList from '../components/ResponseList';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useMocks } from '../hooks/useMocks';
import { useNavigate } from 'react-router-dom';
import { indexedDBService } from '../services/indexedDB';

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
    autoRefreshEnabled,
    dbInitialized
  } = useAllRequests();

  const { createMockFromResponse, saveMock } = useMocks();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('intercepted');

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
            {dbStatus === 'ready' && dbInitialized && (
              <Badge variant="outline" className="ml-2">
                IndexedDB Ativo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="intercepted">Interceptadas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>

            <TabsContent value="intercepted">
              <CardDescription className="mb-4">
                Requisições interceptadas que estão aguardando aprovação ou modificação antes de serem enviadas ao navegador.
              </CardDescription>
              <ResponseList
                responses={pendingResponses}
                onSelect={handleSelectResponse}
                onIgnore={ignoreResponse}
              />
            </TabsContent>

            <TabsContent value="all">
              <CardDescription className="mb-4">
                Todas as requisições capturadas enquanto o debugger estava ativo, incluindo as interceptadas e as apenas observadas.
              </CardDescription>
              <RequestTable
                requests={filteredRequests}
                onSelect={handleSelectResponse}
                searchValue={filter}
                onSearchChange={setFilter}
                pauseAutoRefresh={pauseAutoRefresh}
                autoRefreshEnabled={autoRefreshEnabled}
              />
            </TabsContent>
          </Tabs>
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
