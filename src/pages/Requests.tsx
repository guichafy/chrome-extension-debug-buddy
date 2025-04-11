import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ResponseList from '../components/ResponseList';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
import { useMocks } from '../hooks/useMocks';
import { useNavigate } from 'react-router-dom';

const Requests: React.FC = () => {
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

      // Navegar para a página de mocks
      navigate('/mocks');
    }
  };

  const handleSelectResponse = async (requestId: string) => {
    await getResponseDetails(requestId);
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="panel">
        <CardHeader>
          <CardTitle>Requisições interceptadas</CardTitle>
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
      />
    </>
  );
};

export default Requests;
