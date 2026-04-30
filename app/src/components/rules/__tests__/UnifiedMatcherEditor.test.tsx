import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Matcher } from '@/types/rules';
import { UnifiedMatcherEditor } from '../UnifiedMatcherEditor';

const baseMatchers: Matcher[] = [
	{ type: 'url', enabled: true, pattern: '/api/users/*', isRegex: false },
	{ type: 'method', enabled: true, method: ['GET'] },
];

describe('UnifiedMatcherEditor', () => {
	test('renderiza padrao de URL e botoes de metodos HTTP', () => {
		render(<UnifiedMatcherEditor matchers={baseMatchers} onChange={vi.fn()} />);

		expect(screen.getByTestId('unified-url-input')).toHaveValue('/api/users/*');
		expect(screen.getByTestId('unified-method-ANY')).toBeInTheDocument();
		expect(screen.getByTestId('unified-method-GET')).toBeInTheDocument();
		expect(screen.getByTestId('unified-method-POST')).toBeInTheDocument();
		expect(screen.getByTestId('unified-method-PUT')).toBeInTheDocument();
		expect(screen.getByTestId('unified-method-DELETE')).toBeInTheDocument();
	});

	test('digitar no padrao da URL chama onChange com matcher atualizado', () => {
		const onChange = vi.fn();
		render(<UnifiedMatcherEditor matchers={baseMatchers} onChange={onChange} />);

		fireEvent.change(screen.getByTestId('unified-url-input'), {
			target: { value: '/api/v2/*' },
		});

		expect(onChange).toHaveBeenCalled();
		const updated = onChange.mock.calls[0][0] as Matcher[];
		const url = updated.find((m) => m.type === 'url');
		expect(url && url.type === 'url' && url.pattern).toBe('/api/v2/*');
	});

	test('clicar metodo nao selecionado adiciona ao array', () => {
		const onChange = vi.fn();
		render(<UnifiedMatcherEditor matchers={baseMatchers} onChange={onChange} />);

		fireEvent.click(screen.getByTestId('unified-method-POST'));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		const method = updated.find((m) => m.type === 'method');
		expect(method && method.type === 'method' && method.method).toEqual(['GET', 'POST']);
	});

	test('clicar metodo selecionado remove do array', () => {
		const onChange = vi.fn();
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET', 'POST'] },
				]}
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByTestId('unified-method-GET'));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		const method = updated.find((m) => m.type === 'method');
		expect(method && method.type === 'method' && method.method).toEqual(['POST']);
	});

	test('clicar ANY substitui selecao por apenas ANY', () => {
		const onChange = vi.fn();
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET', 'POST'] },
				]}
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByTestId('unified-method-ANY'));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		const method = updated.find((m) => m.type === 'method');
		expect(method && method.type === 'method' && method.method).toEqual(['ANY']);
	});

	test('selecionar metodo especifico desativa ANY', () => {
		const onChange = vi.fn();
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['ANY'] },
				]}
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByTestId('unified-method-GET'));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		const method = updated.find((m) => m.type === 'method');
		expect(method && method.type === 'method' && method.method).toEqual(['GET']);
	});

	test('mostra erro inline quando padrao de URL esta vazio', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET'] },
				]}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByTestId('unified-url-error')).toBeInTheDocument();
		expect(screen.getByTestId('unified-url-input')).toHaveAttribute('aria-invalid', 'true');
	});

	test('mostra erro inline quando nenhum metodo esta selecionado', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: [] },
				]}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByTestId('unified-method-error')).toBeInTheDocument();
	});

	test('preview indica match em verde quando regra casa URL de teste', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/users/*', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET'] },
				]}
				onChange={vi.fn()}
			/>,
		);

		// URL de teste padrao = https://api.exemplo.com/users/42, metodo padrao = GET
		// padrao matcher = /users/* casa /users/42
		const result = screen.getByTestId('unified-preview-result');
		expect(result).toHaveTextContent('Casa esta regra');
	});

	test('preview indica nao-match quando URL de teste nao casa', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api/admin', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET'] },
				]}
				onChange={vi.fn()}
			/>,
		);

		const result = screen.getByTestId('unified-preview-result');
		expect(result).toHaveTextContent('Não casa esta regra');
	});

	test('preview reage a mudanca da URL de teste', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api/admin/*', isRegex: false },
					{ type: 'method', enabled: true, method: ['ANY'] },
				]}
				onChange={vi.fn()}
			/>,
		);

		// Inicial: /api/admin/* nao casa https://api.exemplo.com/users/42
		expect(screen.getByTestId('unified-preview-result')).toHaveTextContent('Não casa');

		fireEvent.change(screen.getByTestId('unified-test-url-input'), {
			target: { value: 'https://example.com/api/admin/dashboard' },
		});

		expect(screen.getByTestId('unified-preview-result')).toHaveTextContent('Casa esta regra');
	});

	test('matchers de header/body sao mostrados na secao avancada', () => {
		render(
			<UnifiedMatcherEditor
				matchers={[
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET'] },
					{
						type: 'header',
						enabled: true,
						name: 'Authorization',
						value: 'Bearer x',
						headerType: 'request',
					},
				]}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByText('Matchers avançados')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
	});

	test('botao "Adicionar header" cria novo HeaderMatcher', () => {
		const onChange = vi.fn();
		render(<UnifiedMatcherEditor matchers={baseMatchers} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button', { name: /Adicionar header/ }));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		expect(updated.some((m) => m.type === 'header')).toBe(true);
	});

	test('toggle "Regex" muda placeholder e isRegex no matcher', () => {
		const onChange = vi.fn();
		render(<UnifiedMatcherEditor matchers={baseMatchers} onChange={onChange} />);

		fireEvent.click(screen.getByLabelText('Regex'));

		const updated = onChange.mock.calls[0][0] as Matcher[];
		const url = updated.find((m) => m.type === 'url');
		expect(url && url.type === 'url' && url.isRegex).toBe(true);
	});
});
