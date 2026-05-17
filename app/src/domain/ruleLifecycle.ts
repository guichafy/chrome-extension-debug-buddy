import type { Rule } from '@/types/rules';

// Identifica quais ruleIds devem ter suas pending interceptions auto-liberadas
// quando o storage de regras muda. Cobre dois casos onde a rule "deixou de
// atuar" do ponto de vista do usuário:
//   1. Rule foi removida (sumiu de `nextRules`).
//   2. Rule continua existindo mas mudou para `enabled: false`.
//
// Função pura — recebe os dois snapshots e devolve o conjunto de ids órfãos.
// Quem chama (storage.onChanged listener no background) faz o efeito colateral
// de liberar via CDP e limpar a fila.
export function findOrphanedRuleIds(prev: Rule[], next: Rule[]): Set<string> {
	const orphaned = new Set<string>();
	const nextById = new Map<string, Rule>(next.map((rule) => [rule.id, rule]));
	for (const prevRule of prev) {
		const nextRule = nextById.get(prevRule.id);
		if (!nextRule) {
			orphaned.add(prevRule.id);
			continue;
		}
		if (prevRule.enabled && !nextRule.enabled) {
			orphaned.add(prevRule.id);
		}
	}
	return orphaned;
}
