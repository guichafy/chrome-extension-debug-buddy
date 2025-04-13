import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from './ui/dialog';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { InterceptedResponse, ResponseModifications } from '../hooks/useResponses';

interface ResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: InterceptedResponse | null;
  requestId: string | null;
  onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
  onIgnore: (requestId: string) => Promise<boolean>;
  onMock: (response: InterceptedResponse) => void;
  onEdit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  readOnly?: boolean;
}

const ResponseDialog: React.FC<ResponseDialogProps> = ({
  open,
  onOpenChange,
  response,
  requestId,
  onApprove,
  onIgnore,
  onMock,
  onEdit,
  onCancel,
  isEditing,
  readOnly = false
}) => {
  const [status, setStatus] = React.useState('');
  const [headers, setHeaders] = React.useState('');
  const [body, setBody] = React.useState('');

  React.useEffect(() => {
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
      onOpenChange(false);
    }
  };

  const handleIgnore = async () => {
    if (!requestId) return;
    const success = await onIgnore(requestId);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleMock = () => {
    if (!response) return;
    onMock(response);
    onOpenChange(false);
  };

  const handleEdit = () => {
    onEdit();
  };

  const handleCancel = () => {
    if (response) {
      setStatus(response.status.toString());
      setHeaders(JSON.stringify(response.headers, null, 2));
      setBody(response.body || '');
    }
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes da Requisição</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-start mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <p className="flex items-center gap-1">
                <span className="font-medium">URL:</span>
                <span className="truncate max-w-[300px]">{response.url}</span>
              </p>
              <p className="flex items-center gap-1">
                <span className="font-medium">Método:</span>
                <Badge variant="outline">{response.method || 'GET'}</Badge>
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1">
                <span className="font-medium">Tipo:</span>
                <span>{response.type}</span>
              </p>
              <p className="flex items-center gap-1">
                <span className="font-medium">MIME Type:</span>
                <span>{response.mimeType}</span>
              </p>
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

            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handleIgnore}
              >
                <Icon name="close" className="h-4 w-4" />
                <span className="hidden sm:inline">Ignorar</span>
              </Button>
            )}

            {!readOnly && (
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
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="response" className="w-full h-full flex flex-col">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="response">Status</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="response" className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="responseStatus" className="block text-sm font-medium mb-1">Status Code</label>
                    <Input
                      type="text"
                      id="responseStatus"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={!isEditing || readOnly}
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

              <TabsContent value="headers" className="h-full">
                <div className="h-full">
                  <label htmlFor="responseHeaders" className="block text-sm font-medium mb-1">Headers (JSON)</label>
                  <ScrollArea className="h-[300px] border rounded-md">
                    <textarea
                      id="responseHeaders"
                      value={headers}
                      onChange={(e) => setHeaders(e.target.value)}
                      className="w-full p-3 font-mono text-sm min-h-[300px] focus:outline-none"
                      disabled={!isEditing || readOnly}
                    />
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="body" className="h-full">
                <div className="h-full">
                  <label htmlFor="responseBody" className="block text-sm font-medium mb-1">Body</label>
                  <ScrollArea className="h-[300px] border rounded-md">
                    <textarea
                      id="responseBody"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full p-3 font-mono text-sm min-h-[300px] focus:outline-none"
                      disabled={!isEditing || readOnly}
                    />
                  </ScrollArea>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          {!readOnly ? (
            <>
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
            </>
          ) : null}

          <DialogClose asChild>
            <Button variant="outline" size="sm">
              <Icon name="close" className="h-4 w-4 mr-2" />
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResponseDialog;
