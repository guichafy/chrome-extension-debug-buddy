// Preferência global: quando true, a gravação NÃO acompanha automaticamente o
// startDebugging. Default é false (gravação ligada com a interceptação).
//
// Storage namespace é `chrome.storage.local.recordingDisabled` (boolean).
// Sem default fabricado: se o valor armazenado não for boolean, lançamos —
// regra no-fallbacks. Cabe ao caller decidir como tratar.

const STORAGE_KEY = 'recordingDisabled';

export async function getRecordingDisabled(): Promise<boolean> {
	const result = await chrome.storage.local.get([STORAGE_KEY]);
	const raw = result[STORAGE_KEY];
	if (raw === undefined) return false; // chave nunca escrita = default
	if (typeof raw !== 'boolean') {
		throw new Error(
			`recordingDisabled corrompido em chrome.storage: esperava boolean, recebi ${typeof raw}`,
		);
	}
	return raw;
}

export async function setRecordingDisabled(value: boolean): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: value });
}
