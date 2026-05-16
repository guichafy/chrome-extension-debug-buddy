// Helpers de latência. No schema dual-stage, latência stand-alone é expressa
// como a ação `requestDelay`; o conceito "mock com latência" passou a ser uma
// composição `[requestDelay, mock]` no array `Rule.actions`. Este módulo
// retém apenas o helper `wait` e o tipo legado `MockLatency` para uso em
// presets/templates que ainda materializam o `requestDelay` a partir de uma
// faixa configurável. O resolver `resolveMockLatencyMs` continua útil para
// emitir o `timeMs` final do `requestDelay`.

export type MockLatency =
	| { mode: 'fixed'; delayMs: number }
	| { mode: 'range'; minMs: number; maxMs: number };

function assertInteger(name: string, value: number): void {
	if (!Number.isInteger(value)) {
		throw new Error(`${name} deve ser um inteiro`);
	}
}

function assertNonNegativeInteger(name: string, value: number): void {
	assertInteger(name, value);
	if (value < 0) {
		throw new Error(`${name} deve ser um inteiro maior ou igual a zero`);
	}
}

export function resolveMockLatencyMs(
	latency: MockLatency | undefined,
	random: () => number = Math.random,
): number {
	if (!latency) return 0;

	if (latency.mode === 'fixed') {
		assertNonNegativeInteger('delayMs', latency.delayMs);
		return latency.delayMs;
	}

	if (!Number.isInteger(latency.minMs) || !Number.isInteger(latency.maxMs)) {
		throw new Error('minMs e maxMs devem ser inteiros');
	}
	if (latency.minMs < 0 || latency.maxMs < 0) {
		throw new Error('minMs e maxMs devem ser maiores ou iguais a zero');
	}
	if (latency.minMs > latency.maxMs) {
		throw new Error('minMs deve ser menor ou igual a maxMs');
	}

	return latency.minMs + Math.floor(random() * (latency.maxMs - latency.minMs + 1));
}

export function wait(ms: number): Promise<void> {
	if (ms === 0) return Promise.resolve();
	return new Promise((resolve) => setTimeout(resolve, ms));
}
