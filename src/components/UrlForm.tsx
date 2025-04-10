import React, { useState } from 'react';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

interface UrlFormProps {
  onAdd: (
    urlPattern: string,
    httpMethod: string,
    headerName: string,
    headerValue: string,
    headerType: string
  ) => Promise<boolean>;
}

const UrlForm: React.FC<UrlFormProps> = ({ onAdd }) => {
  const [urlPattern, setUrlPattern] = useState('');
  const [httpMethod, setHttpMethod] = useState('ANY');
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [headerType, setHeaderType] = useState('request');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onAdd(
      urlPattern.trim(),
      httpMethod,
      headerName.trim(),
      headerValue.trim(),
      headerType
    );
    
    if (success) {
      // Limpar os campos
      setUrlPattern('');
      setHttpMethod('ANY');
      setHeaderName('');
      setHeaderValue('');
      setHeaderType('request');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div>
          <label htmlFor="urlPattern" className="block text-sm font-medium mb-1">Padrão de URL</label>
          <input
            type="text"
            id="urlPattern"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="Exemplo: api.exemplo.com/endpoint"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        <div className="flex gap-4">
          <div className="w-1/3">
            <label htmlFor="httpMethod" className="block text-sm font-medium mb-1">Método HTTP</label>
            <select
              id="httpMethod"
              value={httpMethod}
              onChange={(e) => setHttpMethod(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="ANY">Qualquer método</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>
          
          <div className="w-2/3">
            <label htmlFor="headerType" className="block text-sm font-medium mb-1">Tipo de Header</label>
            <select
              id="headerType"
              value={headerType}
              onChange={(e) => setHeaderType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="request">Request</option>
              <option value="response">Response</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="w-1/2">
            <label htmlFor="headerName" className="block text-sm font-medium mb-1">Nome do Header</label>
            <input
              type="text"
              id="headerName"
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              placeholder="Content-Type"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="w-1/2">
            <label htmlFor="headerValue" className="block text-sm font-medium mb-1">Valor do Header</label>
            <input
              type="text"
              id="headerValue"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="application/json"
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>
      
      <Button type="submit" className="primary-button flex items-center gap-2">
        <Icon name="add" />
        Adicionar URL
      </Button>
    </form>
  );
};

export default UrlForm;
