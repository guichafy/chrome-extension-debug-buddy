import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ResponseList from '../components/ResponseList';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
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

  const { createMockFromResponse, saveMock } = useMocks();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    clearCurrentResponse();
  };

  const handleCreateMock = () => {
    if (currentResponse) {
      // Create a mock from the current response
      const mockData = createMockFromResponse(currentResponse);

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

  const handleSelectResponse = async (requestId: string) => {
    await getResponseDetails(requestId);
    setDialogOpen(true);
  };

  return (
    <>
      {/* Intercepted requests card */}
      <Card className="panel">
        <CardHeader>
          <CardTitle>Requisições Interceptadas</CardTitle>
          <CardDescription>
            Requisições interceptadas que estão aguardando aprovação ou modificação antes de serem enviadas ao navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponseList
            responses={pendingResponses}
            onSelect={handleSelectResponse}
            onIgnore={ignoreResponse}
          />
        </CardContent>
      </Card>

      <ResponseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        response={currentResponse}
        requestId={currentResponseId}
        onApprove={approveResponse}
        onIgnore={ignoreResponse}
        onMock={handleCreateMock}
        onEdit={handleEditResponse}
        onCancel={handleCancelEdit}
        isEditing={isEditing}
        readOnly={false}
      />
    </>
  );
};

export default Requests;
