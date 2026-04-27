import { useState, useEffect, useCallback } from 'react';
import { Rule, Matcher, Action } from '@/backend/types/rules';
import { v4 as uuidv4 } from 'uuid';

type LegacyUrlPattern =
	| string
	| {
			url: string;
			method?: string;
			headerName?: string;
			headerValue?: string;
			headerType?: 'request' | 'response';
			enabled?: boolean;
			isRegex?: boolean;
	  };

export function createRuleFromLegacyUrlPattern(
	pattern: LegacyUrlPattern,
	now: number,
	createId: () => string = uuidv4,
): Rule {
	const matchers: Matcher[] = [];
	const url = typeof pattern === 'string' ? pattern : pattern.url;

	if (!url) {
		throw new Error('Padrão legado sem URL não pode ser migrado');
	}

	matchers.push({
		type: 'url',
		enabled: true,
		pattern: url,
		isRegex: typeof pattern === 'string' ? false : pattern.isRegex === true,
	});

	if (typeof pattern !== 'string' && pattern.method) {
		matchers.push({
			type: 'method',
			enabled: true,
			method: pattern.method,
		});
	}

	if (
		typeof pattern !== 'string' &&
		pattern.headerName &&
		pattern.headerValue &&
		pattern.headerType
	) {
		matchers.push({
			type: 'header',
			enabled: true,
			name: pattern.headerName,
			value: pattern.headerValue,
			headerType: pattern.headerType,
		});
	}

	return {
		id: createId(),
		name: `Regra migrada: ${url}`,
		enabled: typeof pattern === 'string' ? true : pattern.enabled !== false,
		matchers,
		action: {
			type: 'breakpoint',
			enabled: true,
			description: 'Regra migrada de padrões de URL legados',
		},
		createdAt: now,
		updatedAt: now,
	};
}

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

				// Salvar regras atualizadas
				await chrome.storage.local.set({ rules: newRules });

				// Atualizar o estado
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

				// Salvar regras atualizadas
				await chrome.storage.local.set({ rules: newRules });

				// Atualizar o estado
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

				// Salvar regras atualizadas
				await chrome.storage.local.set({ rules: newRules });

				// Atualizar o estado
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

				// Salvar regras atualizadas
				await chrome.storage.local.set({ rules: newRules });

				// Atualizar o estado
				setRules(newRules);

				return true;
			} catch (error) {
				console.error('Erro ao alternar estado da regra:', error);
				return false;
			}
		},
		[rules],
	);

	// Migrar regras antigas para o novo formato
	const migrateOldRules = useCallback(async (): Promise<boolean> => {
		try {
			// Obter padrões antigos e regras atuais juntos para não depender do estado React.
			const result = await chrome.storage.local.get(['rules', 'urlPatterns']);
			const oldPatterns = result.urlPatterns || [];
			const existingRules = result.rules || [];

			if (oldPatterns.length === 0) {
				return true; // Nada para migrar
			}

			const now = Date.now();
			const newRules = oldPatterns.map((pattern: LegacyUrlPattern) =>
				createRuleFromLegacyUrlPattern(pattern, now),
			);

			// Combinar com regras existentes
			const combinedRules = [...existingRules, ...newRules];

			// Salvar regras atualizadas e limpar padrões antigos em uma única escrita.
			await chrome.storage.local.set({ rules: combinedRules, urlPatterns: [] });

			// Atualizar o estado
			setRules(combinedRules);

			return true;
		} catch (error) {
			console.error('Erro ao migrar regras antigas:', error);
			return false;
		}
	}, []);

	// Carregar regras ao montar o componente
	useEffect(() => {
		const init = async () => {
			await loadRules();

			// Verificar se há regras antigas para migrar
			const result = await chrome.storage.local.get(['urlPatterns']);
			const oldPatterns = result.urlPatterns || [];

			if (oldPatterns.length > 0) {
				await migrateOldRules();
			}
		};

		init();
	}, [loadRules, migrateOldRules]);

	return {
		rules,
		loading,
		addRule,
		updateRule,
		removeRule,
		toggleRuleEnabled,
		migrateOldRules,
	};
}
