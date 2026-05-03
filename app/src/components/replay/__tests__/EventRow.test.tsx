import { render, screen } from '@testing-library/react';
import { EventRow } from '../EventRow';

describe('EventRow', () => {
	const startedAt = 1700000000000;

	test('renderiza network event com method/status badges', () => {
		render(
			<EventRow
				event={{
					type: 'network',
					timestamp: startedAt + 100,
					phaseId: 'p',
					requestId: 'r1',
					method: 'POST',
					url: 'https://api.test/users',
					status: 201,
					durationMs: 42,
				}}
				startedAt={startedAt}
			/>,
		);
		expect(screen.getByText('POST')).toBeInTheDocument();
		expect(screen.getByText('201')).toBeInTheDocument();
		expect(screen.getByText('https://api.test/users')).toBeInTheDocument();
		expect(screen.getByText('42ms')).toBeInTheDocument();
	});

	test('renderiza console error com level badge', () => {
		render(
			<EventRow
				event={{
					type: 'console',
					timestamp: startedAt + 200,
					phaseId: 'p',
					source: 'app',
					level: 'error',
					args: [{ type: 'string', description: 'Falhou ao carregar' }],
				}}
				startedAt={startedAt}
			/>,
		);
		expect(screen.getByText('error')).toBeInTheDocument();
		expect(screen.getByText('Falhou ao carregar')).toBeInTheDocument();
	});

	test('renderiza error com primeira stack frame', () => {
		render(
			<EventRow
				event={{
					type: 'error',
					timestamp: startedAt + 300,
					phaseId: 'p',
					message: 'TypeError: x is undefined',
					stackTrace: {
						frames: [
							{
								url: 'https://app/main.js',
								lineNumber: 42,
								columnNumber: 5,
								functionName: 'handleClick',
							},
						],
					},
				}}
				startedAt={startedAt}
			/>,
		);
		expect(screen.getByText('ERROR')).toBeInTheDocument();
		expect(screen.getByText('TypeError: x is undefined')).toBeInTheDocument();
		expect(screen.getByText(/at handleClick \(https:\/\/app\/main\.js:42:5\)/)).toBeInTheDocument();
	});

	test('renderiza coalesce count badge quando >1', () => {
		render(
			<EventRow
				event={{
					type: 'console',
					timestamp: startedAt + 400,
					phaseId: 'p',
					source: 'app',
					level: 'log',
					args: [{ type: 'string', description: 'tick' }],
					coalesceCount: 5,
				}}
				startedAt={startedAt}
			/>,
		);
		expect(screen.getByText('×5')).toBeInTheDocument();
	});
});
