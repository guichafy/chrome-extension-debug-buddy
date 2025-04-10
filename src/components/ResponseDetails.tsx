import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
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
      modifications.status = parseInt(status, 10);
      
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
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-medium text-lg mb-2">Detalhes da Resposta</h3>
        <p><strong>URL:</strong> {response.url}</p>
        <p><strong>Tipo:</strong> {response.type}</p>
        <p><strong>MIME Type:</strong> {response.mimeType}</p>
      </div>
      
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          className="secondary-button flex items-center gap-2"
          onClick={handleMock}
        >
          <Icon name="content_copy" />
          Criar Mock
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="secondary-button flex items-center gap-2"
          onClick={handleIgnore}
        >
          <Icon name="close" />
          Ignorar
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="secondary-button flex items-center gap-2"
          onClick={handleEdit}
          disabled={isEditing}
        >
          <Icon name="edit" />
          Editar
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="responseStatus" className="block text-sm font-medium mb-1">Status</label>
          <input
            type="text"
            id="responseStatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={!isEditing}
          />
        </div>
        
        <div>
          <label htmlFor="responseHeaders" className="block text-sm font-medium mb-1">Headers</label>
          <textarea
            id="responseHeaders"
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="w-full p-2 border rounded h-32 font-mono text-sm"
            disabled={!isEditing}
          />
        </div>
        
        <div>
          <label htmlFor="responseBody" className="block text-sm font-medium mb-1">Body</label>
          <textarea
            id="responseBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-2 border rounded h-64 font-mono text-sm"
            disabled={!isEditing}
          />
        </div>
      </div>
      
      <div className="flex space-x-2">
        <Button
          className="primary-button flex items-center gap-2"
          onClick={handleApprove}
        >
          <Icon name="check" />
          {isEditing ? 'Salvar e Aprovar' : 'Aprovar'}
        </Button>
        
        {isEditing && (
          <Button
            variant="outline"
            className="secondary-button flex items-center gap-2"
            onClick={handleCancel}
          >
            <Icon name="cancel" />
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default ResponseDetails;
