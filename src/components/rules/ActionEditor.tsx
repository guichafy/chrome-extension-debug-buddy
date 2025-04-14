import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Action, MockAction } from '@/types/rules';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ActionEditorProps {
  action: Action;
  onChange: (action: Action) => void;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({
  action,
  onChange
}) => {
  const [activeTab, setActiveTab] = useState<string>('response');
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Renderizar editor específico para cada tipo de ação
  const renderActionEditor = () => {
    switch (action.type) {
      case 'mock':
        return renderMockActionEditor(action as MockAction);
      case 'delay':
        return renderDelayActionEditor(action);
      case 'modify':
        return renderModifyActionEditor(action);
      default:
        return null;
    }
  };

  // Editor para ação de mock
  const renderMockActionEditor = (mockAction: MockAction) => {
    // Adicionar um novo header
    const addHeader = () => {
      if (!headerName.trim() || !headerValue.trim()) return;
      
      const newHeaders = {
        ...mockAction.headers,
        [headerName.trim()]: headerValue.trim()
      };
      
      onChange({
        ...mockAction,
        headers: newHeaders
      });
      
      setHeaderName('');
      setHeaderValue('');
    };

    // Remover um header
    const removeHeader = (name: string) => {
      const newHeaders = { ...mockAction.headers };
      delete newHeaders[name];
      
      onChange({
        ...mockAction,
        headers: newHeaders
      });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="font-medium">Tipo de Resposta</Label>
          <Select
            value={mockAction.type}
            onValueChange={(value: 'mock') => {
              onChange({
                ...mockAction,
                type: value
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Mock Response</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="response" className="flex-1">Resposta</TabsTrigger>
            <TabsTrigger value="headers" className="flex-1">Headers</TabsTrigger>
            <TabsTrigger value="body" className="flex-1">Body</TabsTrigger>
          </TabsList>

          <TabsContent value="response" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status Code</Label>
                <Input
                  type="number"
                  value={mockAction.status}
                  onChange={(e) => {
                    const status = parseInt(e.target.value);
                    if (!isNaN(status)) {
                      onChange({
                        ...mockAction,
                        status
                      });
                    }
                  }}
                  placeholder="200"
                />
              </div>
              <div>
                <Label>Content-Type</Label>
                <Input
                  value={mockAction.contentType}
                  onChange={(e) => {
                    onChange({
                      ...mockAction,
                      contentType: e.target.value
                    });
                  }}
                  placeholder="application/json"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="headers" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Header</Label>
                <Input
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  placeholder="Content-Type"
                />
              </div>
              <div>
                <Label>Valor do Header</Label>
                <div className="flex space-x-2">
                  <Input
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder="application/json"
                  />
                  <Button
                    type="button"
                    onClick={addHeader}
                    disabled={!headerName.trim() || !headerValue.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-md p-3 bg-background">
              <h4 className="text-sm font-medium mb-2">Headers Configurados</h4>
              {Object.keys(mockAction.headers).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(mockAction.headers).map(([name, value]) => (
                    <div key={name} className="flex justify-between items-center p-2 bg-muted rounded-md">
                      <div>
                        <span className="font-medium">{name}:</span> {value}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHeader(name)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <span className="sr-only">Remover</span>
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum header configurado</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="body" className="space-y-4">
            <div>
              <Label>Corpo da Resposta</Label>
              <Textarea
                value={mockAction.body}
                onChange={(e) => {
                  onChange({
                    ...mockAction,
                    body: e.target.value
                  });
                }}
                placeholder='{"success": true, "message": "Resposta mockada"}'
                className="font-mono h-64"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Editor para ação de delay (placeholder para futuras implementações)
  const renderDelayActionEditor = (delayAction: Action) => (
    <div className="space-y-4">
      <div>
        <Label className="font-medium">Tipo de Ação</Label>
        <Select
          value={delayAction.type}
          onValueChange={(value: 'mock') => {
            onChange({
              type: value,
              enabled: true,
              status: 200,
              headers: {},
              body: '{"success": true, "message": "Resposta mockada"}',
              contentType: 'application/json'
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mock">Mock Response</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Apenas o tipo "Mock Response" está disponível nesta versão.
      </p>
    </div>
  );

  // Editor para ação de modificação (placeholder para futuras implementações)
  const renderModifyActionEditor = (modifyAction: Action) => (
    <div className="space-y-4">
      <div>
        <Label className="font-medium">Tipo de Ação</Label>
        <Select
          value={modifyAction.type}
          onValueChange={(value: 'mock') => {
            onChange({
              type: value,
              enabled: true,
              status: 200,
              headers: {},
              body: '{"success": true, "message": "Resposta mockada"}',
              contentType: 'application/json'
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mock">Mock Response</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Apenas o tipo "Mock Response" está disponível nesta versão.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderActionEditor()}
    </div>
  );
};
