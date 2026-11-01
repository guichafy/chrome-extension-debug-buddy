import { getStoredLanguage, LANGUAGE_STORAGE_KEY, setStoredLanguage } from '../preference';

function storageData(): Record<string, unknown> {
	return (chrome.storage.local as unknown as { _data: Record<string, unknown> })._data;
}

describe('preferência de idioma (chrome.storage.local)', () => {
	beforeEach(() => {
		delete storageData()[LANGUAGE_STORAGE_KEY];
	});

	it('retorna null quando o usuário nunca escolheu', async () => {
		await expect(getStoredLanguage()).resolves.toBeNull();
	});

	it('persiste e lê a escolha', async () => {
		await setStoredLanguage('en');
		expect(storageData()[LANGUAGE_STORAGE_KEY]).toBe('en');
		await expect(getStoredLanguage()).resolves.toBe('en');
	});

	it('lança quando o valor salvo não é um idioma suportado', async () => {
		storageData()[LANGUAGE_STORAGE_KEY] = 'fr';
		await expect(getStoredLanguage()).rejects.toThrow(/uiLanguage corrompido/);
	});
});
