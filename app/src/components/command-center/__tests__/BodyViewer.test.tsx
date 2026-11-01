import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { BodyViewer } from '../BodyViewer';

// Mocka URL.createObjectURL e revokeObjectURL (jsdom não os implementa)
beforeEach(() => {
	vi.stubGlobal('URL', {
		createObjectURL: vi.fn(() => 'blob:mock-url'),
		revokeObjectURL: vi.fn(),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('BodyViewer', () => {
	test('respeita MIME textual para Unicode sem trocar o conteúdo por hex dump', () => {
		render(<BodyViewer body="ação ação ação" mimeType="text/plain" />);
		expect(document.querySelector('pre')!.textContent).toBe('ação ação ação');
	});
	test('limita DOM de JSON grande e mantém acesso a todos os blocos e cópia integral', async () => {
		const body = JSON.stringify({ value: 'a'.repeat(100_000), end: 'fim-do-body' });
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		render(<BodyViewer body={body} mimeType="application/json" />);
		expect(document.querySelector('pre')!.textContent!.length).toBeLessThanOrEqual(16_384);
		expect(screen.getByText(/sem formatação ou validação/i)).toBeInTheDocument();
		const parts = [document.querySelector('pre')!.textContent];
		const next = screen.getByRole('button', { name: 'Próximo bloco do body' });
		while (!next.hasAttribute('disabled')) {
			fireEvent.click(next);
			parts.push(document.querySelector('pre')!.textContent);
		}
		expect(parts.join('')).toBe(body);
		fireEvent.click(screen.getByRole('button', { name: 'Copiar body' }));
		expect(writeText).toHaveBeenCalledWith(body);
	});

	test('não reprocessa JSON inalterado quando o pai renderiza', () => {
		const body = '{"performance-test":true}';
		const parse = vi.spyOn(JSON, 'parse');
		const view = render(<BodyViewer body={body} mimeType="application/json" />);
		const calls = () => parse.mock.calls.filter(([input]) => input === body).length;
		const initial = calls();
		view.rerender(<BodyViewer body={body} mimeType="application/json" />);
		expect(calls()).toBe(initial);
		parse.mockRestore();
	});

	test('mostra erro de JSON inválido com MIME explícito e preserva texto original', () => {
		render(<BodyViewer body={'{"invalido":'} mimeType="application/json" />);
		expect(screen.getByRole('alert')).toHaveTextContent('JSON inválido');
		expect(document.querySelector('pre')).toHaveTextContent('{"invalido":');
	});

	test('não faz parse completo de body grande sem MIME', () => {
		const body = JSON.stringify({ data: '漢'.repeat(100_000) });
		const parse = vi.spyOn(JSON, 'parse');
		render(<BodyViewer body={body} />);
		expect(parse.mock.calls.filter(([input]) => input === body)).toHaveLength(0);
		expect(document.querySelector('pre')!.textContent).toBe(body.slice(0, 16_384));
		parse.mockRestore();
	});

	test('reinicia paginação ao trocar o body e limita HTML grande sem montar iframe', () => {
		const body = '<p>conteúdo</p>'.repeat(5000);
		const view = render(<BodyViewer body={body} mimeType="text/html" />);
		expect(document.querySelector('iframe')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Próximo bloco do body' }));
		view.rerender(<BodyViewer body={'início' + 'x'.repeat(40_000)} mimeType="text/plain" />);
		expect(document.querySelector('pre')!.textContent!.startsWith('início')).toBe(true);
	});

	test('revoga URL da imagem quando body muda para texto', () => {
		const view = render(<BodyViewer body="\u0089PNG" mimeType="image/png" />);
		view.rerender(<BodyViewer body="texto" mimeType="text/plain" />);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
	});

	test('mostra "Body vazio." quando body é undefined', () => {
		render(<BodyViewer body={undefined} />);
		expect(screen.getByText('Body vazio.')).toBeInTheDocument();
	});

	test('mostra reason quando body é undefined com bodyUnavailableReason', () => {
		render(<BodyViewer body={undefined} bodyUnavailableReason="Body too large to capture" />);
		expect(screen.getByText('Body too large to capture')).toBeInTheDocument();
	});

	test('mostra "Body vazio." quando body é string vazia', () => {
		render(<BodyViewer body="" />);
		expect(screen.getByText('Body vazio.')).toBeInTheDocument();
	});

	test('não mostra botões Copy/Download quando body é vazio', () => {
		render(<BodyViewer body="" />);
		expect(screen.queryByRole('button', { name: /Copiar/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /Download/i })).toBeNull();
	});

	test('mostra botões Copy e Download quando body não vazio', () => {
		render(<BodyViewer body='{"id":1}' mimeType="application/json" />);
		expect(screen.getByRole('button', { name: /Copiar body/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Baixar body/i })).toBeInTheDocument();
	});

	test('renderiza JSON com pretty-print e mostra MIME badge', () => {
		render(<BodyViewer body='{"id":42,"name":"test"}' mimeType="application/json" />);
		// O conteúdo é renderizado via dangerouslySetInnerHTML com pre, texto deve estar presente
		const pre = document.querySelector('pre');
		expect(pre).toBeTruthy();
		// pretty-printed tem aspas no texto do id
		expect(pre?.textContent).toContain('"id"');
		expect(pre?.textContent).toContain('42');
		// Badge com MIME
		expect(screen.getByText('application/json')).toBeInTheDocument();
	});

	test('renderiza JSON pretty-printed por heurística (sem MIME)', () => {
		render(<BodyViewer body='{"foo":"bar"}' />);
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toContain('"foo"');
		expect(pre?.textContent).toContain('"bar"');
	});

	test('renderiza HTML com iframe em modo preview', () => {
		render(<BodyViewer body="<html><body>Hello</body></html>" mimeType="text/html" />);
		expect(document.querySelector('iframe')).toBeTruthy();
		// Botão de toggle deve mostrar "Source"
		expect(screen.getByRole('button', { name: /Source/i })).toBeInTheDocument();
	});

	test('toggle HTML de preview para source mostra <pre>', () => {
		render(<BodyViewer body="<html><body>Hello</body></html>" mimeType="text/html" />);
		const toggleBtn = screen.getByRole('button', { name: /Source/i });
		fireEvent.click(toggleBtn);
		// Agora está em modo source: deve mostrar pre
		expect(document.querySelector('pre')).toBeTruthy();
		// iframe não deve mais estar presente
		expect(document.querySelector('iframe')).toBeNull();
	});

	test('renderiza imagem com <img> para MIME image/png', () => {
		render(<BodyViewer body="\x89PNG" mimeType="image/png" />);
		// URL.createObjectURL deve ter sido chamado
		expect(URL.createObjectURL).toHaveBeenCalled();
		const img = document.querySelector('img');
		expect(img).toBeTruthy();
		expect(img?.getAttribute('src')).toBe('blob:mock-url');
	});

	test('renderiza conteúdo binário com hex dump', () => {
		// Cria body com 50% de bytes não-imprimíveis
		const binaryBody = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? '\x00' : 'a')).join('');
		render(<BodyViewer body={binaryBody} />);
		expect(screen.getByText(/Conteúdo binário/)).toBeInTheDocument();
		// Hex dump deve ter offset inicial
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toMatch(/00000000/);
	});

	test('renderiza texto plain com <pre>', () => {
		render(<BodyViewer body="hello world" />);
		const pre = document.querySelector('pre');
		expect(pre).toBeTruthy();
		expect(pre?.textContent).toContain('hello world');
	});

	test('mostra badge de tamanho quando body não vazio', () => {
		// 8 bytes de body JSON
		render(<BodyViewer body='{"a":1}' />);
		// formatByteSize(7) = "7 B"
		expect(screen.getByText('7 B')).toBeInTheDocument();
	});

	test('renderiza label quando fornecida', () => {
		render(<BodyViewer body="content" label="Meu Label" />);
		expect(screen.getByText('Meu Label')).toBeInTheDocument();
	});

	test('renderiza CSS com <pre>', () => {
		render(<BodyViewer body="body { color: red; }" mimeType="text/css" />);
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toContain('body { color: red; }');
	});

	test('renderiza JavaScript com <pre>', () => {
		render(<BodyViewer body="console.log(1)" mimeType="application/javascript" />);
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toContain('console.log(1)');
	});

	test('renderiza XML com <pre>', () => {
		render(<BodyViewer body="<root><item/></root>" mimeType="text/xml" />);
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toContain('<root><item/></root>');
	});
});
