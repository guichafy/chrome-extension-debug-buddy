import type { ConsoleArgPreview, SessionEvent } from './types';

type ConsoleEv = Extract<SessionEvent, { type: 'console' }>;

export type CoalesceResult =
	| { coalesced: true; event: ConsoleEv }
	| { coalesced: false };

function argsDescriptionKey(args: ConsoleArgPreview[]): string {
	return args.map((a) => `${a.type}:${a.description}`).join('|');
}

function isConsole(ev: SessionEvent): ev is ConsoleEv {
	return ev.type === 'console';
}

export function tryCoalesceConsole(prev: SessionEvent, next: ConsoleEv): CoalesceResult {
	if (!isConsole(prev)) return { coalesced: false };
	if (prev.level !== next.level) return { coalesced: false };
	if (prev.source !== next.source) return { coalesced: false };
	if (prev.phaseId !== next.phaseId) return { coalesced: false };
	if (argsDescriptionKey(prev.args) !== argsDescriptionKey(next.args)) {
		return { coalesced: false };
	}
	const merged: ConsoleEv = {
		...prev,
		coalesceCount: (prev.coalesceCount ?? 1) + 1,
	};
	return { coalesced: true, event: merged };
}
