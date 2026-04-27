import { renderHook, act } from '@testing-library/react';
import { useUrlPatterns } from '../useUrlPatterns';

// Mock do chrome.storage.local
const mockGet = vi.fn();
const mockSet = vi.fn();

beforeEach(() => {
	// Limpar mocks antes de cada teste
	mockGet.mockClear();
	mockSet.mockClear();

	// Configurar o mock do chrome.storage.local
	// Criar um mock completo para evitar erros de tipo
	const mockStorageArea = {
		get: mockGet,
		set: mockSet,
		QUOTA_BYTES: 5242880,
		getBytesInUse: vi.fn(),
		clear: vi.fn(),
		remove: vi.fn(),
		setAccessLevel: vi.fn(),
		onChanged: {
			addListener: vi.fn(),
			getRules: vi.fn(),
			hasListener: vi.fn(),
			removeRules: vi.fn(),
			addRules: vi.fn(),
			removeListener: vi.fn(),
			hasListeners: vi.fn(),
		},
	};

	// Usar o tipo 'any' para evitar erros de tipo no teste
	global.chrome = {
		...global.chrome,
		storage: {
			local: mockStorageArea,
			sync: { ...mockStorageArea },
			managed: { ...mockStorageArea },
			session: { ...mockStorageArea },
			AccessLevel: {
				TRUSTED_AND_UNTRUSTED_CONTEXTS: 'trusted_and_untrusted_contexts',
				TRUSTED_CONTEXTS: 'trusted_contexts',
			},
			onChanged: {
				addListener: vi.fn(),
				getRules: vi.fn(),
				hasListener: vi.fn(),
				removeRules: vi.fn(),
				addRules: vi.fn(),
				removeListener: vi.fn(),
				hasListeners: vi.fn(),
			},
		},
	} as any;
});

describe('useUrlPatterns hook', () => {
	test('deve carregar padrões de URL do armazenamento', async () => {
		// Configurar o mock para retornar alguns padrões
		const mockPatterns = [
			{ url: 'api.example.com', method: 'GET', enabled: true },
			{ url: 'api.test.com', method: 'POST', enabled: false },
		];

		mockGet.mockImplementation(() => {
			return Promise.resolve({ urlPatterns: mockPatterns });
		});

		// Renderizar o hook
		const { result } = renderHook(() => useUrlPatterns());

		// Esperar que o hook carregue os padrões
		await act(async () => {
			await result.current.loadUrlPatterns();
		});

		// Verificar se o hook carregou os padrões corretamente
		expect(result.current.urlPatterns).toEqual(mockPatterns);
		expect(mockGet).toHaveBeenCalledWith(['urlPatterns']);
	});

	test('deve adicionar um novo padrão de URL', async () => {
		// Configurar o mock para retornar um array vazio inicialmente
		mockGet.mockImplementation(() => {
			return Promise.resolve({ urlPatterns: [] });
		});

		// Renderizar o hook
		const { result } = renderHook(() => useUrlPatterns());

		// Esperar que o hook carregue os padrões
		await act(async () => {
			await result.current.loadUrlPatterns();
		});

		// Adicionar um novo padrão
		await act(async () => {
			await result.current.addUrlPattern(
				'api.example.com',
				'GET',
				'Content-Type',
				'application/json',
				'request',
			);
		});

		// Verificar se o padrão foi adicionado corretamente
		expect(mockSet).toHaveBeenCalledWith({
			urlPatterns: [
				{
					url: 'api.example.com',
					method: 'GET',
					headerType: 'request',
					headerName: 'Content-Type',
					headerValue: 'application/json',
					enabled: true,
					isRegex: false,
				},
			],
		});
	});

	test('deve remover um padrão de URL', async () => {
		// Configurar o mock para retornar alguns padrões
		const mockPatterns = [
			{ url: 'api.example.com', method: 'GET', enabled: true },
			{ url: 'api.test.com', method: 'POST', enabled: false },
		];

		mockGet.mockImplementation(() => {
			return Promise.resolve({ urlPatterns: mockPatterns });
		});

		// Renderizar o hook
		const { result } = renderHook(() => useUrlPatterns());

		// Esperar que o hook carregue os padrões
		await act(async () => {
			await result.current.loadUrlPatterns();
		});

		// Remover um padrão
		await act(async () => {
			await result.current.removeUrlPattern(0);
		});

		// Verificar se o padrão foi removido corretamente
		expect(mockSet).toHaveBeenCalledWith({
			urlPatterns: [{ url: 'api.test.com', method: 'POST', enabled: false }],
		});
	});

	test('deve alternar o estado de habilitado/desabilitado de uma regra', async () => {
		// Configurar o mock para retornar alguns padrões
		const mockPatterns = [
			{ url: 'api.example.com', method: 'GET', enabled: true },
			{ url: 'api.test.com', method: 'POST', enabled: false },
		];

		mockGet.mockImplementation(() => {
			return Promise.resolve({ urlPatterns: mockPatterns });
		});

		// Renderizar o hook
		const { result } = renderHook(() => useUrlPatterns());

		// Esperar que o hook carregue os padrões
		await act(async () => {
			await result.current.loadUrlPatterns();
		});

		// Alternar o estado da primeira regra
		await act(async () => {
			await result.current.toggleRuleEnabled(0);
		});

		// Verificar se o estado foi alternado corretamente
		expect(mockSet).toHaveBeenCalledWith({
			urlPatterns: [
				{ url: 'api.example.com', method: 'GET', enabled: false },
				{ url: 'api.test.com', method: 'POST', enabled: false },
			],
		});

		// Alternar o estado da segunda regra
		mockSet.mockClear();
		await act(async () => {
			await result.current.toggleRuleEnabled(1);
		});

		// Verificar se o estado foi alternado corretamente
		expect(mockSet).toHaveBeenCalledWith({
			urlPatterns: [
				{ url: 'api.example.com', method: 'GET', enabled: false },
				{ url: 'api.test.com', method: 'POST', enabled: true },
			],
		});
	});

	test('deve atualizar uma regra existente', async () => {
		// Configurar o mock para retornar alguns padrões
		const mockPatterns = [
			{ url: 'api.example.com', method: 'GET', enabled: true },
			{ url: 'api.test.com', method: 'POST', enabled: false },
		];

		mockGet.mockImplementation(() => {
			return Promise.resolve({ urlPatterns: mockPatterns });
		});

		// Renderizar o hook
		const { result } = renderHook(() => useUrlPatterns());

		// Esperar que o hook carregue os padrões
		await act(async () => {
			await result.current.loadUrlPatterns();
		});

		// Atualizar a primeira regra
		const updatedRule = {
			url: 'api.example.com/v2',
			method: 'POST',
			headerType: 'request',
			headerName: 'Authorization',
			headerValue: 'Bearer token',
			enabled: true,
		};

		await act(async () => {
			await result.current.updateUrlPattern(0, updatedRule);
		});

		// Verificar se a regra foi atualizada corretamente
		expect(mockSet).toHaveBeenCalledWith({
			urlPatterns: [updatedRule, { url: 'api.test.com', method: 'POST', enabled: false }],
		});
	});
});
