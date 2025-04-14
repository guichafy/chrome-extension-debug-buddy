import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useAllRequests } from '../hooks/useAllRequests';
import { useResponses } from '../hooks/useResponses';
import { useMocks } from '../hooks/useMocks';
import { useNavigate, useLocation } from 'react-router-dom';
import { indexedDBService } from '../services/indexedDB';

const RequestHistory: React.FC = () => {
  // Use location to force re-render when route changes
  const location = useLocation();

  // Log para debug
  React.useEffect(() => {
    console.log('RequestHistory component rendered, path:', location.pathname);
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
  } = useAllRequests();

  const { createMockFromResponse, saveMock } = useMocks();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleCreateMock = () => {
    if (currentRequest) {
      // Create a mock from the current response
      const mockData = createMockFromResponse(currentRequest);

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

  const handleSelectRequest = async (requestId: string) => {
    await getRequestDetails(requestId);
    setDialogOpen(true);
  };

  return (
    <>
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
              onSelect={handleSelectRequest}
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
        response={currentRequest}
        requestId={currentRequestId}
        onApprove={() => Promise.resolve(false)}
        onIgnore={ignoreResponse}
        onMock={handleCreateMock}
        onEdit={handleEditResponse}
        onCancel={handleCancelEdit}
        isEditing={isEditing}
        readOnly={true}
      />
    </>
  );
};

export default RequestHistory;
