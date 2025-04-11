import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import RuleDialog from './components/RuleDialog';
import RuleList from './components/RuleList';
import ResponseList from './components/ResponseList';
import ResponseDialog from './components/ResponseDialog';
import { useUrlPatterns } from './hooks/useUrlPatterns';
import { useDebugging } from './hooks/useDebugging';
import { useResponses } from './hooks/useResponses';
import { useMocks } from './hooks/useMocks';

const PopupApp: React.FC = () => {
  // Hooks para gerenciar o estado da aplicação
  const { urlPatterns, addUrlPattern, removeUrlPattern } = useUrlPatterns();
  const { isDebugging, startDebugging, stopDebugging } = useDebugging();
  const {
    pendingResponses,
    currentResponseId,
    currentResponse,
    getResponseDetails,
    approveResponse,
    ignoreResponse,
    clearCurrentResponse
  } = useResponses();
  const { createMockFromResponse } = useMocks();

  // Estado local para controlar a edição de respostas e criação de regras
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // Manipuladores de eventos
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectResponse = async (requestId: string) => {
    await getResponseDetails(requestId);
    setDialogOpen(true);
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
      const mockData = createMockFromResponse(currentResponse);
      // Aqui você pode navegar para a página de mocks ou abrir um modal
      alert('Mock criado com sucesso! Acesse a página principal para editá-lo.');
    }
  };

  return (
    <div className="container p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Network Request Interceptor</CardTitle>
          <CardDescription>Intercept and modify network requests</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="settings" className="tab-container">
        <TabsList className="w-full mb-4 tabs">
          <TabsTrigger value="settings" className="tab-button" data-tab="settings">Settings</TabsTrigger>
          <TabsTrigger value="responses" className="tab-button" data-tab="responses">Pending Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="tab-content">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Configure Interception</CardTitle>
                <CardDescription>Add URL patterns to intercept</CardDescription>
              </div>
              <Button
                onClick={() => setIsCreatingRule(true)}
                className="primary-button flex items-center gap-2"
              >
                <Icon name="add" />
                Add Rule
              </Button>
            </CardHeader>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>URLs to intercept</CardTitle>
            </CardHeader>
            <CardContent>
              <RuleList urlPatterns={urlPatterns} onRemove={removeUrlPattern} />
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                {!isDebugging ? (
                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    onClick={() => startDebugging()}
                  >
                    <Icon name="play_arrow" />
                    Start Debugging
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="flex items-center gap-2"
                    onClick={() => stopDebugging()}
                  >
                    <Icon name="stop" />
                    Stop Debugging
                  </Button>
                )}
              </div>
              <div>
                <p>Status: <span className="font-medium">{isDebugging ? 'Active' : 'Not debugging'}</span></p>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="tab-content">
          <Card>
            <CardHeader>
              <CardTitle>Pending Responses</CardTitle>
              <CardDescription>Responses waiting for approval</CardDescription>
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
        </TabsContent>
      </Tabs>

      {/* Modal para criação de regra */}
      <RuleDialog
        open={isCreatingRule}
        mode="create"
        onOpenChange={(open) => {
          if (!open) setIsCreatingRule(false);
        }}
        onSave={async (newRule) => {
          const success = await addUrlPattern(
            newRule.url,
            newRule.method,
            newRule.headerName || '',
            newRule.headerValue || '',
            newRule.headerType || 'request',
            newRule.isRegex || false
          );
          if (success) setIsCreatingRule(false);
          return success;
        }}
      />
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
  root.render(<PopupApp />);
});
