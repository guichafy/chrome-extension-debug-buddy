import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DUAL_STAGE_NOTICE_KEY, useDualStageMigrationNotice } from '../useDualStageMigrationNotice';

function Probe() {
	const { show, dismiss } = useDualStageMigrationNotice();
	return (
		<div>
			<span data-testid="probe-show">{show ? 'yes' : 'no'}</span>
			<button type="button" onClick={() => void dismiss()} data-testid="probe-dismiss">
				dismiss
			</button>
		</div>
	);
}

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

describe('useDualStageMigrationNotice', () => {
	test('show=true quando flag não está em storage', async () => {
		render(<Probe />);
		await screen.findByText('yes');
	});

	test('show=false quando flag já existe', async () => {
		const storage = chrome.storage.local as unknown as MockChromeStorage;
		storage._data[DUAL_STAGE_NOTICE_KEY] = Date.now();

		render(<Probe />);
		// Inicial render → 'no' (default) ou 'yes' (effect roda async). Esperamos
		// que após o effect siga 'no'.
		await screen.findByText('no');
	});

	test('dismiss seta flag e esconde', async () => {
		const user = userEvent.setup();
		const storage = chrome.storage.local as unknown as MockChromeStorage;
		render(<Probe />);
		await screen.findByText('yes');

		await act(async () => {
			await user.click(screen.getByTestId('probe-dismiss'));
		});

		await screen.findByText('no');
		expect(storage._data[DUAL_STAGE_NOTICE_KEY]).toEqual(expect.any(Number));
	});
});
