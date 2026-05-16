import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Action, Matcher, Rule, RuleStage } from '@/types/rules';

export function useRules() {
	const [rules, setRules] = useState<Rule[]>([]);
	const [loading, setLoading] = useState(true);

	// Carregar regras do armazenamento
	const loadRules = useCallback(async () => {
		setLoading(true);
		try {
			const result = await chrome.storage.local.get(['rules']);
			setRules(result.rules || []);
		} catch (error) {
			console.error('Erro ao carregar regras:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Adicionar uma nova regra. Stage default = 'response' preserva
	// comportamento histórico para callers que ainda não setam stage; Phase 4
	// expõe stage como campo de UI no editor.
	const addRule = useCallback(
		async (
			name: string,
			matchers: Matcher[],
			action: Action,
			stage: RuleStage = 'response',
		): Promise<Rule | null> => {
			try {
				const now = Date.now();
				const newRule: Rule = {
					id: uuidv4(),
					name,
					enabled: true,
					stage,
					matchers,
					actions: [action],
					createdAt: now,
					updatedAt: now,
				};

				const newRules = [...rules, newRule];
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return newRule;
			} catch (error) {
				console.error('Erro ao adicionar regra:', error);
				return null;
			}
		},
		[rules],
	);

	// Atualizar uma regra existente
	const updateRule = useCallback(
		async (id: string, updates: Partial<Omit<Rule, 'id' | 'createdAt'>>): Promise<boolean> => {
			try {
				const ruleIndex = rules.findIndex((rule) => rule.id === id);
				if (ruleIndex === -1) {
					console.error(`Regra com ID ${id} não encontrada`);
					return false;
				}

				const updatedRule: Rule = {
					...rules[ruleIndex],
					...updates,
					updatedAt: Date.now(),
				};

				const newRules = [...rules];
				newRules[ruleIndex] = updatedRule;
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao atualizar regra:', error);
				return false;
			}
		},
		[rules],
	);

	// Duplicar uma regra existente: cria uma nova com novo `id`, sufixo
	// "(cópia)" no nome, `enabled: false` (para evitar duplicação acidental
	// de comportamento), e a insere imediatamente após a regra original na
	// ordem do array — preservando a prioridade de matching.
	const duplicateRule = useCallback(
		async (id: string): Promise<Rule | null> => {
			try {
				const sourceIndex = rules.findIndex((rule) => rule.id === id);
				if (sourceIndex === -1) {
					console.error(`Regra com ID ${id} não encontrada`);
					return null;
				}

				const source = rules[sourceIndex];
				const now = Date.now();
				// Deep clone defensivo: evita compartilhamento de referências
				// entre original e cópia em estado in-memory antes do round-trip
				// via chrome.storage (que serializa para JSON).
				const clonedMatchers: Matcher[] = JSON.parse(JSON.stringify(source.matchers));
				const clonedActions: Action[] = JSON.parse(JSON.stringify(source.actions));

				const cloned: Rule = {
					id: uuidv4(),
					name: `${source.name} (cópia)`,
					enabled: false,
					stage: source.stage,
					matchers: clonedMatchers,
					actions: clonedActions,
					createdAt: now,
					updatedAt: now,
				};

				const newRules = [...rules];
				newRules.splice(sourceIndex + 1, 0, cloned);
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return cloned;
			} catch (error) {
				console.error('Erro ao duplicar regra:', error);
				return null;
			}
		},
		[rules],
	);

	// Remover uma regra pelo ID
	const removeRule = useCallback(
		async (id: string): Promise<boolean> => {
			try {
				const newRules = rules.filter((rule) => rule.id !== id);
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao remover regra:', error);
				return false;
			}
		},
		[rules],
	);

	// Alternar o estado de habilitado/desabilitado de uma regra
	const toggleRuleEnabled = useCallback(
		async (id: string): Promise<boolean> => {
			try {
				const ruleIndex = rules.findIndex((rule) => rule.id === id);
				if (ruleIndex === -1) {
					console.error(`Regra com ID ${id} não encontrada`);
					return false;
				}

				const updatedRule: Rule = {
					...rules[ruleIndex],
					enabled: !rules[ruleIndex].enabled,
					updatedAt: Date.now(),
				};

				const newRules = [...rules];
				newRules[ruleIndex] = updatedRule;
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao alternar estado da regra:', error);
				return false;
			}
		},
		[rules],
	);

	// Reordenar regras: move a regra `fromId` para a posição da regra `toId`.
	// Quando `position === 'before'` insere antes do alvo; `'after'` insere depois.
	// A ordem do array reflete a prioridade de matching (primeira que casa vence).
	const reorderRules = useCallback(
		async (fromId: string, toId: string, position: 'before' | 'after'): Promise<boolean> => {
			if (fromId === toId) return false;
			try {
				const fromIndex = rules.findIndex((r) => r.id === fromId);
				const toIndex = rules.findIndex((r) => r.id === toId);
				if (fromIndex === -1 || toIndex === -1) return false;

				const newRules = [...rules];
				const [moved] = newRules.splice(fromIndex, 1);
				// Recalcula índice do alvo após remoção
				const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
				const insertAt = position === 'after' ? adjustedToIndex + 1 : adjustedToIndex;
				newRules.splice(insertAt, 0, moved);
				if (newRules.findIndex((r) => r.id === fromId) === fromIndex) return false;

				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao reordenar regras:', error);
				return false;
			}
		},
		[rules],
	);

	// Mover uma regra uma posição para cima ou para baixo (atalho de teclado).
	const moveRule = useCallback(
		async (id: string, direction: 'up' | 'down'): Promise<boolean> => {
			try {
				const index = rules.findIndex((r) => r.id === id);
				if (index === -1) return false;
				const target = direction === 'up' ? index - 1 : index + 1;
				if (target < 0 || target >= rules.length) return false;

				const newRules = [...rules];
				const [moved] = newRules.splice(index, 1);
				newRules.splice(target, 0, moved);
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao mover regra:', error);
				return false;
			}
		},
		[rules],
	);

	// Carregar regras ao montar o componente. A migração de dados legados
	// (urlPatterns/mocks) é responsabilidade do background — ver
	// app/src/lib/legacyMigration.ts.
	// Também subscreve chrome.storage.onChanged para refletir escritas externas
	// (ex: importação de regras feita pelo Rules Lab) sem precisar recarregar.
	useEffect(() => {
		loadRules();

		const onChanged = (changes: Record<string, chrome.storage.StorageChange>, ns: string) => {
			if (ns !== 'local' || !changes.rules) return;
			setRules((changes.rules.newValue as Rule[] | undefined) ?? []);
		};
		chrome.storage.onChanged.addListener(onChanged);
		return () => chrome.storage.onChanged.removeListener(onChanged);
	}, [loadRules]);

	return {
		rules,
		loading,
		addRule,
		updateRule,
		removeRule,
		duplicateRule,
		toggleRuleEnabled,
		reorderRules,
		moveRule,
	};
}
