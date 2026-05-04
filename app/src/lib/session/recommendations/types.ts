import type { Recommendation, RecommendationRuleId } from '../types';

export type { Recommendation, RecommendationRuleId };

export interface RuleContext {
	topFrameUrl: string | null;
}

export type RulePartial = Omit<Recommendation, 'id' | 'timestamp'>;

export type Rule = (
	ev: NetworkRuleEvent,
	ctx: RuleContext,
) => RulePartial | null;

export interface RuleDescriptor {
	id: RecommendationRuleId;
	rule: Rule;
}

/**
 * Subset do NetworkEvent (de session/types) que as regras leem. Modelado
 * apartado para que a engine não acoplhe o tipo completo do session — assim
 * conseguimos invocar regras de qualquer fonte (ex.: testes diretos com
 * fixture mínima) sem precisar montar uma `InterceptedResponse` completa.
 */
export interface NetworkRuleEvent {
	requestId?: string;
	method: string;
	url: string;
	status: number;
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	contentLength?: number; // pode vir de response.headers['content-length'] OU encodedDataLength
	mimeType?: string;
}
