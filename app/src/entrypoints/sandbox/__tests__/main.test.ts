// Testa o handler do sandbox de Transform avançado. Simulamos a chegada de
// uma `MessageEvent` com `event.source` falso para capturar o reply postado
// de volta. O módulo registra o listener no `window` ao ser carregado, por
// isso `vi.resetModules()` é usado entre testes para isolamento.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedReply {
	id?: string;
	ok?: boolean;
	output?: unknown;
	error?: string;
}

async function loadSandbox(): Promise<void> {
	vi.resetModules();
	await import('../main');
}

function dispatchToSandbox(message: unknown): Promise<CapturedReply> {
	return new Promise<CapturedReply>((resolve) => {
		const fakeSource = {
			postMessage: (msg: CapturedReply): void => {
				resolve(msg);
			},
		};
		const evt = new MessageEvent('message', { data: message });
		Object.defineProperty(evt, 'source', { value: fakeSource });
		window.dispatchEvent(evt);
	});
}

beforeEach(async () => {
	await loadSandbox();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sandbox/main — handler de execução de script avançado', () => {
	it('executa script válido e retorna ok=true com output', async () => {
		const reply = await dispatchToSandbox({
			id: 'req-1',
			script: 'return response.value + 1;',
			response: { value: 41 },
		});
		expect(reply.id).toBe('req-1');
		expect(reply.ok).toBe(true);
		expect(reply.output).toBe(42);
	});

	it('retorna erro de sintaxe sem fallback silencioso', async () => {
		const reply = await dispatchToSandbox({
			id: 'req-2',
			script: 'return {{{',
			response: null,
		});
		expect(reply.id).toBe('req-2');
		expect(reply.ok).toBe(false);
		expect((reply.error ?? '').toLowerCase()).toContain('sintaxe');
	});

	it('retorna erro de execução quando o script lança', async () => {
		const reply = await dispatchToSandbox({
			id: 'req-3',
			script: 'throw new Error("boom");',
			response: null,
		});
		expect(reply.id).toBe('req-3');
		expect(reply.ok).toBe(false);
		expect((reply.error ?? '').toLowerCase()).toContain('execução');
	});

	it('ignora mensagens malformadas (sem id ou sem script)', async () => {
		// Não há resposta esperada — usamos timeout para confirmar silêncio.
		let received = false;
		const fakeSource = {
			postMessage: (): void => {
				received = true;
			},
		};
		const evt = new MessageEvent('message', { data: { foo: 'bar' } });
		Object.defineProperty(evt, 'source', { value: fakeSource });
		window.dispatchEvent(evt);
		await new Promise((r) => setTimeout(r, 20));
		expect(received).toBe(false);
	});
});
