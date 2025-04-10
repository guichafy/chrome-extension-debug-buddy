import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Icon } from '../components/ui/icon';
import RuleList from '../components/RuleList';
import RuleDialog from '../components/RuleDialog';
import { useUrlPatterns, UrlPattern } from '../hooks/useUrlPatterns';

const Settings: React.FC = () => {
  const {
    urlPatterns,
    addUrlPattern,
    removeUrlPattern,
    toggleRuleEnabled,
    updateUrlPattern
  } = useUrlPatterns();

  const [editingRule, setEditingRule] = useState<{ index: number, rule: UrlPattern } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <>
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Regras Configuradas</CardTitle>
            <CardDescription>
              Lista de regras de interceptação configuradas. Cada regra define um padrão de URL, método HTTP e headers opcionais.
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="primary-button flex items-center gap-2"
          >
            <Icon name="add" />
            Adicionar Regra
          </Button>
        </CardHeader>
        <CardContent>
          <RuleList
            urlPatterns={urlPatterns}
            onRemove={removeUrlPattern}
            onToggle={toggleRuleEnabled}
            onEdit={(index, rule) => {
              setEditingRule({ index, rule });
              return Promise.resolve(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Modal para edição de regra */}
      {editingRule && (
        <RuleDialog
          open={!!editingRule}
          mode="edit"
          rule={editingRule.rule}
          onOpenChange={(open) => {
            if (!open) setEditingRule(null);
          }}
          onSave={async (updatedRule) => {
            if (editingRule) {
              const success = await updateUrlPattern(editingRule.index, updatedRule);
              if (success) setEditingRule(null);
              return success;
            }
            return false;
          }}
        />
      )}

      {/* Modal para criação de regra */}
      <RuleDialog
        open={isCreating}
        mode="create"
        onOpenChange={(open) => {
          if (!open) setIsCreating(false);
        }}
        onSave={async (newRule) => {
          const success = await addUrlPattern(
            newRule.url,
            newRule.method,
            newRule.headerName || '',
            newRule.headerValue || '',
            newRule.headerType || 'request'
          );
          if (success) setIsCreating(false);
          return success;
        }}
      />
    </>
  );
};

export default Settings;
