import type { Action, Rule } from '../types/rules';
import type { MockConfig, UrlPattern } from '../types/legacy';

/**
 * Backup gravado em chrome.storage.local antes de remover urlPatterns/mocks.
 * Mantido por 1 release como rede de segurança. A próxima fase do refactor
 * (ou um cleanup explícito) pode remover este backup quando ninguém mais
 * tiver dados legados.
 */
export interface LegacyBackup {
	urlPatterns?: (string | UrlPattern)[];
	mocks?: MockConfig[];
	migrated_at: number;
}

export interface MigrationInput {
	urlPatterns?: (string | UrlPattern)[];
	mocks?: MockConfig[];
	rules?: Rule[];
}

export interface MigrationOutput {
	rules: Rule[];
	hadLegacyData: boolean;
}

/**
 * Phase 1 (dual-stage): a renomeação `modify` → `transform` foi feita há
 * muito; manter o helper como no-op preserva o contrato público enquanto a
 * Phase 9 cuida do wipe v1→v2 (breaking change). Retornamos as regras como
 * vieram, sem tentar inferir transforms.
 */
function ensureRuleShape(rule: Rule): Rule {
	return rule;
}

export function renameModifyToTransform(rules: Rule[]): { rules: Rule[]; renamed: number } {
	return { rules, renamed: 0 };
}

/**
 * Conversão pura: dado um snapshot de chrome.storage.local, retorna o
 * conjunto final de `rules` + flag indicando se havia dados legados.
 *
 * Esta função NÃO toca em chrome.storage — recebe entrada e devolve saída.
 * O runner em runLegacyMigration() lida com I/O e idempotência.
 *
 * Phase 1 (dual-stage): regras geradas a partir de urlPatterns/mocks legados
 * (v0.x) nascem no schema v2 (`stage` + `actions[]`). Breakpoints e mocks
 * vão para `stage='response'` (comportamento histórico).
 */
export function convertLegacyStorage(
	input: MigrationInput,
	now: number = Date.now(),
	idGenerator: () => string = () => crypto.randomUUID(),
): MigrationOutput {
	const existingRules = (input.rules ?? []).map(ensureRuleShape);
	const newRules: Rule[] = [];

	const legacyUrlPatterns = input.urlPatterns ?? [];
	for (const entry of legacyUrlPatterns) {
		const pattern = typeof entry === 'string' ? entry : entry.url;
		if (!pattern) continue;
		const isRegex = typeof entry === 'object' ? Boolean(entry.isRegex) : false;
		const enabled = typeof entry === 'object' ? entry.enabled !== false : true;
		const method = typeof entry === 'object' ? entry.method : '';

		newRules.push({
			id: idGenerator(),
			name: pattern,
			enabled,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern, isRegex },
				...(method ? [{ type: 'method' as const, enabled: true, method }] : []),
			],
			actions: [{ type: 'breakpoint', enabled: true }],
			createdAt: now,
			updatedAt: now,
		});
	}

	const legacyMocks = input.mocks ?? [];
	for (const mock of legacyMocks) {
		if (!mock.urlPattern) continue;
		const headers = mock.headers ?? {};
		const contentType = headers['Content-Type'] ?? headers['content-type'];
		const action: Action = {
			type: 'mock',
			enabled: true,
			status: mock.status,
			headers,
			...(mock.body !== undefined ? { body: mock.body } : {}),
			...(contentType !== undefined ? { contentType } : {}),
		};
		newRules.push({
			id: idGenerator(),
			name: mock.urlPattern,
			enabled: mock.enabled !== false,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: mock.urlPattern, isRegex: false },
				...(mock.method ? [{ type: 'method' as const, enabled: true, method: mock.method }] : []),
			],
			actions: [action],
			createdAt: mock.createdAt ?? now,
			updatedAt: now,
		});
	}

	return {
		rules: [...existingRules, ...newRules],
		hadLegacyData: legacyUrlPatterns.length > 0 || legacyMocks.length > 0,
	};
}

/**
 * Runner stateful — idempotente via legacy_migrated_at.
 * Chamado uma vez em chrome.runtime.onInstalled e em chrome.runtime.onStartup.
 */
export async function runLegacyMigration(): Promise<{ migrated: boolean; reason?: string }> {
	const stored = await chrome.storage.local.get([
		'urlPatterns',
		'mocks',
		'rules',
		'legacy_migrated_at',
	]);

	if (stored.legacy_migrated_at) {
		return { migrated: false, reason: 'already_migrated' };
	}

	const result = convertLegacyStorage({
		urlPatterns: stored.urlPatterns,
		mocks: stored.mocks,
		rules: stored.rules,
	});

	if (!result.hadLegacyData) {
		// Marca como migrado mesmo sem dados, para não tentar de novo em todo startup.
		await chrome.storage.local.set({ legacy_migrated_at: Date.now() });
		return { migrated: false, reason: 'no_legacy_data' };
	}

	const backup: LegacyBackup = {
		urlPatterns: stored.urlPatterns,
		mocks: stored.mocks,
		migrated_at: Date.now(),
	};

	await chrome.storage.local.set({
		rules: result.rules,
		legacy_backup_v1: backup,
		legacy_migrated_at: Date.now(),
	});
	await chrome.storage.local.remove(['urlPatterns', 'mocks']);

	console.log(
		`[legacyMigration] Migrated ${(stored.urlPatterns ?? []).length} urlPatterns + ${(stored.mocks ?? []).length} mocks → ${result.rules.length} rules. Backup in legacy_backup_v1.`,
	);

	return { migrated: true };
}

/**
 * Backfill de `enabled` em regras gravadas antes do campo existir ou que
 * tenham sido importadas/manipuladas externamente sem ele. Pura — recebe e
 * devolve regras. Não toca no campo quando já é boolean.
 */
export function backfillEnabled(rules: Rule[]): { rules: Rule[]; backfilled: number } {
	let backfilled = 0;
	const out = rules.map((rule) => {
		if (typeof rule.enabled === 'boolean') return rule;
		backfilled += 1;
		return { ...rule, enabled: true };
	});
	return { rules: out, backfilled };
}

/**
 * Runner stateful para o backfill de `enabled` (US-005). Garante que toda
 * regra persistida tenha `enabled: boolean`, defaultando para `true` quando
 * ausente. Idempotente via `enabled_backfill_migrated_at`.
 */
export async function runEnabledBackfillMigration(): Promise<{
	migrated: boolean;
	reason?: string;
	backfilled?: number;
}> {
	const stored = await chrome.storage.local.get(['rules', 'enabled_backfill_migrated_at']);

	if (stored.enabled_backfill_migrated_at) {
		return { migrated: false, reason: 'already_migrated' };
	}

	const rules: Rule[] = Array.isArray(stored.rules) ? stored.rules : [];
	const { rules: nextRules, backfilled } = backfillEnabled(rules);

	if (backfilled === 0) {
		await chrome.storage.local.set({ enabled_backfill_migrated_at: Date.now() });
		return { migrated: false, reason: 'no_rules_to_backfill' };
	}

	await chrome.storage.local.set({
		rules: nextRules,
		enabled_backfill_migrated_at: Date.now(),
	});

	console.log(`[legacyMigration] Backfilled enabled=true em ${backfilled} regras.`);
	return { migrated: true, backfilled };
}

/**
 * No-op em Phase 1 (dual-stage): a migração `modify` → `transform` foi feita
 * há muito e o schema v2 não tem mais `Rule.action`. Mantemos o runner com
 * mesma assinatura para não quebrar callers existentes (Phase 9 removerá).
 */
export async function runModifyToTransformMigration(): Promise<{
	migrated: boolean;
	reason?: string;
	renamed?: number;
}> {
	const stored = await chrome.storage.local.get(['modify_to_transform_migrated_at']);
	if (stored.modify_to_transform_migrated_at) {
		return { migrated: false, reason: 'already_migrated' };
	}
	await chrome.storage.local.set({ modify_to_transform_migrated_at: Date.now() });
	return { migrated: false, reason: 'noop_in_v2_schema' };
}
