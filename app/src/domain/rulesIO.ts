import type { Action, ActionType, Matcher, MatcherType, Rule, RuleStage } from '@/types/rules';

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
	if (!isPlainObject(value)) return { ok: false, error: 'regra não é objeto' };
	if (typeof value.id !== 'string') return { ok: false, error: 'regra sem id válido' };
	if (typeof value.name !== 'string') return { ok: false, error: 'regra sem name' };
	if (typeof value.enabled !== 'boolean') return { ok: false, error: 'regra sem enabled' };
	if (typeof value.stage !== 'string' || !RULE_STAGES.has(value.stage as RuleStage)) {
		return { ok: false, error: "regra sem stage válido ('request' | 'response')" };
	}
	if (!Array.isArray(value.matchers))
		return { ok: false, error: 'regra sem matchers (deve ser array)' };
	if (!value.matchers.every(validateMatcher))
		return { ok: false, error: 'matcher inválido na regra' };
	if (!Array.isArray(value.actions) || value.actions.length === 0) {
		return { ok: false, error: 'regra sem actions (deve ser array não vazio)' };
	}
	if (!value.actions.every(validateAction)) {
		return { ok: false, error: 'action inválida na regra' };
	}
	if (typeof value.createdAt !== 'number') return { ok: false, error: 'createdAt ausente' };
	if (typeof value.updatedAt !== 'number') return { ok: false, error: 'updatedAt ausente' };
	return { ok: true, rule: value as unknown as Rule };
}

export function validateRuleImport(value: unknown): RulesImportResult {
	if (!isPlainObject(value)) return { ok: false, error: 'arquivo não é objeto JSON' };
	if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		return {
			ok: false,
			error: `schemaVersion ${value.schemaVersion} não suportado (esperado ${CURRENT_SCHEMA_VERSION})`,
		};
	}
	if (!Array.isArray(value.rules)) {
		return { ok: false, error: 'rules deve ser um array' };
	}

	const rules: Rule[] = [];
	for (const raw of value.rules) {
		const validated = validateRule(raw);
		if (!validated.ok) return { ok: false, error: validated.error };
		rules.push(validated.rule);
	}
	return { ok: true, rules };
}
