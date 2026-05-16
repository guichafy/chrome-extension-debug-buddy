// Barrel: re-exporta os tipos canônicos para consumidores que importam
// de '@/types' sem se importar com o caminho exato. Os arquivos
// dedicados (messages.ts, intercepted.ts, rules.ts) são a fonte de verdade.

export type { MessageAction, Message, MessageResponse } from './messages';
export type { AppliedType, InterceptedResponse, ResponseModifications } from './intercepted';
export type {
	Rule,
	RuleStage,
	Action,
	ActionType,
	Matcher,
	MatcherType,
	BaseAction,
	BaseMatcher,
	UrlMatcher,
	MethodMatcher,
	HeaderMatcher,
	BodyMatcher,
	MockAction,
	RequestDelayAction,
	RequestModifyAction,
	ResponseModifyAction,
	BlockAction,
	BlockErrorReason,
	HeaderOps,
	TransformAction,
	TransformOperation,
	TransformOperationType,
	TransformMode,
	BreakpointAction,
} from './rules';
