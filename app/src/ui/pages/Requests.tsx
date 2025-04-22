import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/components/shadcn/card';
import ResponseList from '../components/ResponseList';
import ResponseDialog from '../components/ResponseDialog';
import { useResponses } from '../hooks/useResponses';
import { useRules } from '../hooks/useRules';
import { useLocation } from 'react-router-dom';
import { Matcher, MockAction } from '@/backend/types/rules';
import { indexedDBService } from '@/backend/services/indexedDB';

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

  const { addRule } = useRules();
  const [isEditing, setIsEditing] = useState(false);
  const [ruleCreated, setRuleCreated] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    clearCurrentResponse();
  };

  const handleCreateMock = async () => {
    if (currentResponse) {
      try {
        // Extrair o URL base da requisição para o mock
        const url = currentResponse.url;
        const urlObj = new URL(url);
        const urlPattern = urlObj.hostname + urlObj.pathname;

        // Criar matchers para a regra
        const matchers: Matcher[] = [
          {
            type: 'url',
            enabled: true,
            pattern: urlPattern,
            isRegex: false
          },
          {
            type: 'method',
            enabled: true,
            method: currentResponse.method || 'GET'
          }
        ];

        // Criar ação de mock
        const mockAction: MockAction = {
          type: 'mock',
          enabled: true,
          status: currentResponse.status,
          headers: currentResponse.headers || {},
          body: currentResponse.body || '',
          contentType: currentResponse.mimeType || 'application/json'
        };

        // Adicionar a regra
        const success = await addRule(
          `Mock para ${urlPattern}`,
          matchers,
          mockAction
        );

        if (success) {
          setRuleCreated(true);
          // Fechar o diálogo após criar a regra
          setTimeout(() => {
            setDialogOpen(false);
            setRuleCreated(false);
          }, 1500);
        }
      } catch (error) {
        console.error('Erro ao criar regra de mock:', error);
      }
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
        ruleCreated={ruleCreated}
      />
    </>
  );
};

export default Requests;
