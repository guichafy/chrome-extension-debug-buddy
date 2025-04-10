import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { MockConfig } from '../hooks/useMocks';

interface MockEditorProps {
  initialData?: Partial<MockConfig>;
  onSave: (mockData: Omit<MockConfig, 'createdAt' | 'enabled'>) => Promise<boolean>;
  onCancel: () => void;
}

const MockEditor: React.FC<MockEditorProps> = ({ initialData, onSave, onCancel }) => {
  const [urlPattern, setUrlPattern] = useState(initialData?.urlPattern || '');
  const [method, setMethod] = useState(initialData?.method || 'GET');
  const [status, setStatus] = useState(initialData?.status?.toString() || '200');
  const [headers, setHeaders] = useState(
    initialData?.headers ? JSON.stringify(initialData.headers, null, 2) : '{}'
  );
  const [body, setBody] = useState(initialData?.body || '');
  const [contentType, setContentType] = useState('json');
  
  useEffect(() => {
    // Detectar tipo de conteúdo com base no corpo
    if (initialData?.body) {
      try {
        JSON.parse(initialData.body);
        setContentType('json');
      } catch (e) {
        if (initialData.body.includes('<html') || initialData.body.includes('<!DOCTYPE')) {
          setContentType('html');
        } else {
          setContentType('text');
        }
      }
    }
  }, [initialData]);
  
  const handleSave = async () => {
    try {
      // Validar campos
      if (!urlPattern.trim()) {
        alert('Por favor, insira um padrão de URL');
        return;
      }
      
      const statusNum = parseInt(status, 10);
      if (isNaN(statusNum) || statusNum < 100 || statusNum > 599) {
        alert('Status inválido. Deve ser um número entre 100 e 599');
        return;
      }
      
      let parsedHeaders;
      try {
        parsedHeaders = JSON.parse(headers);
        if (typeof parsedHeaders !== 'object' || parsedHeaders === null) {
          throw new Error('Headers deve ser um objeto JSON');
        }
      } catch (e) {
        alert('Formato de headers inválido. Deve ser um objeto JSON válido.');
        return;
      }
      
      // Salvar mock
      const success = await onSave({
        urlPattern: urlPattern.trim(),
        method,
        status: statusNum,
        headers: parsedHeaders,
        body
      });
      
      if (success) {
        // Limpar formulário
        setUrlPattern('');
        setMethod('GET');
        setStatus('200');
        setHeaders('{}');
        setBody('');
        setContentType('json');
      }
    } catch (error) {
      console.error('Erro ao salvar mock:', error);
      alert('Erro ao salvar mock');
    }
  };
  
  const formatJson = () => {
    try {
      if (contentType === 'json') {
        const parsed = JSON.parse(body);
        setBody(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      alert('Corpo não é um JSON válido');
    }
  };
  
  const formatHeaders = () => {
    try {
      const parsed = JSON.parse(headers);
      setHeaders(JSON.stringify(parsed, null, 2));
    } catch (e) {
      alert('Headers não é um JSON válido');
    }
  };
  
  const detectContentType = () => {
    try {
      JSON.parse(body);
      setContentType('json');
    } catch (e) {
      if (body.includes('<html') || body.includes('<!DOCTYPE')) {
        setContentType('html');
      } else {
        setContentType('text');
      }
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <label htmlFor="mockUrlPattern" className="block text-sm font-medium mb-1">Padrão de URL</label>
          <input
            type="text"
            id="mockUrlPattern"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="Exemplo: api.exemplo.com/endpoint"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        <div className="flex gap-4">
          <div className="w-1/2">
            <label htmlFor="mockMethod" className="block text-sm font-medium mb-1">Método HTTP</label>
            <select
              id="mockMethod"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>
          
          <div className="w-1/2">
            <label htmlFor="mockStatus" className="block text-sm font-medium mb-1">Status</label>
            <input
              type="text"
              id="mockStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="200"
              className="w-full p-2 border rounded"
              required
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="mockHeaders" className="block text-sm font-medium">Headers</label>
            <button
              type="button"
              className="text-blue-500 text-sm"
              onClick={formatHeaders}
              title="Formatar JSON"
            >
              Formatar
            </button>
          </div>
          <textarea
            id="mockHeaders"
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="w-full p-2 border rounded h-32 font-mono text-sm"
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="mockBody" className="block text-sm font-medium">Body</label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="text-blue-500 text-sm"
                onClick={detectContentType}
                title="Detectar tipo de conteúdo"
              >
                Detectar tipo
              </button>
              <button
                type="button"
                className="text-blue-500 text-sm"
                onClick={formatJson}
                title="Formatar conteúdo"
              >
                Formatar
              </button>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="p-1 border rounded text-sm"
              >
                <option value="json">JSON</option>
                <option value="html">HTML</option>
                <option value="text">Texto</option>
              </select>
            </div>
          </div>
          <textarea
            id="mockBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-2 border rounded h-64 font-mono text-sm"
          />
        </div>
      </div>
      
      <div className="flex space-x-2">
        <Button
          className="primary-button flex items-center gap-2"
          onClick={handleSave}
        >
          <Icon name="save" />
          Salvar Mock
        </Button>
        
        <Button
          variant="outline"
          className="secondary-button flex items-center gap-2"
          onClick={onCancel}
        >
          <Icon name="cancel" />
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default MockEditor;
