import type { Action, Matcher, Rule, RuleStage } from '../types/rules';
import { isTerminalAction } from '../types/rules';

// Phase 6: heurística de "regra inalcançável" usada pela RulesList para alertar
// o usuário quando uma regra está abaixo de outra que SEMPRE termina a chain do
// mesmo stage. A engine de matching corta em ações terminais (mock/block/
// breakpoint) — então uma regra abaixo de uma terminal só executa se a
// terminal não tiver casado. Capturamos dois casos óbvios e estaticamente
// detectáveis:
//   1. Catch-all terminal acima → tudo abaixo do mesmo stage é inalcançável.
//   2. Terminal acima com matchers idênticos (mesma assinatura) → a regra
//      alvo nunca executa, porque o input que casaria nela já casou na de
//      cima.
// Casos mais sutis (matcher A é "mais geral" que matcher B sem ser idêntico)
// ficam de fora por enquanto — superset semântico de URL globs/regex é
// indecidível em geral.

function serializeMatcher(matcher: Matcher): string {
	switch (matcher.type) {
		case 'url':
			return `url:${matcher.isRegex ? 're' : 'lit'}:${matcher.pattern}`;
		case 'method': {
			const methods = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
			const normalized = methods.map((m) => m.toUpperCase()).sort();
			return `method:${normalized.join(',')}`;
		}
		case 'header':
			return `header:${matcher.headerType}:${matcher.name.toLowerCase()}:${matcher.value}`;
		case 'body':
			return `body:${matcher.isRegex ? 're' : 'lit'}:${matcher.contentType ?? ''}:${matcher.pattern}`;
		default: {
			const exhaustive: never = matcher;
			throw new Error(`Matcher type não suportado: ${(exhaustive as { type: string }).type}`);
		}
	}
}

// Assinatura canônica dos matchers HABILITADOS. Vazia significa catch-all.
function getMatchersSignature(matchers: Matcher[]): string {
	const enabled = matchers.filter((m) => m.enabled);
	if (enabled.length === 0) return '';
	return enabled.map(serializeMatcher).sort().join('|');
}

function isCatchAll(matchers: Matcher[]): boolean {
	return matchers.every((m) => !m.enabled);
}

function lastEnabledActionIsTerminal(actions: Action[]): boolean {
	const enabled = actions.filter((a) => a.enabled);
	if (enabled.length === 0) return false;
	return isTerminalAction(enabled[enabled.length - 1]);
}

interface StageReachabilityState {
	// Já existe um catch-all terminal habilitado bloqueando este stage.
	catchAllBlocked: boolean;
	// Assinaturas (matchers idênticos) de regras terminais já vistas.
	terminalSignatures: Set<string>;
}

function emptyState(): StageReachabilityState {
	return { catchAllBlocked: false, terminalSignatures: new Set() };
}

export function findUnreachableRuleIds(rules: Rule[]): Set<string> {
	const unreachable = new Set<string>();
	const stageState: Record<RuleStage, StageReachabilityState> = {
		request: emptyState(),
		response: emptyState(),
	};

	for (const rule of rules) {
		if (!rule.enabled) continue;
		const state = stageState[rule.stage];
		const signature = getMatchersSignature(rule.matchers);
		const catchAll = isCatchAll(rule.matchers);

		const coveredByCatchAll = state.catchAllBlocked;
		const coveredBySignature = !catchAll && state.terminalSignatures.has(signature);
		// Catch-all coberta apenas por outro catch-all (não por assinatura
		// específica, que é mais restrita que catch-all).
		if (coveredByCatchAll || coveredBySignature) {
			unreachable.add(rule.id);
			continue;
		}

		if (lastEnabledActionIsTerminal(rule.actions)) {
			if (catchAll) {
				state.catchAllBlocked = true;
			} else {
				state.terminalSignatures.add(signature);
			}
		}
	}

	return unreachable;
}

export function isRuleUnreachable(target: Rule, rules: Rule[]): boolean {
	return findUnreachableRuleIds(rules).has(target.id);
}
