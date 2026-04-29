import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CommandCenter from '../CommandCenter';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useAllRequests');
vi.mock('@/hooks/useResponses');
vi.mock('@/hooks/useRules');
vi.mock('@/lib/indexedDB', () => ({
	indexedDBService: { init: vi.fn().mockResolvedValue(undefined) },
}));

describe('CommandCenter', () => {
	beforeEach(() => {
		vi.mocked(useAllRequests).mockReturnValue({
			allRequests: {
				r1: {
					url: 'https://api.example.com/u',
					method: 'GET',
					status: 200,
					statusText: 'OK',
					headers: {},
					type: 'XHR',
					timestamp: 1,
				},
			},
			filteredRequests: {
				r1: {
					url: 'https://api.example.com/u',
					method: 'GET',
					status: 200,
					statusText: 'OK',
					headers: {},
					type: 'XHR',
					timestamp: 1,
				},
			},
			filters: [],
			setFilters: vi.fn(),
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn(),
			getRequestDetails: vi.fn(),
			currentRequest: null,
			currentRequestId: null,
			loading: false,
			loadAllRequests: vi.fn(),
			clearCurrentRequest: vi.fn(),
			dbInitialized: true,
		} as any);

		vi.mocked(useResponses).mockReturnValue({
			pendingResponses: {},
			approveResponse: vi.fn().mockResolvedValue(true),
			ignoreResponse: vi.fn().mockResolvedValue(true),
			clearCurrentResponse: vi.fn(),
		} as any);

		vi.mocked(useRules).mockReturnValue({ rules: [], addRule: vi.fn() } as any);
	});

	test('seleção de request atualiza inspector sem abrir modal', () => {
		render(
			<MemoryRouter>
				<CommandCenter />
			</MemoryRouter>,
		);

		// inspector desmontado quando nenhuma request selecionada
		expect(screen.queryByText(/Selecione uma requisição/)).toBeNull();

		const row = screen.getByText('https://api.example.com/u');
		fireEvent.click(row);

		expect(screen.queryByText(/Selecione uma requisição/)).toBeNull();
		expect(screen.getAllByText(/api.example.com/).length).toBeGreaterThan(0);
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	test('tabela ocupa largura cheia quando nenhuma request está selecionada', () => {
		render(
			<MemoryRouter>
				<CommandCenter />
			</MemoryRouter>,
		);

		// inspector não montado → apenas 1 section (timeline)
		const sections = document.querySelectorAll('section');
		expect(sections.length).toBe(1);
	});

	test('alternar entre duas requests reflete o conteúdo correto no inspector', () => {
		vi.mocked(useAllRequests).mockReturnValue({
			allRequests: {},
			filteredRequests: {
				r1: {
					url: 'https://api.example.com/r1',
					method: 'GET',
					status: 200,
					statusText: 'OK',
					headers: {},
					type: 'XHR',
					timestamp: 1,
				},
				r2: {
					url: 'https://api.example.com/r2',
					method: 'POST',
					status: 201,
					statusText: 'Created',
					headers: {},
					type: 'XHR',
					timestamp: 2,
				},
			},
			filters: [],
			setFilters: vi.fn(),
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn(),
			getRequestDetails: vi.fn(),
			currentRequest: null,
			currentRequestId: null,
			loading: false,
			loadAllRequests: vi.fn(),
			clearCurrentRequest: vi.fn(),
			dbInitialized: true,
		} as any);

		render(
			<MemoryRouter>
				<CommandCenter />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByText('https://api.example.com/r1'));
		expect(screen.getAllByText('GET').length).toBeGreaterThan(0);

		fireEvent.click(screen.getByText('https://api.example.com/r2'));
		expect(screen.getAllByText('POST').length).toBeGreaterThan(0);
	});
});
