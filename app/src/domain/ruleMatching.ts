import type { Action, Rule } from '../types/rules';
import { getHeaderValue } from './http';

export interface RequestMatchInput {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

export type MatchedRuleAction =
	| {
			type: 'mock';
			rule: Rule;
			action: Extract<Action, { type: 'mock' }>;
	  }
	| {
			type: 'breakpoint';
			rule: Rule;
			action: Extract<Action, { type: 'breakpoint' }>;
	  };

function matcherMatches(rule: Rule, input: RequestMatchInput): boolean {
	return rule.matchers.every((matcher) => {
		if (!matcher.enabled) return true;

		switch (matcher.type) {
			case 'url':
				if (!matcher.pattern) return false;
				if (!matcher.isRegex) return input.url.includes(matcher.pattern);
				try {
					return new RegExp(matcher.pattern).test(input.url);
				} catch (error) {
					console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
					return false;
				}

			case 'method':
				if (!matcher.method) return false;
				return matcher.method === 'ANY' || matcher.method === input.method;

			case 'header':
				if (!matcher.name || !matcher.value || !matcher.headerType) return false;
				if (matcher.headerType !== 'request') return true;
				return getHeaderValue(input.headers, matcher.name) === matcher.value;

			case 'body':
				if (!matcher.pattern) return false;
				if (input.body === undefined) return true;
				if (!matcher.isRegex) return input.body.includes(matcher.pattern);
				try {
					return new RegExp(matcher.pattern).test(input.body);
				} catch (error) {
					console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
					return false;
				}

			default:
				return false;
		}
	});
}

export function findMatchingRuleAction(
	rules: Rule[],
	input: RequestMatchInput,
): MatchedRuleAction | undefined {
	for (const rule of rules) {
		if (!rule.enabled || !rule.action.enabled) continue;
		if (!matcherMatches(rule, input)) continue;

		if (rule.action.type === 'mock') {
			return { type: 'mock', rule, action: rule.action };
		}

		if (rule.action.type === 'breakpoint') {
			return { type: 'breakpoint', rule, action: rule.action };
		}
	}

	return undefined;
}
