import type { Action, Matcher, Rule, RuleStage } from '../types/rules';
import { isMatcherValidForStage, isTerminalAction } from '../types/rules';
import { getHeaderValue } from './http';

export interface RequestMatchInput {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

// Forma "head" mantida para Phase 1/2 (compat layer). Phase 3 vai migrar todos
// os call-sites do background para o pipeline baseado em `findMatchingRulesChain`
// e este tipo deixa de existir.
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

// Resultado de `findMatchingRulesChain`: lista ordenada (na ordem do array
// `rules`) das regras que casaram o input no stage em questão. Cada item
// carrega o subconjunto de `actions` da regra que está habilitado (matchers
// já passaram). O caller decide como achatar/cortar o chain — ver
// `flattenChainActions` em `domain/intercepted.ts`.
export interface MatchedRule {
	rule: Rule;
	actions: Action[];
}

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

// Phase 2: matching stage-aware. Em stage='request' o matcher `header` só
// avalia `headerType='request'` (response headers ainda não chegaram); em
// stage='response' ambos `request` e `response` são avaliáveis (a engine
// passa o conjunto correto via `input.headers`). Matcher `body` casa contra
// `input.body` — o caller injeta o body correto do estágio (postData em
// request, response body em response).
function singleMatcherMatches(
	matcher: Matcher,
	input: RequestMatchInput,
	stage: RuleStage,
): boolean {
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
			// Em stage='request' não há response headers ainda — qualquer matcher
			// que mira em headerType='response' falha (não casa). Em stage='response'
			// o engine recebe `input.headers` já mesclado/contextualizado pelo
			// caller (Phase 3 garante). Tratamento simétrico para 'request'.
			if (matcher.headerType === 'response' && stage !== 'response') return false;
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

function matcherMatches(rule: Rule, input: RequestMatchInput, stage: RuleStage): boolean {
	return rule.matchers.every((matcher) => singleMatcherMatches(matcher, input, stage));
}

// Resultado de validação cruzada matcher × stage. Usado pela UI (Phase 4) para
// bloquear matchers inválidos no editor, e pelo engine no carregamento de
// regras para rejeitar configurações inconsistentes vindas de import legado.
export type MatcherValidationResult =
	| { ok: true }
	| { ok: false; errors: Array<{ matcher: Matcher; reason: string }> };

export function validateMatchersForStage(
	matchers: Matcher[],
	stage: RuleStage,
): MatcherValidationResult {
	const errors: Array<{ matcher: Matcher; reason: string }> = [];
	for (const matcher of matchers) {
		if (isMatcherValidForStage(matcher, stage)) continue;
		// O único caso de invalidação hoje é header.headerType='response' em
		// regras request. Estendemos `reason` para mensagens específicas em
		// futuras invalidações.
		errors.push({
			matcher,
			reason: `Matcher inválido para stage='${stage}': ${matcher.type}${
				matcher.type === 'header' ? ` (headerType='${matcher.headerType}')` : ''
			}.`,
		});
	}
	return errors.length === 0 ? { ok: true } : { ok: false, errors };
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
	stage: RuleStage = 'response',
): MatchersExplanation {
	if (matchers.length === 0) {
		return { overall: false, checks: [] };
	}
	const checks: MatcherCheck[] = matchers.map((matcher) => {
		if (!matcher.enabled) {
			return { matcher, pass: true, reason: `${describeMatcher(matcher)} (desabilitado)` };
		}
		const pass = singleMatcherMatches(matcher, input, stage);
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

// Compat layer (Phase 1/2/3): retorna a primeira regra cuja matcher casa,
// expondo a PRIMEIRA action habilitada como `MatchedRuleAction`. Quando o
// caller passa `stage`, filtra `rule.stage === stage` — evita que regras
// stage='request' contaminem o Response stage (e vice-versa) no Phase 3,
// onde a integração pipeline/legacy ainda coexiste. Sem `stage`, mantém o
// comportamento histórico (Phase 1/2) de iterar todas as regras.
export function findMatchingRuleAction(
	rules: Rule[],
	input: RequestMatchInput,
	stage?: RuleStage,
): MatchedRuleAction | undefined {
	for (const rule of rules) {
		if (!rule.enabled) continue;
		const ruleStage: RuleStage = rule.stage ?? 'response';
		if (stage !== undefined && ruleStage !== stage) continue;
		if (!matcherMatches(rule, input, ruleStage)) continue;
		const head = rule.actions.find((a) => a.enabled);
		if (!head) continue;
		return buildMatchedFromHead(rule, head);
	}
	return undefined;
}

// Phase 2: novo entrypoint do matching. Itera as regras do storage na ordem
// definida pelo usuário (drag-drop na UI = ordem no array), filtra:
//   1. Regras com `enabled: false` são puladas.
//   2. Regras de stage diferente são puladas.
//   3. Matchers inválidos para o stage (header de response em stage=request)
//      fazem a regra como um todo falhar — engine não tenta carregar regra
//      inválida (Phase 4 validará na UI; aqui agimos defensivamente).
//   4. `matcherMatches` valida que todos os matchers habilitados casam.
// Retorna a chain ORDENADA de regras casadas — quem executa decide quando
// cortar pelo primeiro terminal (`flattenChainActions`).
export function findMatchingRulesChain(
	rules: Rule[],
	stage: RuleStage,
	input: RequestMatchInput,
): MatchedRule[] {
	const chain: MatchedRule[] = [];
	for (const rule of rules) {
		if (!rule.enabled) continue;
		if (rule.stage !== stage) continue;
		const validation = validateMatchersForStage(rule.matchers, stage);
		if (!validation.ok) continue;
		if (!matcherMatches(rule, input, stage)) continue;
		const enabledActions = rule.actions.filter((a) => a.enabled);
		if (enabledActions.length === 0) continue;
		chain.push({ rule, actions: enabledActions });
		// Se a última action habilitada desta regra é terminal, o chain corta
		// aqui — nenhuma regra subsequente executa. A validação do schema
		// (Phase 4) garante que terminal só aparece na última posição.
		const lastAction = enabledActions[enabledActions.length - 1];
		if (isTerminalAction(lastAction)) break;
	}
	return chain;
}
