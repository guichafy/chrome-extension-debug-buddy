import { i18n } from '@/i18n/instance';
import type { Action, ActionType, Matcher, MatcherType, Rule, RuleStage } from '@/types/rules';
import { isActionValidForStage, isTerminalAction } from '@/types/rules';

// Breaking change v2: schema dual-stage. Regras antigas (`schemaVersion: 1`,
// formato `{action, ...}` sem `stage`/`actions`) não são mais aceitas — a UI
// orientará o usuário a recriar as regras. Mantemos a versão atual coerente
// com o novo schema.
const CURRENT_SCHEMA_VERSION = 2;

const ACTION_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
	'requestModify',
	'responseModify',
	'requestDelay',
	'transform',
	'mock',
	'block',
	'breakpoint',
]);

const MATCHER_TYPES: ReadonlySet<MatcherType> = new Set<MatcherType>([
	'url',
	'method',
	'header',
	'body',
]);

const RULE_STAGES: ReadonlySet<RuleStage> = new Set<RuleStage>(['request', 'response']);

export interface RulesExportEnvelope {
	schemaVersion: number;
	rules: Rule[];
}

export type RulesImportResult = { ok: true; rules: Rule[] } | { ok: false; error: string };

export function serializeRules(rules: Rule[]): string {
	const envelope: RulesExportEnvelope = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		rules,
	};
	return JSON.stringify(envelope, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMatcher(value: unknown): value is Matcher {
	if (!isPlainObject(value)) return false;
	const type = value.type;
	if (typeof type !== 'string' || !MATCHER_TYPES.has(type as MatcherType)) return false;
	if (typeof value.enabled !== 'boolean') return false;
	return true;
}

function validateAction(value: unknown): value is Action {
	if (!isPlainObject(value)) return false;
	if (typeof value.type !== 'string' || !ACTION_TYPES.has(value.type as ActionType)) return false;
	if (typeof value.enabled !== 'boolean') return false;
	return true;
}

function validateRule(value: unknown): { ok: true; rule: Rule } | { ok: false; error: string } {
	if (!isPlainObject(value))
		return { ok: false, error: i18n.t('rules:importValidation.ruleNotObject') };
	if (typeof value.id !== 'string')
		return { ok: false, error: i18n.t('rules:importValidation.ruleMissingId') };
	if (typeof value.name !== 'string')
		return { ok: false, error: i18n.t('rules:importValidation.ruleMissingName') };
	if (typeof value.enabled !== 'boolean')
		return { ok: false, error: i18n.t('rules:importValidation.ruleMissingEnabled') };
	if (typeof value.stage !== 'string' || !RULE_STAGES.has(value.stage as RuleStage)) {
		return { ok: false, error: i18n.t('rules:importValidation.ruleInvalidStage') };
	}
	if (!Array.isArray(value.matchers))
		return { ok: false, error: i18n.t('rules:importValidation.ruleMissingMatchers') };
	if (!value.matchers.every(validateMatcher))
		return { ok: false, error: i18n.t('rules:importValidation.invalidMatcher') };
	if (!Array.isArray(value.actions) || value.actions.length === 0) {
		return { ok: false, error: i18n.t('rules:importValidation.ruleMissingActions') };
	}
	if (!value.actions.every(validateAction)) {
		return { ok: false, error: i18n.t('rules:importValidation.invalidAction') };
	}
	const stage = value.stage as RuleStage;
	const actions = value.actions as Action[];
	const chainCheck = validateChainInvariants(actions, stage);
	if (!chainCheck.ok) return chainCheck;
	if (typeof value.createdAt !== 'number')
		return { ok: false, error: i18n.t('rules:importValidation.missingCreatedAt') };
	if (typeof value.updatedAt !== 'number')
		return { ok: false, error: i18n.t('rules:importValidation.missingUpdatedAt') };
	return { ok: true, rule: value as unknown as Rule };
}

// Invariantes da chain — checados no import para falhar cedo em vez de salvar
// uma regra que nunca casa ou comporta-se mal em runtime. A UI (ActionChainEditor)
// aplica os mesmos limites; aqui é o gate para JSON cru ou storage adulterado.
//
// Hoje:
// 1. Cada action precisa ser válida no stage da regra (REQUEST/RESPONSE_STAGE_ACTIONS).
// 2. No máximo UMA action terminal (mock/block/breakpoint) por chain.
// 3. Se há terminal, ela tem que ser a última.
// 4. stage='response' com 2+ actions é rejeitado — Response stage ainda roda
//    no engine legado (`findMatchingRuleAction`, single-action), então
//    chains response não executam. Limite cai quando o pipeline `executeChain`
//    cobrir o Response stage (epic dual-stage, fase pós-Phase 9).
function validateChainInvariants(
	actions: Action[],
	stage: RuleStage,
): { ok: true } | { ok: false; error: string } {
	for (const action of actions) {
		if (!isActionValidForStage(action.type, stage)) {
			return {
				ok: false,
				error: i18n.t('rules:importValidation.actionInvalidForStage', {
					type: action.type,
					stage,
				}),
			};
		}
	}

	const terminalIndices: number[] = [];
	actions.forEach((action, index) => {
		if (isTerminalAction(action)) terminalIndices.push(index);
	});
	if (terminalIndices.length > 1) {
		return {
			ok: false,
			error: i18n.t('rules:importValidation.tooManyTerminals', {
				total: terminalIndices.length,
			}),
		};
	}
	if (terminalIndices.length === 1 && terminalIndices[0] !== actions.length - 1) {
		return {
			ok: false,
			error: i18n.t('rules:importValidation.terminalNotLast'),
		};
	}

	if (stage === 'response') {
		// Consistente com o cap da UI (ActionChainEditor): contamos só as
		// habilitadas. Uma action `enabled: false` é tratada como pausada e
		// não cria pressão sobre o engine legado single-action do Response stage.
		const enabledCount = actions.filter((a) => a.enabled).length;
		if (enabledCount > 1) {
			return {
				ok: false,
				error: i18n.t('rules:importValidation.responseChainUnsupported'),
			};
		}
	}

	return { ok: true };
}

export function validateRuleImport(value: unknown): RulesImportResult {
	if (!isPlainObject(value))
		return { ok: false, error: i18n.t('rules:importValidation.fileNotObject') };
	if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		return {
			ok: false,
			error: i18n.t('rules:importValidation.unsupportedSchema', {
				version: String(value.schemaVersion),
				expected: CURRENT_SCHEMA_VERSION,
			}),
		};
	}
	if (!Array.isArray(value.rules)) {
		return { ok: false, error: i18n.t('rules:importValidation.rulesNotArray') };
	}

	const rules: Rule[] = [];
	for (const raw of value.rules) {
		const validated = validateRule(raw);
		if (!validated.ok) return { ok: false, error: validated.error };
		rules.push(validated.rule);
	}
	return { ok: true, rules };
}
