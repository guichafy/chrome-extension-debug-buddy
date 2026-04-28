import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import RuleTable from '@/components/rules/RuleTable';
import RuleEditor from '@/components/rules/RuleEditor';
import { RulePresetCard } from '@/components/rules-lab/RulePresetCard';
import { RulesImportExport } from '@/components/rules-lab/RulesImportExport';
import { useRules } from '@/hooks/useRules';
import type { Rule, RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

const PRESET_IDS: RulePresetId[] = [
	'http_error_500',
	'http_error_404',
	'http_error_401',
	'http_error_403',
	'latency_fixed',
	'latency_range',
	'empty_response',
	'broken_json',
];

const RulesLab: React.FC = () => {
	const { rules, addRule, updateRule, removeRule, toggleRuleEnabled } = useRules();
	const [editingRule, setEditingRule] = useState<Rule | null>(null);
	const [creatingFromPreset, setCreatingFromPreset] = useState<RulePresetId | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const presetDraft = creatingFromPreset ? createPresetRule(creatingFromPreset) : undefined;

	return (
		<div className="space-y-6 p-4">
			<Card className="panel">
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Rules Lab</CardTitle>
						<CardDescription>
							Crie regras a partir de presets, gerencie regras existentes e exporte/importe pacotes.
						</CardDescription>
					</div>
					<Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
						<LucideIcon name="plus" className="h-4 w-4" />
						Nova regra
					</Button>
				</CardHeader>
				<CardContent>
					<h3 className="mb-3 text-sm font-medium">Presets</h3>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{PRESET_IDS.map((id) => (
							<RulePresetCard key={id} presetId={id} onCreate={() => setCreatingFromPreset(id)} />
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="panel">
				<CardHeader>
					<CardTitle>Regras configuradas</CardTitle>
					<CardDescription>{rules.length} regra(s) ativas, pausadas ou rascunho.</CardDescription>
				</CardHeader>
				<CardContent>
					<RuleTable
						rules={rules}
						onRemove={removeRule}
						onToggle={toggleRuleEnabled}
						onEdit={(rule) => setEditingRule(rule)}
					/>
				</CardContent>
			</Card>

			<RulesImportExport />

			<RuleEditor
				open={isCreating || creatingFromPreset !== null}
				mode="create"
				rule={
					presetDraft
						? {
								id: 'draft',
								createdAt: 0,
								updatedAt: 0,
								...presetDraft,
							}
						: undefined
				}
				onOpenChange={(open) => {
					if (!open) {
						setIsCreating(false);
						setCreatingFromPreset(null);
					}
				}}
				onSave={async (newRule) => {
					const ok = await addRule(newRule.name, newRule.matchers, newRule.action);
					if (ok) {
						setIsCreating(false);
						setCreatingFromPreset(null);
					}
					return ok;
				}}
			/>

			{editingRule && (
				<RuleEditor
					open={!!editingRule}
					mode="edit"
					rule={editingRule}
					onOpenChange={(open) => {
						if (!open) setEditingRule(null);
					}}
					onSave={async (updated) => {
						const ok = await updateRule(editingRule.id, updated);
						if (ok) setEditingRule(null);
						return ok;
					}}
				/>
			)}
		</div>
	);
};

export default RulesLab;
