import type { MockLatency } from '../types/rules';

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
