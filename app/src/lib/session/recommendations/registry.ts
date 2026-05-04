import type { RuleDescriptor } from './types';
import { cacheMissingRule } from './rules/cacheMissing';
import { compressionMissingRule } from './rules/compressionMissing';
import { cookieInsecureRule } from './rules/cookieInsecure';
import { corsOpenRule } from './rules/corsOpen';
import { cspMissingRule } from './rules/cspMissing';
import { hstsMissingRule } from './rules/hstsMissing';
import { imageNotOptimizedRule } from './rules/imageNotOptimized';
import { largePayloadRule } from './rules/largePayload';
import { mixedContentRule } from './rules/mixedContent';
import { nosniffMissingRule } from './rules/nosniffMissing';

export const REGISTRY: RuleDescriptor[] = [
	compressionMissingRule,
	cacheMissingRule,
	mixedContentRule,
	cspMissingRule,
	hstsMissingRule,
	nosniffMissingRule,
	largePayloadRule,
	imageNotOptimizedRule,
	cookieInsecureRule,
	corsOpenRule,
];
