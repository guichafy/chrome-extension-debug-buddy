import type { RedactionConfig } from '../types';
import { DEFAULT_REDACTION_CONFIG } from './defaults';

const STORAGE_KEY = 'privacyConfig';

function validateRegexList(label: string, list: string[]): void {
	for (const r of list) {
		// Lança SyntaxError se inválida — sem fallback (regra do projeto).
		new RegExp(r);
	}
	void label;
}

export function validateRedactionConfig(config: RedactionConfig): void {
	validateRegexList('headerRegex', config.headerRegex);
	validateRegexList('bodyRegex', config.bodyRegex);
	validateRegexList('consoleRegex', config.consoleRegex);
	if (config.autoPurgeRetentionDays < 1 || !Number.isFinite(config.autoPurgeRetentionDays)) {
		throw new RangeError('autoPurgeRetentionDays deve ser >= 1');
	}
}

export async function getPrivacyConfig(): Promise<RedactionConfig> {
	const stored = await chrome.storage.local.get(STORAGE_KEY);
	const raw = stored[STORAGE_KEY] as Partial<RedactionConfig> | undefined;
	if (!raw) return DEFAULT_REDACTION_CONFIG;
	const merged: RedactionConfig = { ...DEFAULT_REDACTION_CONFIG, ...raw };
	return merged;
}

export async function setPrivacyConfig(config: RedactionConfig): Promise<void> {
	validateRedactionConfig(config);
	await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

export function toRedactionApplied(config: RedactionConfig): RedactionConfig {
	return {
		...config,
		headerRegex: config.headerRegex.length > 0 ? [`<${config.headerRegex.length} regex(es)>`] : [],
		bodyRegex: config.bodyRegex.length > 0 ? [`<${config.bodyRegex.length} regex(es)>`] : [],
		consoleRegex:
			config.consoleRegex.length > 0 ? [`<${config.consoleRegex.length} regex(es)>`] : [],
	};
}
