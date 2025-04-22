import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useAllRequests } from '../hooks/useAllRequests';
import { useResponses } from '../hooks/useResponses';
import { useRules } from '../hooks/useRules';
import { useLocation } from 'react-router-dom';
import { Matcher, MockAction } from '../types/rules';
import { indexedDBService } from '../services/indexedDB';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    clearAllRequests,
  } = useAllRequests();

  const { addRule } = useRules();
  const [isEditing, setIsEditing] = useState(false);
  const [ruleCreated, setRuleCreated] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleEditResponse = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleClearHistory = async () => {
    try {
      const success = await clearAllRequests();
      if (success) {
        // Fechar o diálogo
        setClearDialogOpen(false);
      } else {
        console.error('Falha ao limpar histórico de requisições');
      }
    } catch (error) {
      console.error('Erro ao limpar histórico de requisições:', error);
    }
  };

  const handleCreateMock = async () => {
    if (currentRequest) {
      try {
        // Extrair o URL base da requisição para o mock
        const url = currentRequest.url;
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
            method: currentRequest.method || 'GET'
          }
        ];

        // Criar ação de mock
        const mockAction: MockAction = {
          type: 'mock',
          enabled: true,
          status: currentRequest.status,
          headers: currentRequest.headers || {},
          body: currentRequest.body || '',
          contentType: currentRequest.mimeType || 'application/json'
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
              onClearHistory={() => setClearDialogOpen(true)}
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
        ruleCreated={ruleCreated}
      />

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente todas as requisições do histórico.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-red-500 hover:bg-red-600">
              Limpar histórico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RequestHistory;
