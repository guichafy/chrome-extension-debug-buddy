// Formatadores compactos para as pills do NetworkMetricsBar.
// Regra do projeto: ausência de dado é "—", nunca "0" enganoso.

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function formatBytes(value: number | null): string {
	if (value == null) return '—';
	if (value < KB) return `${value} B`;
	if (value < MB) return `${(value / KB).toFixed(1)} KB`;
	if (value < GB) return `${(value / MB).toFixed(1)} MB`;
	return `${(value / GB).toFixed(1)} GB`;
}

export function formatMs(value: number | null): string {
	if (value == null) return '—';
	if (value < 1000) return `${value} ms`;
	return `${(value / 1000).toFixed(1)} s`;
}

export function formatCount(value: number): string {
	return String(value);
}
