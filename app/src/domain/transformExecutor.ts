// Executor síncrono de Transform declarativo aplicado ao body de uma response.
// Recebe a TransformAction e o body string original; devolve o body
// transformado ou erro tipado. Filosofia "no fallbacks": JSON inválido,
// caminho errado, modo advanced (que precisa de runner externo) ou body
// vazio retornam ok:false — nada de placeholder.
//
// Modo `advanced` não é tratado aqui porque exige execução de JS num
// contexto sandbox (offscreen document no service worker). O background
// roteia para o runner correto antes de cair neste helper.

import { applyOperations } from './jsonPatcher';
import type { TransformAction } from '@/types/rules';

export type TransformExecutionResult = { ok: true; body: string } | { ok: false; error: string };

export function applyTransformToBody(
	action: TransformAction,
	body: string,
): TransformExecutionResult {
	const mode = action.mode ?? 'declarative';
	if (mode === 'advanced') {
		return {
			ok: false,
			error: 'Modo advanced precisa do runner via offscreen document — use o caminho assíncrono.',
		};
	}

	if (body.length === 0) {
		return {
			ok: false,
			error: 'Body vazio — Transform declarativo precisa de um JSON válido para operar.',
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch (err) {
		return {
			ok: false,
			error: `Body não é JSON válido: ${(err as Error).message}`,
		};
	}

	const ops = action.operations ?? [];
	if (ops.length === 0) {
		return { ok: true, body };
	}

	const result = applyOperations(parsed, ops);
	if (!result.ok) {
		return {
			ok: false,
			error: `Falha na operação ${result.failedAtIndex + 1}: ${result.error}`,
		};
	}

	return { ok: true, body: JSON.stringify(result.output) };
}
