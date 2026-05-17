import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DualStageMigrationNotice } from '../DualStageMigrationNotice';
import { DUAL_STAGE_NOTICE_KEY } from '@/hooks/useDualStageMigrationNotice';

interface MockChromeStorage {
	_data: Record<string, unknown>;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
	const data: Record<string, unknown> = {};
	const storage = chrome.storage.local as unknown as MockChromeStorage;
	storage._data = data;
	storage.get = vi.fn(async (keys: string[] | string) => {
		const arr = Array.isArray(keys) ? keys : [keys];
		const out: Record<string, unknown> = {};
		for (const k of arr) {
			if (data[k] !== undefined) out[k] = data[k];
		}
		return out;
	}) as never;
	storage.set = vi.fn(async (patch: Record<string, unknown>) => {
		Object.assign(data, patch);
	}) as never;
});

function LocationProbe() {
	const location = useLocation();
	return <span data-testid="location">{location.pathname}</span>;
}

function renderWithRouter() {
	return render(
		<MemoryRouter initialEntries={['/command-center']}>
			<DualStageMigrationNotice />
			<Routes>
				<Route path="*" element={<LocationProbe />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('DualStageMigrationNotice', () => {
	test('renderiza banner quando flag ausente', async () => {
		renderWithRouter();
		await screen.findByTestId('dual-stage-migration-notice');
		expect(screen.getByText(/Schema das regras mudou/i)).toBeInTheDocument();
	});

	test('NÃO renderiza quando flag presente', async () => {
		const storage = chrome.storage.local as unknown as MockChromeStorage;
		storage._data[DUAL_STAGE_NOTICE_KEY] = Date.now();
		renderWithRouter();
		// Aguarda o effect rodar — não deve aparecer.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.queryByTestId('dual-stage-migration-notice')).not.toBeInTheDocument();
	});

	test('botão Entendi seta flag em storage e remove banner', async () => {
		const user = userEvent.setup();
		const storage = chrome.storage.local as unknown as MockChromeStorage;
		renderWithRouter();
		const notice = await screen.findByTestId('dual-stage-migration-notice');
		expect(notice).toBeInTheDocument();

		await act(async () => {
			await user.click(screen.getByTestId('dual-stage-migration-notice-dismiss'));
		});

		expect(screen.queryByTestId('dual-stage-migration-notice')).not.toBeInTheDocument();
		expect(storage._data[DUAL_STAGE_NOTICE_KEY]).toEqual(expect.any(Number));
	});

	test('botão "Abrir Rules Lab" navega para /rules-lab', async () => {
		const user = userEvent.setup();
		renderWithRouter();
		await screen.findByTestId('dual-stage-migration-notice');

		await user.click(screen.getByTestId('dual-stage-migration-notice-export'));
		expect(screen.getByTestId('location')).toHaveTextContent('/rules-lab');
	});
});
