import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ResponseList from '../components/ResponseList';
import ResponseDetails from '../components/ResponseDetails';
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

      // Navegar para a página de mocks
      navigate('/mocks');
    }
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
    </>
  );
};

export default Requests;
