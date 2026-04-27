// Helpers de apresentação para a coluna "Tempo" da tabela de requisições.
// `duration` em milissegundos é fornecido pelo backend via NetworkTimingTracker.

export function formatDuration(durationMs: number | undefined): string {
	if (durationMs == null) return '—';
	if (durationMs < 1000) return `${durationMs}ms`;
	const seconds = Math.floor(durationMs / 1000);
	const ms = durationMs % 1000;
	return `${seconds}s ${ms}ms`;
}

export function getDurationColorClass(durationMs: number | undefined): string {
	if (durationMs == null) return 'text-muted-foreground';
	if (durationMs > 1000) return 'text-amber-600';
	if (durationMs > 500) return 'text-yellow-600';
	return 'text-green-600';
}

// Comparador para sortingFn da tabela. Valores ausentes vão para o fim.
export function compareDurations(a: number | undefined, b: number | undefined): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}
