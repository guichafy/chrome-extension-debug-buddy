import type { Rule } from '../types/rules';
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
 * Conversão pura: dado um snapshot de chrome.storage.local, retorna o
 * conjunto final de `rules` + flag indicando se havia dados legados.
 *
 * Esta função NÃO toca em chrome.storage — recebe entrada e devolve saída.
 * O runner em runLegacyMigration() lida com I/O e idempotência.
 */
export function convertLegacyStorage(
	input: MigrationInput,
	now: number = Date.now(),
	idGenerator: () => string = () => crypto.randomUUID(),
): MigrationOutput {
	const existingRules = input.rules ?? [];
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
			matchers: [
				{ type: 'url', enabled: true, pattern, isRegex },
				...(method ? [{ type: 'method' as const, enabled: true, method }] : []),
			],
			action: { type: 'breakpoint', enabled: true },
			createdAt: now,
			updatedAt: now,
		});
	}

	const legacyMocks = input.mocks ?? [];
	for (const mock of legacyMocks) {
		if (!mock.urlPattern) continue;
		const headers = mock.headers ?? {};
		const contentType = headers['Content-Type'] ?? headers['content-type'] ?? 'application/json';
		newRules.push({
			id: idGenerator(),
			name: mock.urlPattern,
			enabled: mock.enabled !== false,
			matchers: [
				{ type: 'url', enabled: true, pattern: mock.urlPattern, isRegex: false },
				...(mock.method ? [{ type: 'method' as const, enabled: true, method: mock.method }] : []),
			],
			action: {
				type: 'mock',
				enabled: true,
				status: mock.status,
				headers,
				body: mock.body ?? '',
				contentType,
			},
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
