import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Checkbox } from './ui/checkbox';
import { UrlPattern } from '../hooks/useUrlPatterns';

interface RuleDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  rule?: UrlPattern;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: UrlPattern) => Promise<boolean>;
}

const RuleDialog: React.FC<RuleDialogProps> = ({
  open,
  mode,
  rule,
  onOpenChange,
  onSave
}) => {
  const defaultRule: UrlPattern = {
    url: '',
    method: 'ANY',
    headerName: '',
    headerValue: '',
    headerType: 'request',
    enabled: true
  };

  const currentRule = rule || defaultRule;

  const [urlPattern, setUrlPattern] = useState(currentRule.url || '');
  const [httpMethod, setHttpMethod] = useState(currentRule.method || 'ANY');
  const [headerName, setHeaderName] = useState(currentRule.headerName || '');
  const [headerValue, setHeaderValue] = useState(currentRule.headerValue || '');
  const [headerType, setHeaderType] = useState(currentRule.headerType || 'request');
  const [enabled, setEnabled] = useState(currentRule.enabled !== false); // Default to true if undefined
  const [isRegex, setIsRegex] = useState(currentRule.isRegex || false); // Default to false if undefined
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
      setIsRegex(rule.isRegex || false); // Default to false if undefined
    } else {
      // Reset para valores padrão quando estiver criando uma nova regra
      setUrlPattern('');
      setHttpMethod('ANY');
      setHeaderName('');
      setHeaderValue('');
      setHeaderType('request');
      setEnabled(true);
      setIsRegex(false);
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
        enabled: enabled,
        isRegex: isRegex
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
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Adicionar Nova Regra' : 'Editar Regra'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Configure uma nova regra de interceptação'
              : 'Modifique os detalhes da regra de interceptação'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="grid gap-4">
            <div>
              <div className="mb-1">
                <label htmlFor="editUrlPattern" className="block text-sm font-medium">Padrão de URL</label>
              </div>
              <input
                type="text"
                id="editUrlPattern"
                value={urlPattern}
                onChange={(e) => setUrlPattern(e.target.value)}
                placeholder={isRegex ? "Exemplo: ^https://api\\.exemplo\\.com/.*$" : "Exemplo: api.exemplo.com/endpoint"}
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

            <div className="flex flex-col items-center mt-6">
              <div className="flex gap-8 mb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-regex"
                    checked={isRegex}
                    onCheckedChange={(checked) => setIsRegex(checked === true)}
                  />
                  <label
                    htmlFor="use-regex"
                    className="text-sm font-medium leading-none"
                  >
                    Usar expressão regular
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rule-enabled"
                    checked={enabled}
                    onCheckedChange={(checked) => setEnabled(checked === true)}
                  />
                  <label
                    htmlFor="rule-enabled"
                    className="text-sm font-medium leading-none"
                  >
                    Regra ativa
                  </label>
                </div>
              </div>

              {isRegex && (
                <p className="text-xs text-gray-500 mt-1 max-w-md text-center">
                  Use expressões regulares para interceptar URLs com padrões mais complexos.
                  Exemplo: ^https://api\.exemplo\.com/.* captura todas as URLs que começam com https://api.exemplo.com/
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
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
              <Icon name={mode === 'create' ? 'add' : 'save'} />
            )}
            {mode === 'create' ? 'Adicionar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RuleDialog;
