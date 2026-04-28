import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Action, Matcher, Rule } from '@/types/rules';

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

	// Adicionar uma nova regra
	const addRule = useCallback(
		async (name: string, matchers: Matcher[], action: Action): Promise<boolean> => {
			try {
				const now = Date.now();
				const newRule: Rule = {
					id: uuidv4(),
					name,
					enabled: true,
					matchers,
					action,
					createdAt: now,
					updatedAt: now,
				};

				const newRules = [...rules, newRule];
				await chrome.storage.local.set({ rules: newRules });
				setRules(newRules);
				return true;
			} catch (error) {
				console.error('Erro ao adicionar regra:', error);
				return false;
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

	// Carregar regras ao montar o componente. A migração de dados legados
	// (urlPatterns/mocks) é responsabilidade do background — ver
	// app/src/lib/legacyMigration.ts.
	useEffect(() => {
		loadRules();
	}, [loadRules]);

	return {
		rules,
		loading,
		addRule,
		updateRule,
		removeRule,
		toggleRuleEnabled,
	};
}
