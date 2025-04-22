import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/components/shadcn/card';
import { Button } from '@/ui/components/shadcn/button';
import { Icon } from '@/ui/components/shadcn/icon';
import RuleTable from '@/ui/components/rules/RuleTable';
import RuleEditor from '@/ui/components/rules/RuleEditor';
import { useRules } from '@/ui/hooks/useRules';
import { Rule } from '@/backend/types/rules';

const Settings: React.FC = () => {
  const {
    rules,
    addRule,
    updateRule,
    removeRule,
    toggleRuleEnabled
  } = useRules();

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <>
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Regras Configuradas</CardTitle>
            <CardDescription>
              Lista de regras de interceptação configuradas. Cada regra possui condições de match (Match) e uma ação a ser executada (Then).
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
          <RuleTable
            rules={rules}
            onRemove={removeRule}
            onToggle={toggleRuleEnabled}
            onEdit={(rule) => {
              setEditingRule(rule);
            }}
          />
        </CardContent>
      </Card>

      {/* Modal para edição de regra */}
      {editingRule && (
        <RuleEditor
          open={!!editingRule}
          mode="edit"
          rule={editingRule}
          onOpenChange={(open) => {
            if (!open) setEditingRule(null);
          }}
          onSave={async (updatedRule) => {
            const success = await updateRule(editingRule.id, updatedRule);
            if (success) setEditingRule(null);
            return success;
          }}
        />
      )}

      {/* Modal para criação de regra */}
      <RuleEditor
        open={isCreating}
        mode="create"
        onOpenChange={(open) => {
          if (!open) setIsCreating(false);
        }}
        onSave={async (newRule) => {
          const success = await addRule(
            newRule.name,
            newRule.matchers,
            newRule.action
          );
          if (success) setIsCreating(false);
          return success;
        }}
      />
    </>
  );
};

export default Settings;
