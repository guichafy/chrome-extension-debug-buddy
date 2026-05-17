import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { ModificationsView } from '../ModificationsView';

function baseRequest(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api.test/v1/users',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: { 'content-type': 'application/json' },
		type: 'XHR',
		timestamp: 0,
		request: {
			headers: { accept: 'application/json' },
		},
		response: {
			headers: { 'content-type': 'application/json' },
			body: '{"id":1}',
		},
		...overrides,
	};
}

describe('ModificationsView', () => {
	test('estado vazio: sem modifications mostra explicação', () => {
		const req = baseRequest();
		render(<ModificationsView request={req} />);
		expect(screen.getByTestId('modifications-empty')).toBeInTheDocument();
		expect(screen.queryByTestId('modifications-view')).not.toBeInTheDocument();
	});

	test('renderiza seção request quando requestModified presente', () => {
		const req = baseRequest({
			requestModified: {
				url: 'https://api.test/v2/users',
				method: 'POST',
				headers: { accept: 'application/json', authorization: 'Bearer x' },
				postData: '{"new":true}',
			},
		});
		render(<ModificationsView request={req} />);
		const section = screen.getByTestId('modifications-section-request');
		expect(section).toBeInTheDocument();
		expect(screen.queryByTestId('modifications-section-response')).not.toBeInTheDocument();

		// URL diff
		const urlRow = within(section).getByTestId('modifications-diff-url');
		expect(urlRow).toHaveTextContent('https://api.test/v1/users');
		expect(urlRow).toHaveTextContent('https://api.test/v2/users');

		// Método diff
		const methodRow = within(section).getByTestId('modifications-diff-método');
		expect(methodRow).toHaveTextContent('GET');
		expect(methodRow).toHaveTextContent('POST');

		// Header adicionado (authorization)
		const headerAdded = within(section).getByTestId('header-diff-added-authorization');
		expect(headerAdded).toHaveTextContent('+ authorization: Bearer x');

		// Body diff
		const bodyRow = within(section).getByTestId('modifications-diff-body');
		expect(bodyRow).toHaveTextContent('{"new":true}');
	});

	test('renderiza seção response quando responseModified presente', () => {
		const req = baseRequest({
			responseModified: {
				status: 503,
				statusPhrase: 'Service Unavailable',
				body: '{"error":"boom"}',
			},
		});
		render(<ModificationsView request={req} />);
		const section = screen.getByTestId('modifications-section-response');
		expect(section).toBeInTheDocument();

		const statusRow = within(section).getByTestId('modifications-diff-status');
		expect(statusRow).toHaveTextContent('200');
		expect(statusRow).toHaveTextContent('503');

		const bodyRow = within(section).getByTestId('modifications-diff-body');
		expect(bodyRow).toHaveTextContent('{"id":1}');
		expect(bodyRow).toHaveTextContent('{"error":"boom"}');
	});

	test('renderiza ambas seções quando os dois snapshots existem', () => {
		const req = baseRequest({
			requestModified: { method: 'POST' },
			responseModified: { status: 500 },
		});
		render(<ModificationsView request={req} />);
		expect(screen.getByTestId('modifications-section-request')).toBeInTheDocument();
		expect(screen.getByTestId('modifications-section-response')).toBeInTheDocument();
	});

	test('headers: renderiza tipos added/removed/changed e omite unchanged', () => {
		const req = baseRequest({
			request: {
				headers: { accept: 'application/json', 'x-old': 'gone', 'x-changed': 'one' },
			},
			requestModified: {
				headers: { accept: 'application/json', 'x-changed': 'two', 'x-new': 'fresh' },
			},
		});
		render(<ModificationsView request={req} />);
		expect(screen.getByTestId('header-diff-removed-x-old')).toBeInTheDocument();
		expect(screen.getByTestId('header-diff-added-x-new')).toBeInTheDocument();
		expect(screen.getByTestId('header-diff-changed-x-changed')).toHaveTextContent('one → two');
		// unchanged não vira diff (accept estava igual)
		expect(screen.queryByTestId('header-diff-unchanged-accept')).not.toBeInTheDocument();
	});
});
