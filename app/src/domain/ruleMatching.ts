import type { Action, Matcher, Rule } from '../types/rules';
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
	  }
	| {
			type: 'transform';
			rule: Rule;
			action: Extract<Action, { type: 'transform' }>;
	  }
	| {
			type: 'delay';
			rule: Rule;
			action: Extract<Action, { type: 'delay' }>;
	  };

// Converte um padrao com wildcards `*` para uma RegExp ancorada-em-trecho que
// pode ser testada contra a URL. Apenas `*` e tratado como meta-caractere; os
// demais sao escapados literalmente.
function wildcardToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
	const withWildcard = escaped.replace(/\*/g, '.*');
	return new RegExp(withWildcard);
}

function methodMatcherCasaInput(matcherMethod: string | string[], inputMethod: string): boolean {
	if (Array.isArray(matcherMethod)) {
		if (matcherMethod.length === 0) return false;
		if (matcherMethod.includes('ANY')) return true;
		return matcherMethod.includes(inputMethod);
	}
	if (!matcherMethod) return false;
	return matcherMethod === 'ANY' || matcherMethod === inputMethod;
}

function singleMatcherMatches(matcher: Matcher, input: RequestMatchInput): boolean {
	if (!matcher.enabled) return true;

	switch (matcher.type) {
		case 'url':
			if (!matcher.pattern) return false;
			if (matcher.isRegex) {
				try {
					return new RegExp(matcher.pattern).test(input.url);
				} catch (error) {
					console.error(`Erro ao processar expressão regular '${matcher.pattern}':`, error);
					return false;
				}
			}
			if (matcher.pattern.includes('*')) {
				return wildcardToRegex(matcher.pattern).test(input.url);
			}
			return input.url.includes(matcher.pattern);

		case 'method':
			return methodMatcherCasaInput(matcher.method, input.method);

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
}

function matcherMatches(rule: Rule, input: RequestMatchInput): boolean {
	return rule.matchers.every((matcher) => singleMatcherMatches(matcher, input));
}

// Retorna pass/reason por matcher para alimentar o painel de preview do
// editor. Matchers desabilitados aparecem como "ignorado" (pass=true) para
// refletir o comportamento de runtime.
export interface MatcherCheck {
	matcher: Matcher;
	pass: boolean;
	reason: string;
}

export interface MatchersExplanation {
	overall: boolean;
	checks: MatcherCheck[];
}

function describeMatcher(matcher: Matcher): string {
	switch (matcher.type) {
		case 'url':
			return matcher.pattern ? `URL "${matcher.pattern}"` : 'URL (vazio)';
		case 'method': {
			const methods = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
			return `Método ${methods.length === 0 ? '(vazio)' : methods.join(', ')}`;
		}
		case 'header':
			return `Header ${matcher.name || '(vazio)'}`;
		case 'body':
			return `Body "${matcher.pattern || ''}"`;
		default:
			return 'Matcher desconhecido';
	}
}

export function explainMatchers(
	matchers: Matcher[],
	input: RequestMatchInput,
): MatchersExplanation {
	if (matchers.length === 0) {
		return { overall: false, checks: [] };
	}
	const checks: MatcherCheck[] = matchers.map((matcher) => {
		if (!matcher.enabled) {
			return { matcher, pass: true, reason: `${describeMatcher(matcher)} (desabilitado)` };
		}
		const pass = singleMatcherMatches(matcher, input);
		const description = describeMatcher(matcher);
		if (matcher.type === 'url' && matcher.pattern.length === 0) {
			return { matcher, pass: false, reason: `${description}: padrão vazio` };
		}
		if (matcher.type === 'method') {
			const methods = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
			if (methods.length === 0) {
				return { matcher, pass: false, reason: `${description}: nenhum método selecionado` };
			}
		}
		return {
			matcher,
			pass,
			reason: pass ? `${description} casa o request` : `${description} não casa o request`,
		};
	});
	const enabledChecks = checks.filter((c) => c.matcher.enabled);
	const overall = enabledChecks.length > 0 && enabledChecks.every((c) => c.pass);
	return { overall, checks };
}

// Prioridade de matching: itera as regras na ordem do array `rules` e devolve
// a PRIMEIRA cuja matcher casa o request — "primeira que casa vence". A ordem
// do array reflete a ordem definida pelo usuario na UI (drag-and-drop em
// `RulesList`/`chrome.storage.local.rules`); o background mantem essa mesma
// ordem porque o storage e um array. Regras com `enabled === false` ou
// `action.enabled === false` sao puladas como se nao existissem (nao bloqueiam
// regras subsequentes).
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

		if (rule.action.type === 'transform') {
			return { type: 'transform', rule, action: rule.action };
		}

		if (rule.action.type === 'delay') {
			return { type: 'delay', rule, action: rule.action };
		}
	}

	return undefined;
}
