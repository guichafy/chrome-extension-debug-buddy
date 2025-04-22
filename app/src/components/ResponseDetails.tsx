import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { InterceptedResponse, ResponseModifications } from '../hooks/useResponses';

interface ResponseDetailsProps {
  response: InterceptedResponse | null;
  requestId: string | null;
  onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
  onIgnore: (requestId: string) => Promise<boolean>;
  onMock: (response: InterceptedResponse) => void;
  onEdit: () => void;
  onCancel: () => void;
}

const ResponseDetails: React.FC<ResponseDetailsProps> = ({
  response,
  requestId,
  onApprove,
  onIgnore,
  onMock,
  onEdit,
  onCancel
}) => {
  const [status, setStatus] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (response) {
      setStatus(response.status.toString());
      setHeaders(JSON.stringify(response.headers, null, 2));
      setBody(response.body || '');
    }
  }, [response]);

  if (!response || !requestId) {
    return null;
  }

  const handleApprove = async () => {
    if (!requestId) return;

    const modifications: ResponseModifications = {};

    if (isEditing) {
      // Adicionar modificações se estiver editando
      // Garantir que o status code seja um número válido
      if (status && status.trim() !== '') {
        const statusNumber = parseInt(status, 10);
        if (!isNaN(statusNumber)) {
          console.log(`ResponseDetails - Status input: ${status}, parsed: ${statusNumber}, type: ${typeof statusNumber}`);
          modifications.status = statusNumber;
        } else {
          alert('Status code inválido. Deve ser um número.');
          return;
        }
      }

      try {
        modifications.headers = JSON.parse(headers);
      } catch (e) {
        alert('Formato de headers inválido. Deve ser um objeto JSON válido.');
        return;
      }

      modifications.body = body;
    }

    const success = await onApprove(requestId, modifications);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleIgnore = async () => {
    if (!requestId) return;
    await onIgnore(requestId);
  };

  const handleMock = () => {
    if (!response) return;
    onMock(response);
  };

  const handleEdit = () => {
    setIsEditing(true);
    onEdit();
  };

  const handleCancel = () => {
    if (response) {
      setStatus(response.status.toString());
      setHeaders(JSON.stringify(response.headers, null, 2));
      setBody(response.body || '');
    }
    setIsEditing(false);
    onCancel();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Detalhes da Requisição</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-medium">URL:</span>
                    <span className="truncate">{response.url}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Método:</span>
                    <Badge variant="outline" className="text-xs">{response.method || 'GET'}</Badge>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-medium">Tipo:</span>
                    <span>{response.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">MIME Type:</span>
                    <span>{response.mimeType}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handleMock}
              >
                <Icon name="content_copy" className="h-4 w-4" />
                <span className="hidden sm:inline">Criar Mock</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handleIgnore}
              >
                <Icon name="close" className="h-4 w-4" />
                <span className="hidden sm:inline">Ignorar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handleEdit}
                disabled={isEditing}
              >
                <Icon name="edit" className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="response" className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="response">Status</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
            </TabsList>

            <TabsContent value="response" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="responseStatus" className="block text-sm font-medium mb-1">Status Code</label>
                  <Input
                    type="text"
                    id="responseStatus"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={!isEditing}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="responseStatusText" className="block text-sm font-medium mb-1">Status Text</label>
                  <Input
                    type="text"
                    id="responseStatusText"
                    value={response.statusText}
                    disabled={true}
                    className="font-mono"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div>
                <label htmlFor="responseHeaders" className="block text-sm font-medium mb-1">Headers (JSON)</label>
                <ScrollArea className="h-[300px] border rounded-md">
                  <textarea
                    id="responseHeaders"
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    className="w-full p-3 font-mono text-sm min-h-[300px] focus:outline-none"
                    disabled={!isEditing}
                  />
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="body" className="space-y-4">
              <div>
                <label htmlFor="responseBody" className="block text-sm font-medium mb-1">Body</label>
                <ScrollArea className="h-[400px] border rounded-md">
                  <textarea
                    id="responseBody"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full p-3 font-mono text-sm min-h-[400px] focus:outline-none"
                    disabled={!isEditing}
                  />
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex space-x-2 mt-6">
            <Button
              className="flex items-center gap-2"
              onClick={handleApprove}
            >
              <Icon name="check" className="h-4 w-4" />
              {isEditing ? 'Salvar e Aprovar' : 'Aprovar'}
            </Button>

            {isEditing && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleCancel}
              >
                <Icon name="cancel" className="h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResponseDetails;
