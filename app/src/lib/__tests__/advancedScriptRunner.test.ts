import { afterEach, describe, expect, it } from 'vitest';
import {
	__resetAdvancedScriptRunnerForTests,
	runAdvancedScript,
} from '../advancedScriptRunner';

afterEach(() => {
	__resetAdvancedScriptRunnerForTests();
});

describe('advancedScriptRunner — runDirect (jsdom fallback)', () => {
	it('executa script válido e retorna ok=true', async () => {
		const r = await runAdvancedScript('return { ...response, n: 2 };', { n: 1 }, {
			forceDirect: true,
		});
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.output).toEqual({ n: 2 });
	});

	it('retorna erro de sintaxe sem fallback silencioso', async () => {
		const r = await runAdvancedScript('return {{{', null, { forceDirect: true });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('sintaxe');
	});

	it('retorna erro de execução sem fallback silencioso', async () => {
		const r = await runAdvancedScript('throw new Error("boom");', null, {
			forceDirect: true,
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('execução');
	});

	it('rejeita script vazio com mensagem clara', async () => {
		const r = await runAdvancedScript('   ', null, { forceDirect: true });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('vazio');
	});

	it('expõe o argumento response ao script', async () => {
		const r = await runAdvancedScript(
			'return Array.isArray(response) ? response.length : -1;',
			[10, 20, 30],
			{ forceDirect: true },
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.output).toBe(3);
	});

	it('aceita scripts que não usam `return` mas são expressões via blocos', async () => {
		const r = await runAdvancedScript('const x = response * 2; return x;', 5, {
			forceDirect: true,
		});
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.output).toBe(10);
	});
});
