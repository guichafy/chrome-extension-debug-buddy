import { i18n } from '@/i18n/instance';
import type { RecommendationRuleId } from '../types';

export type RecommendationCategory = 'security' | 'performance';

export const RULE_CATEGORIES: Record<RecommendationRuleId, RecommendationCategory> = {
	'csp-missing': 'security',
	'hsts-missing': 'security',
	'cookie-insecure': 'security',
	'mixed-content': 'security',
	'cors-open': 'security',
	'nosniff-missing': 'security',
	'compression-missing': 'performance',
	'cache-missing': 'performance',
	'large-payload': 'performance',
	'image-not-optimized': 'performance',
};

// Getters: o rótulo segue o idioma ativo da UI (replay:categories). Módulo
// usado só pela UI — o engine de recomendações (background) não o importa.
export const CATEGORY_LABEL: Readonly<Record<RecommendationCategory, string>> = {
	get security() {
		return i18n.t('replay:categories.security');
	},
	get performance() {
		return i18n.t('replay:categories.performance');
	},
};

export const CATEGORY_ORDER: RecommendationCategory[] = ['security', 'performance'];
