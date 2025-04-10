import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { UrlPattern } from '../hooks/useUrlPatterns';

interface RuleDialogProps {
  open: boolean;
  rule: UrlPattern;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: UrlPattern) => Promise<boolean>;
}

const RuleDialog: React.FC<RuleDialogProps> = ({ 
  open, 
  rule,
  onOpenChange,
  onSave
}) => {
  const [urlPattern, setUrlPattern] = useState(rule.url || '');
  const [httpMethod, setHttpMethod] = useState(rule.method || 'ANY');
  const [headerName, setHeaderName] = useState(rule.headerName || '');
  const [headerValue, setHeaderValue] = useState(rule.headerValue || '');
  const [headerType, setHeaderType] = useState(rule.headerType || 'request');
  const [enabled, setEnabled] = useState(rule.enabled !== false); // Default to true if undefined
  const [isSaving, setIsSaving] = useState(false);

  // Atualizar o estado quando a regra mudar
  useEffect(() => {
    if (rule) {
      setUrlPattern(rule.url || '');
      setHttpMethod(rule.method || 'ANY');
      setHeaderName(rule.headerName || '');
      setHeaderValue(rule.headerValue || '');
      setHeaderType(rule.headerType || 'request');
      setEnabled(rule.enabled !== false); // Default to true if undefined
    }
  }, [rule]);

  const handleSave = async () => {
    if (!urlPattern.trim()) {
      alert('Por favor, insira um padrão de URL');
      return;
    }

    setIsSaving(true);
    
    try {
      const updatedRule: UrlPattern = {
        url: urlPattern.trim(),
        method: httpMethod,
        enabled: enabled
      };

      // Adicionar header se estiver preenchido
      if (headerName.trim() && headerValue.trim()) {
        updatedRule.headerType = headerType;
        updatedRule.headerName = headerName.trim();
        updatedRule.headerValue = headerValue.trim();
      }

      const success = await onSave(updatedRule);
      
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Regra</DialogTitle>
          <DialogDescription>
            Modifique os detalhes da regra de interceptação
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="grid gap-4">
            <div>
              <label htmlFor="editUrlPattern" className="block text-sm font-medium mb-1">Padrão de URL</label>
              <input
                type="text"
                id="editUrlPattern"
                value={urlPattern}
                onChange={(e) => setUrlPattern(e.target.value)}
                placeholder="Exemplo: api.exemplo.com/endpoint"
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div className="flex gap-4">
              <div className="w-1/3">
                <label htmlFor="editHttpMethod" className="block text-sm font-medium mb-1">Método HTTP</label>
                <select
                  id="editHttpMethod"
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
                <label htmlFor="editHeaderType" className="block text-sm font-medium mb-1">Tipo de Header</label>
                <select
                  id="editHeaderType"
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
                <label htmlFor="editHeaderName" className="block text-sm font-medium mb-1">Nome do Header</label>
                <input
                  type="text"
                  id="editHeaderName"
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  placeholder="Content-Type"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div className="w-1/2">
                <label htmlFor="editHeaderValue" className="block text-sm font-medium mb-1">Valor do Header</label>
                <input
                  type="text"
                  id="editHeaderValue"
                  value={headerValue}
                  onChange={(e) => setHeaderValue(e.target.value)}
                  placeholder="application/json"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Regra ativa</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="primary-button flex items-center gap-2"
          >
            {isSaving ? (
              <span className="animate-spin">
                <Icon name="refresh" />
              </span>
            ) : (
              <Icon name="save" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RuleDialog;
