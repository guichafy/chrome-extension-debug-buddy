import type { LucideIconName } from '@/components/ui/lucide-icon';
import { i18n } from '@/i18n/instance';
import type { Action, Matcher, Rule, RuleStage } from '@/types/rules';

export interface ActionVisuals {
	iconName: LucideIconName;
	label: string;
	bgClass: string;
	textClass: string;
	borderClass: string;
}

export interface StageVisuals {
	iconName: LucideIconName;
	label: string;
	bgClass: string;
	textClass: string;
	borderClass: string;
}

// Rótulos vêm do namespace `rules` do i18n (só a UI importa este módulo);
// quem renderiza já re-renderiza na troca de idioma via useTranslation.

// Phase 6: badge de stage. Azul=request (a regra age antes da rede), verde=
// response (age depois da resposta chegar). Tokens de design system mantêm
// consistência com `lib/statusBadge.ts`.
export function getStageVisuals(stage: RuleStage): StageVisuals {
	if (stage === 'request') {
		return {
			iconName: 'upload',
			label: i18n.t('rules:stages.request'),
			bgClass: 'bg-info/15',
			textClass: 'text-info',
			borderClass: 'border-info/40',
		};
	}
	return {
		iconName: 'download',
		label: i18n.t('rules:stages.response'),
		bgClass: 'bg-success/15',
		textClass: 'text-success',
		borderClass: 'border-success/40',
	};
}

export function getActionVisuals(action: Action): ActionVisuals {
	switch (action.type) {
		case 'mock':
			return {
				iconName: 'server-crash',
				label: i18n.t('rules:actionTypes.mock'),
				bgClass: 'bg-violet-500/10',
				textClass: 'text-violet-300',
				borderClass: 'border-violet-500/30',
			};
		case 'requestDelay':
			return {
				iconName: 'timer',
				label: i18n.t('rules:actionTypes.requestDelay'),
				bgClass: 'bg-amber-500/10',
				textClass: 'text-amber-300',
				borderClass: 'border-amber-500/30',
			};
		case 'transform':
			return {
				iconName: 'file-edit',
				label: i18n.t('rules:actionTypes.transform'),
				bgClass: 'bg-sky-500/10',
				textClass: 'text-sky-300',
				borderClass: 'border-sky-500/30',
			};
		case 'breakpoint':
			return {
				iconName: 'octagon-alert',
				label: i18n.t('rules:actionTypes.breakpoint'),
				bgClass: 'bg-rose-500/10',
				textClass: 'text-rose-300',
				borderClass: 'border-rose-500/30',
			};
		case 'requestModify':
			return {
				iconName: 'edit',
				label: i18n.t('rules:actionTypes.requestModify'),
				bgClass: 'bg-info/10',
				textClass: 'text-info',
				borderClass: 'border-info/30',
			};
		case 'responseModify':
			return {
				iconName: 'edit',
				label: i18n.t('rules:actionTypes.responseModify'),
				bgClass: 'bg-info/10',
				textClass: 'text-info',
				borderClass: 'border-info/30',
			};
		case 'block':
			return {
				iconName: 'x-circle',
				label: i18n.t('rules:actionTypes.block'),
				bgClass: 'bg-destructive/10',
				textClass: 'text-destructive',
				borderClass: 'border-destructive/30',
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
			return i18n.t('rules:summary.mock', { status: action.status, phrase });
		}
		case 'requestDelay':
			return i18n.t('rules:summary.delay', { ms: action.timeMs });
		case 'transform': {
			if (action.mode === 'advanced') {
				const hasScript = (action.advancedScript ?? '').trim().length > 0;
				return hasScript
					? i18n.t('rules:summary.transformAdvanced')
					: i18n.t('rules:summary.transformEmptyScript');
			}
			const opsCount = action.operations?.length ?? 0;
			if (opsCount > 0) {
				return i18n.t('rules:summary.transformOperations', { count: opsCount });
			}
			return action.status
				? i18n.t('rules:summary.transformStatus', { status: action.status })
				: i18n.t('rules:summary.transformResponse');
		}
		case 'breakpoint':
			return action.description
				? i18n.t('rules:summary.breakpointWithDescription', { description: action.description })
				: i18n.t('rules:summary.breakpoint');
		case 'requestModify':
			return i18n.t('rules:summary.requestModify');
		case 'responseModify':
			return i18n.t('rules:summary.responseModify');
		case 'block':
			return i18n.t('rules:summary.block', { reason: action.errorReason });
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

	if (method && method.type === 'method') {
		const methods = Array.isArray(method.method) ? method.method : [method.method];
		const explicit = methods.filter((m) => m && m !== 'ANY');
		if (explicit.length > 0) {
			parts.push(explicit.join('|'));
		}
	}

	if (url && url.type === 'url') {
		const pattern = url.pattern.trim();
		parts.push(pattern.length > 0 ? pattern : i18n.t('rules:matcherSummary.anyUrl'));
	} else if (parts.length === 0) {
		const header = enabled.find((m) => m.type === 'header');
		const body = enabled.find((m) => m.type === 'body');
		if (header && header.type === 'header') {
			parts.push(
				i18n.t('rules:matcherSummary.header', {
					name: header.name || i18n.t('rules:matcherSummary.anyHeader'),
				}),
			);
		} else if (body && body.type === 'body') {
			parts.push('body');
		} else {
			parts.push(i18n.t('rules:matcherSummary.noConditions'));
		}
	}

	return parts.join(' ');
}

// Coleciona os métodos HTTP configurados nos MethodMatchers habilitados de uma
// regra (sempre em UPPERCASE). Se nenhum MethodMatcher estiver habilitado ou
// nenhum método tiver sido informado, retorna `['ANY']` para refletir que a
// regra casa qualquer método. Usado pelo filtro multi-seleção na listagem.
export function getRuleMethods(rule: Rule): string[] {
	const methods: string[] = [];
	for (const matcher of rule.matchers) {
		if (matcher.type !== 'method' || !matcher.enabled) continue;
		const arr = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
		for (const value of arr) {
			if (!value) continue;
			const upper = String(value).toUpperCase();
			if (!methods.includes(upper)) methods.push(upper);
		}
	}
	if (methods.length === 0) return ['ANY'];
	return methods;
}
