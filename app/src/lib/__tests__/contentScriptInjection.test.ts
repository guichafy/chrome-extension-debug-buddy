import { describe, expect, test, vi } from 'vitest';
import {
	CONTENT_SCRIPT_FILES,
	ensureContentScriptsInjected,
	type InjectionDeps,
} from '../contentScriptInjection';

function makeDeps(overrides: Partial<InjectionDeps> = {}): InjectionDeps {
	return {
		sendMessage: overrides.sendMessage ?? vi.fn(async () => undefined),
		executeScript: overrides.executeScript ?? vi.fn(async () => []),
	};
}

describe('ensureContentScriptsInjected', () => {
	test('ping resolve → não injeta nada (scripts já presentes)', async () => {
		const deps = makeDeps({
			sendMessage: vi.fn(async () => 'pong'),
		});

		const result = await ensureContentScriptsInjected(42, deps);

		expect(result.injected).toBe(false);
		expect(deps.executeScript).not.toHaveBeenCalled();
		expect(deps.sendMessage).toHaveBeenCalledWith(42, { action: '__contentScriptPing' });
	});

	test('ping rejeita com "Could not establish connection" → injeta os 3 scripts em ordem', async () => {
		const sendMessage = vi.fn(async () => {
			throw new Error('Could not establish connection. Receiving end does not exist.');
		});
		const executeScript = vi.fn(async () => []);
		const deps = makeDeps({ sendMessage, executeScript });

		const result = await ensureContentScriptsInjected(42, deps);

		expect(result.injected).toBe(true);
		expect(executeScript).toHaveBeenCalledTimes(CONTENT_SCRIPT_FILES.length);
		// Confirma cada file × world como o manifest declara.
		expect(executeScript).toHaveBeenNthCalledWith(1, {
			target: { tabId: 42 },
			files: ['probe-main.js'],
			world: 'MAIN',
		});
		expect(executeScript).toHaveBeenNthCalledWith(2, {
			target: { tabId: 42 },
			files: ['probe-bridge.js'],
			world: 'ISOLATED',
		});
		expect(executeScript).toHaveBeenNthCalledWith(3, {
			target: { tabId: 42 },
			files: ['rrweb-recorder.js'],
			world: 'ISOLATED',
		});
	});

	test('ping rejeita com erro diferente (tab fechada, URL proibida) → propaga sem injetar', async () => {
		const sendMessage = vi.fn(async () => {
			throw new Error('No tab with id: 999.');
		});
		const executeScript = vi.fn(async () => []);
		const deps = makeDeps({ sendMessage, executeScript });

		await expect(ensureContentScriptsInjected(999, deps)).rejects.toThrow(/No tab with id/);
		expect(executeScript).not.toHaveBeenCalled();
	});

	test('executeScript falha (URL chrome://) → erro propaga após começar a injeção', async () => {
		const sendMessage = vi.fn(async () => {
			throw new Error('Could not establish connection.');
		});
		const executeScript = vi.fn(async () => {
			throw new Error(
				'Cannot access a chrome:// URL',
			) as Error & { code?: string };
		});
		const deps = makeDeps({ sendMessage, executeScript });

		await expect(ensureContentScriptsInjected(42, deps)).rejects.toThrow(/chrome:\/\//);
		// Falhou já na primeira injeção — não tenta os outros.
		expect(executeScript).toHaveBeenCalledTimes(1);
	});
});
