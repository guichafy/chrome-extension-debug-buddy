import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SelectTabDialog } from '../SelectTabDialog';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const setupTabs = (tabs: any[]) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.resolve(tabs));
};

const setupQueryReject = (msg: string) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.reject(new Error(msg)));
};

const setupTargetTab = (tabId: number | null) => {
	const result = tabId === null ? {} : { targetTabInfo: { tabId, tabTitle: '', tabUrl: '' } };
	(chrome.storage.local.get as any).mockResolvedValue(result);
};

const sampleTabs = [
	{ id: 1, title: 'GitHub Issues', url: 'https://github.com/x/y/issues', index: 0 },
	{ id: 2, title: 'Localhost dev', url: 'http://localhost:5173/', index: 1 },
	{ id: 3, title: 'Docs MDN', url: 'https://developer.mozilla.org/', index: 2 },
];

describe('SelectTabDialog', () => {
	beforeEach(() => {
		(chrome.tabs.query as any).mockReset();
		(chrome.storage.local.get as any).mockReset();
		(chrome.runtime as any).lastError = undefined;
		setupTargetTab(null);
	});

	it('mostra spinner enquanto carrega e depois renderiza a lista', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		expect(screen.getByRole('status')).toBeInTheDocument();
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
	});

	it('renderiza badge "Atual" na aba que bate com targetTabInfo.tabId', async () => {
		setupTabs(sampleTabs);
		setupTargetTab(2);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getByText('Atual')).toBeInTheDocument());
		expect(screen.getByText('Atual').closest('[role="option"]')).toHaveAttribute('id', 'tab-row-2');
	});

	it('Enter na linha focada chama onSelectTab e fecha o dialog', async () => {
		setupTabs(sampleTabs);
		const onSelectTab = vi.fn();
		const onOpenChange = vi.fn();
		render(<SelectTabDialog open={true} onOpenChange={onOpenChange} onSelectTab={onSelectTab} />);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		fireEvent.keyDown(window, { key: 'ArrowDown' });
		fireEvent.keyDown(window, { key: 'Enter' });
		expect(onSelectTab).toHaveBeenCalledWith(2, 'Localhost dev', 'http://localhost:5173/');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('"/" foca o input de busca quando o foco não está em outro input', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		// Tira o foco do input (que recebe foco automático no mount)
		const list = screen.getByRole('listbox');
		fireEvent.keyDown(list, { key: '/' });
		expect(document.activeElement).toBe(screen.getByRole('searchbox'));
	});

	it('digitar na busca filtra a lista; "Limpar busca" reseta', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } });
		await waitFor(() => expect(screen.getByText(/Nenhuma aba corresponde a/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: /Limpar busca/ }));
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
	});

	it('estado error mostra mensagem real do erro com botão "Tentar novamente"', async () => {
		setupQueryReject('Tab access denied');
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getByText('Tab access denied')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
	});
});
