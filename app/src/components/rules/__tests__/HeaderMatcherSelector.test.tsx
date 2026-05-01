import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Matcher } from '@/types/rules';
import { HeaderMatcherSelector } from '../HeaderMatcherSelector';

const baseHeaders = {
	requestHeaders: { authorization: 'Bearer secret', accept: 'application/json' },
	responseHeaders: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
};

describe('HeaderMatcherSelector', () => {
	test('lista todos headers de request e response', () => {
		const matchers: Matcher[] = [];
		render(<HeaderMatcherSelector headers={baseHeaders} matchers={matchers} onChange={vi.fn()} />);
		expect(screen.getByText('authorization')).toBeInTheDocument();
		expect(screen.getByText('accept')).toBeInTheDocument();
		expect(screen.getByText('content-type')).toBeInTheDocument();
		expect(screen.getByText('cache-control')).toBeInTheDocument();
	});

	test('marca o checkbox quando matcher já existe nos matchers', () => {
		const matchers: Matcher[] = [
			{
				type: 'header',
				enabled: true,
				headerType: 'request',
				name: 'accept',
				value: 'application/json',
			},
		];
		render(<HeaderMatcherSelector headers={baseHeaders} matchers={matchers} onChange={vi.fn()} />);
		const row = screen.getByTestId('header-matcher-row-request-accept');
		const checkbox = within(row).getByRole('checkbox');
		expect(checkbox).toHaveAttribute('data-state', 'checked');
	});

	test('mascara valor de header sensível (authorization)', () => {
		render(<HeaderMatcherSelector headers={baseHeaders} matchers={[]} onChange={vi.fn()} />);
		const row = screen.getByTestId('header-matcher-row-request-authorization');
		expect(row).not.toHaveTextContent('Bearer secret');
	});

	test('clicar checkbox de header não selecionado adiciona HeaderMatcher via onChange', () => {
		const onChange = vi.fn();
		render(<HeaderMatcherSelector headers={baseHeaders} matchers={[]} onChange={onChange} />);
		const row = screen.getByTestId('header-matcher-row-response-content-type');
		fireEvent.click(within(row).getByRole('checkbox'));
		expect(onChange).toHaveBeenCalledTimes(1);
		const updated = onChange.mock.calls[0][0] as Matcher[];
		expect(updated).toEqual([
			expect.objectContaining({
				type: 'header',
				headerType: 'response',
				name: 'content-type',
				value: 'application/json',
				enabled: true,
			}),
		]);
	});

	test('clicar checkbox de header já selecionado remove HeaderMatcher via onChange', () => {
		const onChange = vi.fn();
		const existing: Matcher[] = [
			{
				type: 'header',
				enabled: true,
				headerType: 'response',
				name: 'content-type',
				value: 'application/json',
			},
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
		];
		render(<HeaderMatcherSelector headers={baseHeaders} matchers={existing} onChange={onChange} />);
		const row = screen.getByTestId('header-matcher-row-response-content-type');
		fireEvent.click(within(row).getByRole('checkbox'));
		expect(onChange).toHaveBeenCalledTimes(1);
		const updated = onChange.mock.calls[0][0] as Matcher[];
		expect(updated).toEqual([{ type: 'url', enabled: true, pattern: '/api', isRegex: false }]);
	});

	test('renderiza mensagem se ambos requestHeaders e responseHeaders vazios', () => {
		render(
			<HeaderMatcherSelector
				headers={{ requestHeaders: {}, responseHeaders: {} }}
				matchers={[]}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByText(/nenhum header capturado/i)).toBeInTheDocument();
	});
});
