import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ResponseList from '../components/ResponseList';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useMocks } from '../hooks/useMocks';
import { useNavigate, useLocation } from 'react-router-dom';
import { indexedDBService } from '../services/indexedDB';

const Requests: React.FC = () => {
  // Use location to force re-render when route changes
  const location = useLocation();

  // Log para debug
  React.useEffect(() => {
    console.log('Requests component rendered, path:', location.pathname);
  }, [location]);
  // Initialize IndexedDB when component mounts
  useEffect(() => {
    const initDB = async () => {
      try {
        await indexedDBService.init();
        // Database initialized successfully
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
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
    // dbInitialized is not used
  } = useAllRequests();

  const { createMockFromResponse, saveMock } = useMocks();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState<'intercepted' | 'all'>('intercepted');

  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (activeView === 'intercepted') {
      clearCurrentResponse();
    }
  };

  const handleCreateMock = () => {
    const response = activeView === 'intercepted' ? currentResponse : currentRequest;

    if (response) {
      // Create a mock from the current response
      const mockData = createMockFromResponse(response);

      // Add the mock to the mocks list
      saveMock({
        urlPattern: mockData.urlPattern,
        method: mockData.method,
        status: mockData.status,
        headers: mockData.headers,
        body: mockData.body
      });

      // Navigate to the mocks page
      navigate('/mocks');
    }
  };

  const handleSelectResponse = async (requestId: string, view: 'intercepted' | 'all') => {
    setActiveView(view);
    if (view === 'intercepted') {
      await getResponseDetails(requestId);
    } else {
      await getRequestDetails(requestId);
    }
    setDialogOpen(true);
  };

  return (
    <>
      {/* Intercepted requests card */}
      <Card className="panel mb-6">
        <CardHeader>
          <CardTitle>Requisições Interceptadas</CardTitle>
          <CardDescription>
            Requisições interceptadas que estão aguardando aprovação ou modificação antes de serem enviadas ao navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponseList
            responses={pendingResponses}
            onSelect={(requestId) => {
              handleSelectResponse(requestId, 'intercepted');
            }}
            onIgnore={ignoreResponse}
          />
        </CardContent>
      </Card>

      {/* Card de histórico de requisições - simplificado */}
      <Card className="panel">
        <CardHeader>
          <CardTitle>Histórico de Requisições</CardTitle>
          <CardDescription>
            Histórico de todas as requisições capturadas enquanto o debugger estava ativo, incluindo as interceptadas e as apenas observadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(filteredRequests || {}).length > 0 ? (
            <RequestTable
              requests={filteredRequests}
              onSelect={(requestId) => {
                handleSelectResponse(requestId, 'all');
              }}
              searchValue={filter}
              onSearchChange={setFilter}
              pauseAutoRefresh={pauseAutoRefresh}
              enableAutoRefresh={enableAutoRefresh}
              autoRefreshEnabled={autoRefreshEnabled}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma requisição encontrada no histórico.
            </div>
          )}
        </CardContent>
      </Card>

      <ResponseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        response={activeView === 'intercepted' ? currentResponse : currentRequest}
        requestId={activeView === 'intercepted' ? currentResponseId : currentRequestId}
        onApprove={approveResponse}
        onIgnore={ignoreResponse}
        onMock={handleCreateMock}
        onEdit={handleEditResponse}
        onCancel={handleCancelEdit}
        isEditing={isEditing}
        readOnly={activeView === 'all'}
      />
    </>
  );
};

export default Requests;
