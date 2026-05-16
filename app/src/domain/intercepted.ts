import type { InterceptedResponse } from '../types/intercepted';
import type { Action, HeaderOps, Rule, TransformOperation } from '../types/rules';
import { isTerminalAction } from '../types/rules';
import { applyOperations } from './jsonPatcher';
import type { MatchedRule } from './ruleMatching';

export function normalizeInterceptedResponse(request: InterceptedResponse): InterceptedResponse {
	if (request.response) return request;

	return {
		...request,
		response: {
			headers: request.headers,
			...('body' in request ? { body: request.body } : {}),
		},
	};
}

// Plano de execução: cada item representa uma action concreta a aplicar no
// runtime, na ordem em que devem rodar. `rule` é mantido para telemetria/UI
// (mostrar qual regra está agindo). `isTerminal=true` marca o ponto de corte
// do chain — o executor (Phase 3) interrompe a execução depois dessa action.
export interface PlannedAction {
	rule: Rule;
	action: Action;
	isTerminal: boolean;
}

// Achata a chain (`MatchedRule[]`) em sequência linear de actions, na ordem
// de execução. Para no primeiro terminal — actions subsequentes não entram
// no plano (não importam para o pipeline). Função pura — sem side-effects.
export function flattenChainActions(chain: MatchedRule[]): PlannedAction[] {
	const plan: PlannedAction[] = [];
	for (const matched of chain) {
		for (const action of matched.actions) {
			const terminal = isTerminalAction(action);
			plan.push({ rule: matched.rule, action, isTerminal: terminal });
			if (terminal) return plan;
		}
	}
	return plan;
}

// Aplica HeaderOps sobre um Record<string, string> em ordem:
//   1. removeHeaders — remove pelos nomes (case-insensitive).
//   2. setHeaders    — substitui valor; se o nome já existir em qualquer caixa,
//                       atualiza preservando a chave original; caso contrário
//                       insere com o nome dado.
//   3. addHeaders    — só insere se o nome ainda não existe (case-insensitive).
// Retorna um novo Record (não muta entrada). CDP só aceita lista completa de
// headers no `continueRequest`/`fulfillRequest` — o caller materializa o
// objeto resultante em array após esta função.
export function applyHeaderOps(
	current: Record<string, string>,
	ops: HeaderOps,
): Record<string, string> {
	const result: Record<string, string> = { ...current };

	if (ops.removeHeaders && ops.removeHeaders.length > 0) {
		const lower = new Set(ops.removeHeaders.map((n) => n.toLowerCase()));
		for (const name of Object.keys(result)) {
			if (lower.has(name.toLowerCase())) delete result[name];
		}
	}

	if (ops.setHeaders) {
		for (const [name, value] of Object.entries(ops.setHeaders)) {
			const existingKey = Object.keys(result).find((k) => k.toLowerCase() === name.toLowerCase());
			if (existingKey !== undefined) {
				result[existingKey] = value;
			} else {
				result[name] = value;
			}
		}
	}

	if (ops.addHeaders) {
		for (const [name, value] of Object.entries(ops.addHeaders)) {
			const exists = Object.keys(result).some((k) => k.toLowerCase() === name.toLowerCase());
			if (!exists) result[name] = value;
		}
	}

	return result;
}

// Aplica TransformOperation[] sobre um body em string JSON. Reusa o motor de
// `jsonPatcher.applyOperations`. Quando o body é `undefined` o caller deve
// decidir se trata como `{}` (operações add sobre raiz) ou falha — aqui falha,
// alinhado à regra "no fallbacks" do projeto (erro visível > placeholder).
export type ApplyBodyResult = { ok: true; body: string } | { ok: false; error: string };

export function applyBodyOperations(
	body: string | undefined,
	ops: TransformOperation[],
): ApplyBodyResult {
	if (body === undefined) {
		return {
			ok: false,
			error: 'Body ausente — não é possível aplicar bodyOperations sobre body undefined.',
		};
	}
	if (ops.length === 0) {
		return { ok: true, body };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch (error) {
		return {
			ok: false,
			error: `Body não é JSON válido — bodyOperations exige documento JSON: ${(error as Error).message}`,
		};
	}
	const result = applyOperations(parsed, ops);
	if (!result.ok) {
		return { ok: false, error: `Falhou na operação ${result.failedAtIndex}: ${result.error}` };
	}
	return { ok: true, body: JSON.stringify(result.output) };
}

// Decisão consolidada do que o pipeline da Phase 3 deve fazer com um chain.
// Phase 2 entrega só a estrutura pura; Phase 3 implementa o executor que
// consome `actions` e dispara comandos CDP.
export interface StageChainDecision {
	// Sequência ordenada de actions a executar (cortada no primeiro terminal).
	actions: PlannedAction[];
	// Quando true, o chain inclui um terminal — após executá-lo, o pipeline
	// não deve continuar (não chamar continueRequest no Request stage, nem
	// rotear pra Response stage no caso de mock/block).
	hasTerminal: boolean;
}

// Compõe o plano de execução a partir do chain. Função pura — Phase 3 usa
// este resultado para orquestrar o pipeline CDP.
export function processStageChain(chain: MatchedRule[]): StageChainDecision {
	const actions = flattenChainActions(chain);
	const hasTerminal = actions.some((p) => p.isTerminal);
	return { actions, hasTerminal };
}
