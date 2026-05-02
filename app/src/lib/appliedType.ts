import type { AppliedType, InterceptedResponse } from '@/types/intercepted';
import { APPLIED_TYPE_LABELS } from '@/types/filters';
import type { LucideIconName } from '@/components/ui/lucide-icon';

// Ordem de exibição dos badges quando múltiplos tipos forem aplicados na
// mesma requisição. Vai do mais "intrusivo" (Breakpoint pausa o fluxo)
// para o mais leve (Proxy = sem regra). Usada também para o sort interno
// da função abaixo.
const APPLIED_TYPE_ORDER: AppliedType[] = ['breakpoint', 'mock', 'transform', 'latency', 'proxy'];

const APPLIED_TYPE_RANK: Record<AppliedType, number> = APPLIED_TYPE_ORDER.reduce(
	(acc, t, idx) => {
		acc[t] = idx;
		return acc;
	},
	{} as Record<AppliedType, number>,
);

// Devolve os tipos de regra aplicados em ordem de prioridade, sem duplicatas.
// O background é a fonte de verdade — `request.appliedTypes` é populado em
// todos os pontos de persistência. Quando ausente (request gravada sem
// passar pela engine atual), tratamos como `proxy` (passou direto sem
// regra). `proxy` é mutuamente exclusivo: se vier junto com outros tipos,
// é descartado. Single-pass para evitar arrays intermediários.
export function getAppliedTypes(request: InterceptedResponse): AppliedType[] {
	const raw = request.appliedTypes;
	if (!raw || raw.length === 0) return ['proxy'];

	const seen = new Set<AppliedType>();
	let hasNonProxy = false;
	for (const t of raw) {
		seen.add(t);
		if (t !== 'proxy') hasNonProxy = true;
	}
	if (hasNonProxy) seen.delete('proxy');

	return Array.from(seen).sort((a, b) => APPLIED_TYPE_RANK[a] - APPLIED_TYPE_RANK[b]);
}

export type AppliedTypeBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export interface AppliedTypeBadgeMeta {
	label: string;
	iconName: LucideIconName;
	variant: AppliedTypeBadgeVariant;
	/** Classe Tailwind aplicada ao container do badge para reforçar a cor da categoria. */
	colorClass: string;
}

// Cores derivam apenas dos tokens declarados no `@theme` de globals.css
// (primary/secondary/muted/destructive/warning/info). Latência reaproveita
// `warning` (mesma família semântica de "alerta"); o ícone `timer` a
// distingue visualmente de breakpoint (`octagon-alert`).
const APPLIED_TYPE_BADGE_META: Record<AppliedType, AppliedTypeBadgeMeta> = {
	proxy: {
		label: APPLIED_TYPE_LABELS.proxy,
		iconName: 'arrow-right',
		variant: 'outline',
		colorClass: 'border-muted-foreground/30 text-muted-foreground',
	},
	mock: {
		label: APPLIED_TYPE_LABELS.mock,
		iconName: 'copy',
		variant: 'secondary',
		colorClass: 'bg-primary/10 border-primary/40 text-primary',
	},
	transform: {
		label: APPLIED_TYPE_LABELS.transform,
		iconName: 'file-edit',
		variant: 'secondary',
		colorClass: 'bg-info/10 border-info/40 text-info',
	},
	breakpoint: {
		label: APPLIED_TYPE_LABELS.breakpoint,
		iconName: 'octagon-alert',
		variant: 'secondary',
		colorClass: 'bg-warning/10 border-warning/40 text-warning',
	},
	latency: {
		label: APPLIED_TYPE_LABELS.latency,
		iconName: 'timer',
		variant: 'secondary',
		colorClass: 'bg-warning/10 border-warning/40 text-warning',
	},
};

export function getAppliedTypeBadgeMeta(type: AppliedType): AppliedTypeBadgeMeta {
	return APPLIED_TYPE_BADGE_META[type];
}
