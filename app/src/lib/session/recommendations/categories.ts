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

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
	security: 'Segurança',
	performance: 'Performance',
};

export const CATEGORY_ORDER: RecommendationCategory[] = ['security', 'performance'];
