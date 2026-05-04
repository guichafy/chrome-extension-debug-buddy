import type { CompiledPattern } from './types';

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

export function parsePattern(raw: string): CompiledPattern {
	const parts = raw.split('\\;');
	const regexSource = parts[0];
	let confidence = 100;
	let versionTemplate: string | undefined;
	for (let i = 1; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith('confidence:')) {
			const n = Number(p.slice('confidence:'.length));
			if (Number.isFinite(n)) confidence = clamp(n, 0, 100);
		} else if (p.startsWith('version:')) {
			versionTemplate = p.slice('version:'.length);
		}
	}
	return {
		regex: new RegExp(regexSource, 'i'),
		confidence,
		versionTemplate,
		raw,
	};
}

export function expandVersion(
	template: string | undefined,
	groups: RegExpMatchArray | null,
): string | undefined {
	if (!template || !groups) return undefined;
	const expanded = template.replace(/\\(\d)/g, (_, d) => groups[Number(d)] ?? '');
	const trimmed = expanded.trim();
	return trimmed === '' ? undefined : trimmed;
}
