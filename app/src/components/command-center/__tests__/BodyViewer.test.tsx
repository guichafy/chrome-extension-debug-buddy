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
