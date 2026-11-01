// Bootstrap da UI com módulos frescos a cada teste: `initUiI18n` inicializa
// uma instância nova do i18next (a do vitest.setup fica intocada).
import { LANGUAGE_STORAGE_KEY } from '../preference';

type UiModule = typeof import('../ui');
type InstanceModule = typeof import('../instance');

function storageData(): Record<string, unknown> {
	return (chrome.storage.local as unknown as { _data: Record<string, unknown> })._data;
}

async function freshModules(): Promise<{ ui: UiModule; instance: InstanceModule }> {
	vi.resetModules();
	const ui = await import('../ui');
	const instance = await import('../instance');
	return { ui, instance };
}

describe('i18n da UI', () => {
	beforeEach(() => {
		delete storageData()[LANGUAGE_STORAGE_KEY];
		vi.mocked(chrome.i18n.getUILanguage).mockReturnValue('pt-BR');
		vi.mocked(chrome.storage.onChanged.addListener).mockClear();
		document.documentElement.lang = '';
	});

	it('inicia no idioma salvo e carrega só o catálogo desse idioma', async () => {
		storageData()[LANGUAGE_STORAGE_KEY] = 'en';
		const { ui, instance } = await freshModules();

		await ui.initUiI18n();

		expect(instance.i18n.language).toBe('en');
		expect(instance.i18n.t('layout:header.startAnalysis')).toBe('Start Analysis');
		expect(document.documentElement.lang).toBe('en');
		// Lazy loading: o catálogo pt-BR não foi baixado.
		expect(instance.i18n.hasResourceBundle('pt-BR', 'layout')).toBe(false);
		expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(
			ui.handleLanguageStorageChange,
		);
	});

	it('sem preferência salva, segue o idioma do navegador', async () => {
		const { ui, instance } = await freshModules();

		await ui.initUiI18n();

		expect(instance.i18n.language).toBe('pt-BR');
		expect(instance.i18n.t('layout:header.startAnalysis')).toBe('Iniciar Análise');
	});

	it('navegador em idioma não suportado abre em inglês', async () => {
		vi.mocked(chrome.i18n.getUILanguage).mockReturnValue('de-DE');
		const { ui, instance } = await freshModules();

		await ui.initUiI18n();

		expect(instance.i18n.language).toBe('en');
	});

	it('preferência corrompida é reportada e o idioma do navegador é usado', async () => {
		storageData()[LANGUAGE_STORAGE_KEY] = 'fr';
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { ui, instance } = await freshModules();

		await ui.initUiI18n();

		expect(instance.i18n.language).toBe('pt-BR');
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining('preferência de idioma inválida'),
			expect.any(Error),
		);
		consoleError.mockRestore();
	});

	it('selectUiLanguage persiste a escolha e troca o idioma (carregando o catálogo sob demanda)', async () => {
		const { ui, instance } = await freshModules();
		await ui.initUiI18n();
		expect(instance.i18n.hasResourceBundle('en', 'layout')).toBe(false);

		await ui.selectUiLanguage('en');

		expect(storageData()[LANGUAGE_STORAGE_KEY]).toBe('en');
		expect(instance.i18n.language).toBe('en');
		expect(instance.i18n.t('layout:nav.sessions')).toBe('Sessions');
		expect(document.documentElement.lang).toBe('en');
	});

	it('troca feita em outra página (storage.onChanged) é aplicada aqui', async () => {
		const { ui, instance } = await freshModules();
		await ui.initUiI18n();

		ui.handleLanguageStorageChange({ [LANGUAGE_STORAGE_KEY]: { newValue: 'en' } }, 'local');

		await vi.waitFor(() => expect(instance.i18n.language).toBe('en'));
	});

	it('remover a preferência volta a seguir o navegador', async () => {
		storageData()[LANGUAGE_STORAGE_KEY] = 'en';
		const { ui, instance } = await freshModules();
		await ui.initUiI18n();

		ui.handleLanguageStorageChange(
			{ [LANGUAGE_STORAGE_KEY]: { oldValue: 'en', newValue: undefined } },
			'local',
		);

		await vi.waitFor(() => expect(instance.i18n.language).toBe('pt-BR'));
	});

	it('ignora outras áreas/chaves do storage e reporta valor inválido', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { ui, instance } = await freshModules();
		await ui.initUiI18n();

		ui.handleLanguageStorageChange({ [LANGUAGE_STORAGE_KEY]: { newValue: 'en' } }, 'sync');
		ui.handleLanguageStorageChange({ rules: { newValue: [] } }, 'local');
		ui.handleLanguageStorageChange({ [LANGUAGE_STORAGE_KEY]: { newValue: 'xx' } }, 'local');

		expect(instance.i18n.language).toBe('pt-BR');
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining('preferência de idioma inválida'),
			'xx',
		);
		consoleError.mockRestore();
	});
});
