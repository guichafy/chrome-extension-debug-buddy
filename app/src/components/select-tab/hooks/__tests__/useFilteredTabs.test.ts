import { act, renderHook, waitFor } from '@testing-library/react';
import { INVALID_HOSTNAME } from '../../types';
import { useFilteredTabs } from '../useFilteredTabs';

const mockQuery = (tabs: Partial<chrome.tabs.Tab>[]) => {
	(chrome.tabs.query as any).mockImplementation((_q: any, cb?: any) => {
		if (cb) {
			cb(tabs);
			return undefined;
		}
		return Promise.resolve(tabs);
	});
};

const mockQueryReject = (message: string) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.reject(new Error(message)));
};

describe('useFilteredTabs', () => {
	beforeEach(() => {
		(chrome.tabs.query as any).mockReset();
		(chrome.runtime as any).lastError = undefined;
	});

	it('retorna state="loading" enquanto a query não resolveu', () => {
		(chrome.tabs.query as any).mockImplementation(() => new Promise(() => {}));
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		expect(result.current.state).toBe('loading');
		expect(result.current.allTabs).toEqual([]);
	});

	it('expõe state="error" com a mensagem real quando chrome.tabs.query rejeita', async () => {
		mockQueryReject('Tab access denied');
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('error'));
		expect(result.current.error?.message).toBe('Tab access denied');
		expect(result.current.allTabs).toEqual([]);
	});

	it('filtra abas inelegíveis (chrome://, chrome-extension://, about:, view-source:, devtools://, sem id/title/url)', async () => {
		mockQuery([
			{ id: 1, title: 'OK', url: 'https://example.com/', index: 0 },
			{ id: 2, title: 'Internal', url: 'chrome://settings', index: 1 },
			{
				id: 3,
				title: 'Ext',
				url: 'chrome-extension://abc/options.html',
				index: 2,
			},
			{ id: 4, title: 'About', url: 'about:blank', index: 3 },
			{
				id: 5,
				title: 'View',
				url: 'view-source:https://example.com/',
				index: 4,
			},
			{
				id: 6,
				title: 'DevTools',
				url: 'devtools://devtools/bundled/inspector.html',
				index: 5,
			},
			{ id: undefined, title: 'No ID', url: 'https://noid.example/', index: 6 },
			{ id: 8, title: '', url: 'https://empty-title.example/', index: 7 },
			{ id: 9, title: 'No URL', url: undefined, index: 8 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.allTabs.map((t) => t.id)).toEqual([1]);
	});

	it('agrupa domínios e ordena por contagem decrescente', async () => {
		mockQuery([
			{ id: 1, title: 'Issue 1', url: 'https://github.com/a', index: 0 },
			{ id: 2, title: 'Issue 2', url: 'https://github.com/b', index: 1 },
			{ id: 3, title: 'Issue 3', url: 'https://github.com/c', index: 2 },
			{ id: 4, title: 'SO', url: 'https://stackoverflow.com/q/1', index: 3 },
			{ id: 5, title: 'Local', url: 'http://localhost:3000/', index: 4 },
			{ id: 6, title: 'Local 2', url: 'http://localhost:5173/', index: 5 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.domains).toEqual([
			{ name: 'github.com', count: 3 },
			{ name: 'localhost', count: 2 },
			{ name: 'stackoverflow.com', count: 1 },
		]);
	});

	it('classifica URLs inválidas no domínio "(URL inválida)"', async () => {
		mockQuery([
			{ id: 1, title: 'OK', url: 'https://example.com/', index: 0 },
			{ id: 2, title: 'Quebrada', url: 'not-a-url', index: 1 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		const broken = result.current.allTabs.find((t) => t.id === 2);
		expect(broken?.hostname).toBe(INVALID_HOSTNAME);
		expect(result.current.domains.find((d) => d.name === INVALID_HOSTNAME)?.count).toBe(1);
	});

	it('busca é case-insensitive em título E URL', async () => {
		mockQuery([
			{ id: 1, title: 'Debug Buddy', url: 'http://localhost:5173/', index: 0 },
			{
				id: 2,
				title: 'Outra coisa',
				url: 'https://example.com/debug',
				index: 1,
			},
			{ id: 3, title: 'Sem match', url: 'https://example.com/', index: 2 },
		]);
		const { result, rerender } = renderHook(
			({ q }: { q: string }) => useFilteredTabs(true, q, null),
			{ initialProps: { q: '' } },
		);
		await waitFor(() => expect(result.current.state).toBe('ready'));
		rerender({ q: 'DEBUG' });
		expect(result.current.filteredTabs.map((t) => t.id).sort()).toEqual([1, 2]);
	});

	it('activeDomain filtra apenas abas daquele hostname; null retorna todas', async () => {
		mockQuery([
			{ id: 1, title: 'A', url: 'https://github.com/a', index: 0 },
			{ id: 2, title: 'B', url: 'http://localhost:3000/', index: 1 },
		]);
		const { result, rerender } = renderHook(
			({ d }: { d: string | null }) => useFilteredTabs(true, '', d),
			{ initialProps: { d: null as string | null } },
		);
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.filteredTabs).toHaveLength(2);
		rerender({ d: 'github.com' });
		expect(result.current.filteredTabs.map((t) => t.id)).toEqual([1]);
	});

	it('não dispara query quando open=false', () => {
		mockQuery([{ id: 1, title: 'X', url: 'https://x.example/', index: 0 }]);
		renderHook(() => useFilteredTabs(false, '', null));
		expect(chrome.tabs.query).not.toHaveBeenCalled();
	});

	it('reload() força nova query (transita error → ready se a próxima resolver)', async () => {
		mockQueryReject('first failure');
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('error'));
		mockQuery([{ id: 1, title: 'X', url: 'https://x.example/', index: 0 }]);
		act(() => result.current.reload());
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.allTabs).toHaveLength(1);
	});
});
