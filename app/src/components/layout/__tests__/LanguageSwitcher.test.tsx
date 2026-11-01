import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/instance';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/preference';
import { LanguageSwitcher } from '../LanguageSwitcher';

function storageData(): Record<string, unknown> {
	return (chrome.storage.local as unknown as { _data: Record<string, unknown> })._data;
}

// Componente qualquer traduzido, para provar que a troca re-renderiza a UI.
function StartButtonLabel() {
	const { t } = useTranslation('layout');
	return <span>{t('header.startAnalysis')}</span>;
}

describe('LanguageSwitcher', () => {
	beforeEach(() => {
		delete storageData()[LANGUAGE_STORAGE_KEY];
	});

	afterEach(async () => {
		await i18n.changeLanguage('pt-BR');
	});

	it('mostra o idioma ativo pelo nome nativo', () => {
		render(<LanguageSwitcher />);
		expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveTextContent(
			'Português (Brasil)',
		);
	});

	it('trocar para English re-renderiza a UI em inglês e persiste a escolha', async () => {
		const user = userEvent.setup();
		render(
			<>
				<LanguageSwitcher />
				<StartButtonLabel />
			</>,
		);
		expect(screen.getByText('Iniciar Análise')).toBeInTheDocument();

		await user.click(screen.getByRole('combobox', { name: 'Idioma' }));
		await user.click(await screen.findByRole('option', { name: 'English' }));

		await waitFor(() => expect(screen.getByText('Start Analysis')).toBeInTheDocument());
		expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('English');
		expect(storageData()[LANGUAGE_STORAGE_KEY]).toBe('en');
		expect(i18n.language).toBe('en');
	});

	it('mostra o erro quando a preferência não pode ser salva', async () => {
		const user = userEvent.setup();
		vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('quota excedida'));
		render(<LanguageSwitcher />);

		await user.click(screen.getByRole('combobox', { name: 'Idioma' }));
		await user.click(await screen.findByRole('option', { name: 'English' }));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Não foi possível salvar o idioma: quota excedida',
		);
		expect(i18n.language).toBe('pt-BR');
	});
});
