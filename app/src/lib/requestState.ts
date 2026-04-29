import type { InterceptedResponse } from '@/types/intercepted';
import type { RequestState } from '@/types/filters';
import type { LucideIconName } from '@/components/ui/lucide-icon';

// Estado canônico de uma requisição interceptada. A ordem de prioridade
// determina os badges e o filtro `state:` — manter aqui evita drift entre
// columns.tsx, filterMatching.ts e os componentes de UI.
export function getRequestState(request: InterceptedResponse): RequestState {
	if (request.captureError) return 'failed';
	if (request.isWaiting === true) return 'pending';
	if (request.isMocked === true) return 'mocked';
	if (request.isWaiting === false) return 'modified';
	return 'proxy';
}

export type StateBadgeVariant = 'destructive' | 'warning' | 'default' | 'secondary' | 'outline';

interface StateBadgeMeta {
	variant: StateBadgeVariant;
	label: string;
	iconName: LucideIconName;
	pulse: boolean;
}

const STATE_BADGE_META: Record<RequestState, StateBadgeMeta> = {
	failed: { variant: 'destructive', label: 'Falha', iconName: 'alert-triangle', pulse: false },
	pending: { variant: 'warning', label: 'Aguardando', iconName: 'hourglass', pulse: true },
	modified: { variant: 'default', label: 'Modificado', iconName: 'edit', pulse: false },
	mocked: { variant: 'secondary', label: 'Mockado', iconName: 'copy', pulse: false },
	proxy: { variant: 'outline', label: 'Proxy', iconName: 'check-circle', pulse: false },
};

export function getStateBadgeMeta(state: RequestState): StateBadgeMeta {
	return STATE_BADGE_META[state];
}

const STATE_PRIORITY: Record<RequestState, number> = {
	failed: 0,
	pending: 1,
	modified: 2,
	mocked: 3,
	proxy: 4,
};

export function getStatePriority(state: RequestState): number {
	return STATE_PRIORITY[state];
}
