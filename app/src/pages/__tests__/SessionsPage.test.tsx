import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetForTests, sessionStore } from '@/lib/session/storage';
import { SessionsPage } from '../SessionsPage';
import type { Session } from '@/lib/session/types';

const sendMessageMock = vi.fn();

const sess = (id: string, startedAt: number, endedAt: number | null = null): Session => ({
	id,
	schemaVersion: 1,
	startedAt,
	endedAt,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: `https://example/${id}`,
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
});

beforeEach(async () => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
	_resetForTests();
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('SessionsPage', () => {
	it('mostra empty state quando não há sessões', async () => {
		render(
			<MemoryRouter>
				<SessionsPage />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByText(/Nenhuma sessão salva/i)).toBeInTheDocument();
		});
	});

	it('lista sessões e mostra contagem', async () => {
		await sessionStore.put(sess('a', 1));
		await sessionStore.put(sess('b', 2));
		render(
			<MemoryRouter>
				<SessionsPage />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByText(/2 \/ 10/i)).toBeInTheDocument();
		});
		expect(screen.getByText('https://example/a')).toBeInTheDocument();
		expect(screen.getByText('https://example/b')).toBeInTheDocument();
	});
});
