import type { LucideIconName } from '@/components/ui/lucide-icon';
import type { Action, Matcher } from '@/types/rules';

export interface ActionVisuals {
	iconName: LucideIconName;
	label: string;
	bgClass: string;
	textClass: string;
	borderClass: string;
}

export function getActionVisuals(action: Action): ActionVisuals {
	switch (action.type) {
		case 'mock':
			return {
				iconName: 'server-crash',
				label: 'Mock',
				bgClass: 'bg-violet-500/10',
				textClass: 'text-violet-300',
				borderClass: 'border-violet-500/30',
			};
		case 'delay':
			return {
				iconName: 'timer',
				label: 'Latência',
				bgClass: 'bg-amber-500/10',
				textClass: 'text-amber-300',
				borderClass: 'border-amber-500/30',
			};
		case 'transform':
			return {
				iconName: 'file-edit',
				label: 'Transform',
				bgClass: 'bg-sky-500/10',
				textClass: 'text-sky-300',
				borderClass: 'border-sky-500/30',
			};
		case 'breakpoint':
			return {
				iconName: 'octagon-alert',
				label: 'Breakpoint',
				bgClass: 'bg-rose-500/10',
				textClass: 'text-rose-300',
				borderClass: 'border-rose-500/30',
			};
		default: {
			const exhaustive: never = action;
			throw new Error(`Tipo de ação não suportado: ${(exhaustive as { type: string }).type}`);
		}
	}
}

export function getActionSummary(action: Action): string {
	switch (action.type) {
		case 'mock': {
			const phrase = action.statusPhrase ? ` ${action.statusPhrase}` : '';
			const latency = action.latency
				? action.latency.mode === 'fixed'
					? ` · ${action.latency.delayMs}ms`
					: ` · ${action.latency.minMs}–${action.latency.maxMs}ms`
				: '';
			return `Mock ${action.status}${phrase}${latency}`;
		}
		case 'delay':
			return `Atrasar ${action.timeMs}ms`;
		case 'transform':
			return action.status ? `Transform (status ${action.status})` : 'Transform resposta';
		case 'breakpoint':
			return action.description ? `Breakpoint — ${action.description}` : 'Breakpoint';
		default: {
			const exhaustive: never = action;
			throw new Error(`Tipo de ação não suportado: ${(exhaustive as { type: string }).type}`);
		}
	}
}

export function getMatcherSummary(matchers: Matcher[]): string {
	const enabled = matchers.filter((m) => m.enabled);
	const url = enabled.find((m) => m.type === 'url');
	const method = enabled.find((m) => m.type === 'method');

	const parts: string[] = [];

	if (method && method.type === 'method' && method.method !== 'ANY') {
		parts.push(method.method);
	}

	if (url && url.type === 'url') {
		const pattern = url.pattern.trim();
		parts.push(pattern.length > 0 ? pattern : '(qualquer URL)');
	} else if (parts.length === 0) {
		const header = enabled.find((m) => m.type === 'header');
		const body = enabled.find((m) => m.type === 'body');
		if (header && header.type === 'header') {
			parts.push(`header ${header.name || '(qualquer)'}`);
		} else if (body && body.type === 'body') {
			parts.push('body');
		} else {
			parts.push('Sem condições');
		}
	}

	return parts.join(' ');
}
