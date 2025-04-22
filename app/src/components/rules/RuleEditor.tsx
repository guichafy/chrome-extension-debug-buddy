import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Rule, Matcher, Action, UrlMatcher, MethodMatcher, HeaderMatcher, MockAction } from '@/types/rules';
import { MatcherEditor } from './MatcherEditor';
import { ActionEditor } from './ActionEditor';

interface RuleEditorProps {
  open: boolean;
  mode: 'create' | 'edit';
  rule?: Rule;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  open,
  mode,
  rule,
  onOpenChange,
  onSave
}) => {
  // Estado para a regra sendo editada
  const [name, setName] = useState(rule?.name || 'Nova Regra');
  const [matchers, setMatchers] = useState<Matcher[]>(rule?.matchers || [
    { type: 'url', enabled: true, pattern: '', isRegex: false },
    { type: 'method', enabled: true, method: 'ANY' }
  ]);
  const [action, setAction] = useState<Action>(rule?.action || {
    type: 'mock',
    enabled: true,
    status: 200,
    headers: {},
    body: '{"success": true, "message": "Resposta mockada"}',
    contentType: 'application/json'
  });
  const [enabled, setEnabled] = useState(rule?.enabled !== false);
  const [activeTab, setActiveTab] = useState<'match' | 'then'>('match');
  const [isSaving, setIsSaving] = useState(false);

  // Atualizar o estado quando a regra mudar
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setMatchers(rule.matchers);
      setAction(rule.action);
      setEnabled(rule.enabled);
    } else {
      // Valores padrão para uma nova regra
      setName('Nova Regra');
      setMatchers([
        { type: 'url', enabled: true, pattern: '', isRegex: false },
        { type: 'method', enabled: true, method: 'ANY' }
      ]);
      setAction({
        type: 'mock',
        enabled: true,
        status: 200,
        headers: {},
        body: '{"success": true, "message": "Resposta mockada"}',
        contentType: 'application/json'
      });
      setEnabled(true);
    }
  }, [rule]);

  // Adicionar um novo matcher
  const addMatcher = (type: Matcher['type']) => {
    let newMatcher: Matcher;

    switch (type) {
      case 'url':
        newMatcher = { type: 'url', enabled: true, pattern: '', isRegex: false };
        break;
      case 'method':
        newMatcher = { type: 'method', enabled: true, method: 'ANY' };
        break;
      case 'header':
        newMatcher = { type: 'header', enabled: true, name: '', value: '', headerType: 'request' };
        break;
      case 'body':
        newMatcher = { type: 'body', enabled: true, pattern: '', isRegex: false };
        break;
      default:
        return;
    }

    setMatchers([...matchers, newMatcher]);
  };

  // Remover um matcher
  const removeMatcher = (index: number) => {
    const newMatchers = [...matchers];
    newMatchers.splice(index, 1);
    setMatchers(newMatchers);
  };

  // Atualizar um matcher
  const updateMatcher = (index: number, updatedMatcher: Matcher) => {
    const newMatchers = [...matchers];
    newMatchers[index] = updatedMatcher;
    setMatchers(newMatchers);
  };

  // Atualizar a ação
  const updateAction = (updatedAction: Action) => {
    setAction(updatedAction);
  };

  // Salvar a regra
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Por favor, insira um nome para a regra');
      return;
    }

    // Verificar se há pelo menos um matcher de URL
    const hasUrlMatcher = matchers.some(m => m.type === 'url');
    if (!hasUrlMatcher) {
      alert('A regra deve ter pelo menos um matcher de URL');
      return;
    }

    setIsSaving(true);

    try {
      const updatedRule = {
        name: name.trim(),
        enabled,
        matchers,
        action
      };

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
      <DialogContent className="sm:max-w-2xl md:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Adicionar Nova Regra' : 'Editar Regra'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Configure uma nova regra de interceptação'
              : 'Modifique os detalhes da regra de interceptação'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="mb-4">
            <Label htmlFor="ruleName">Nome da Regra</Label>
            <Input
              id="ruleName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: API de Login"
              className="w-full"
            />
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'match' | 'then')}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="match" className="flex-1">Match</TabsTrigger>
              <TabsTrigger value="then" className="flex-1">Then</TabsTrigger>
            </TabsList>

            <TabsContent value="match" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Condições de Match</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Defina as condições para que esta regra seja aplicada a uma requisição.
                </p>

                {matchers.map((matcher, index) => (
                  <div key={index} className="mb-4 p-3 border rounded-lg bg-card">
                    <MatcherEditor
                      matcher={matcher}
                      onChange={(updatedMatcher) => updateMatcher(index, updatedMatcher)}
                      onRemove={() => removeMatcher(index)}
                      canRemove={matchers.length > 1}
                    />
                  </div>
                ))}

                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMatcher('url')}
                    className="mr-2"
                  >
                    <Icon name="add" className="mr-1 h-4 w-4" />
                    URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMatcher('method')}
                    className="mr-2"
                  >
                    <Icon name="add" className="mr-1 h-4 w-4" />
                    Método
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMatcher('header')}
                    className="mr-2"
                  >
                    <Icon name="add" className="mr-1 h-4 w-4" />
                    Header
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addMatcher('body')}
                  >
                    <Icon name="add" className="mr-1 h-4 w-4" />
                    Body
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="then" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Ação</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Defina a ação a ser executada quando a requisição corresponder às condições de match.
                </p>

                <ActionEditor
                  action={action}
                  onChange={updateAction}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center space-x-2 mt-4">
            <Checkbox
              id="rule-enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
            />
            <Label htmlFor="rule-enabled">Regra ativa</Label>
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

export default RuleEditor;
