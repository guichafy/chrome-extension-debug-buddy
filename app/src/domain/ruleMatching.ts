import type { Action, Matcher, Rule } from '../types/rules';
import { getHeaderValue } from './http';

export interface RequestMatchInput {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

// Forma "head" mantida para Phase 1 (compat layer). Em Phase 2 será substituída
// por `MatchedRuleChain` (chain ordenada com TODAS as actions da regra). Aqui
// continuamos retornando apenas a primeira `action` do array `rule.actions`
// para preservar o comportamento de "primeira que casa vence" do engine
// antigo, enquanto os consumidores migram.
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
			type: 'requestDelay';
			rule: Rule;
			action: Extract<Action, { type: 'requestDelay' }>;
	  }
	| {
			type: 'requestModify';
			rule: Rule;
			action: Extract<Action, { type: 'requestModify' }>;
	  }
	| {
			type: 'responseModify';
			rule: Rule;
			action: Extract<Action, { type: 'responseModify' }>;
	  }
	| {
			type: 'block';
			rule: Rule;
			action: Extract<Action, { type: 'block' }>;
	  };

// Converte um padrão com wildcards `*` para uma RegExp ancorada-em-trecho que
// pode ser testada contra a URL. Apenas `*` é tratado como meta-caractere; os
// demais são escapados literalmente.
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
			// Phase 1 (compat): matcher de header de response ainda passa direto
			// como antes. Em Phase 2 ele só será permitido em regras
			// `stage='response'` e o engine validará no carregamento.
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

function buildMatchedFromHead(rule: Rule, head: Action): MatchedRuleAction {
	switch (head.type) {
		case 'mock':
			return { type: 'mock', rule, action: head };
		case 'breakpoint':
			return { type: 'breakpoint', rule, action: head };
		case 'transform':
			return { type: 'transform', rule, action: head };
		case 'requestDelay':
			return { type: 'requestDelay', rule, action: head };
		case 'requestModify':
			return { type: 'requestModify', rule, action: head };
		case 'responseModify':
			return { type: 'responseModify', rule, action: head };
		case 'block':
			return { type: 'block', rule, action: head };
	}
}

// Phase 1 (compat): retorna a primeira regra cuja matcher casa, expondo a
// PRIMEIRA action do array `rule.actions` como `MatchedRuleAction`. Phase 2
// vai substituir essa função por `findMatchingRulesChain` que retorna a chain
// ordenada de todas as regras casadas por stage, e o engine executará todas.
export function findMatchingRuleAction(
	rules: Rule[],
	input: RequestMatchInput,
): MatchedRuleAction | undefined {
	for (const rule of rules) {
		if (!rule.enabled) continue;
		if (!matcherMatches(rule, input)) continue;
		const head = rule.actions.find((a) => a.enabled);
		if (!head) continue;
		return buildMatchedFromHead(rule, head);
	}
	return undefined;
}
