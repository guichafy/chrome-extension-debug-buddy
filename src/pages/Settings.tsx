import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import UrlForm from '../components/UrlForm';
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

  return (
    <>
      <Card className="panel">
        <CardHeader>
          <CardTitle>Configurar Regras de Interceptação</CardTitle>
          <CardDescription>
            Configure regras para interceptar requisições baseadas em padrões de URL, métodos HTTP e headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="input-group">
          <UrlForm onAdd={addUrlPattern} />
        </CardContent>
      </Card>

      <Card className="panel mt-4">
        <CardHeader>
          <CardTitle>Regras Configuradas</CardTitle>
          <CardDescription>
            Lista de regras de interceptação configuradas. Cada regra define um padrão de URL, método HTTP e headers opcionais.
          </CardDescription>
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

      {editingRule && (
        <RuleDialog
          open={!!editingRule}
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
    </>
  );
};

export default Settings;
