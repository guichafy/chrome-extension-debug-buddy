// Tipos para o sistema de regras (schema dual-stage Request/Response)

// Estágio em que a regra atua. Request stage roda antes da requisição sair
// para a rede; Response stage roda depois da resposta chegar do servidor.
// Cada regra opera em UM stage só — se precisa agir nos dois, cria duas regras.
export type RuleStage = 'request' | 'response';

// Tipos de matchers disponíveis
export type MatcherType = 'url' | 'method' | 'header' | 'body';

// Interface base para todos os matchers
export interface BaseMatcher {
	type: MatcherType;
	enabled: boolean;
}

// Matcher para URLs
export interface UrlMatcher extends BaseMatcher {
	type: 'url';
	pattern: string;
	isRegex: boolean;
}

// Matcher para métodos HTTP. Aceita um único método (string) ou multi-seleção
// (array). 'ANY' em qualquer das formas casa qualquer método.
export interface MethodMatcher extends BaseMatcher {
	type: 'method';
	method: string | string[];
}

// Matcher para headers
export interface HeaderMatcher extends BaseMatcher {
	type: 'header';
	name: string;
	value: string;
	headerType: 'request' | 'response';
}

// Matcher para corpo da requisição/resposta. O alvo do `pattern` é
// stage-dependent — em regras `stage='request'` casa contra o `postData`
// enviado pelo cliente; em `stage='response'` casa contra o body retornado
// pelo servidor.
export interface BodyMatcher extends BaseMatcher {
	type: 'body';
	pattern: string;
	isRegex: boolean;
	contentType?: string;
}

// União de todos os tipos de matchers
export type Matcher = UrlMatcher | MethodMatcher | HeaderMatcher | BodyMatcher;

// Tipos de ações disponíveis. Algumas são exclusivas de um stage.
// Modificadores: requestModify, responseModify, requestDelay, transform (response).
// Terminais (interrompem a chain após executar): mock, block, breakpoint.
export type ActionType =
	| 'requestModify'
	| 'responseModify'
	| 'requestDelay'
	| 'transform'
	| 'mock'
	| 'block'
	| 'breakpoint';

// Interface base para todas as ações
export interface BaseAction {
	type: ActionType;
	enabled: boolean;
}

// Operação declarativa sobre body. JSONPath subset igual ao Transform atual.
// Aplica-se via TransformOperation[] em bodyOperations dos modify-actions e
// no `operations` do TransformAction.
export type TransformOperationType = 'add' | 'remove' | 'replace';

export interface TransformOperation {
	id: string;
	type: TransformOperationType;
	path: string;
	value?: string;
}

// Modo do editor de Transform. `declarative` usa `operations`; `advanced` usa
// `advancedScript`.
export type TransformMode = 'declarative' | 'advanced';

// errorReason aceito pelo CDP Fetch.failRequest. Subset curado pra UX —
// outros valores como BlockedByResponse não fazem sentido pré-envio.
export type BlockErrorReason =
	| 'Failed'
	| 'Aborted'
	| 'TimedOut'
	| 'AccessDenied'
	| 'ConnectionFailed'
	| 'ConnectionRefused'
	| 'NameNotResolved'
	| 'BlockedByClient'
	| 'InternetDisconnected';

// Operações de headers nas ações de modify. Engine compõe a lista final
// aplicando, em ordem: removeHeaders, setHeaders, addHeaders.
// - setHeaders: substitui valor (cria se não existe)
// - addHeaders: adiciona somente se ainda não existe (case-insensitive)
// - removeHeaders: remove o header pelo nome (case-insensitive)
export interface HeaderOps {
	setHeaders?: Record<string, string>;
	addHeaders?: Record<string, string>;
	removeHeaders?: string[];
}

// Modificador no Request stage. Altera campos da requisição em voo antes do
// envio ao destino. `body` e `bodyOperations` são mutuamente exclusivos.
export interface RequestModifyAction extends BaseAction, HeaderOps {
	type: 'requestModify';
	url?: string;
	method?: string;
	body?: string;
	bodyOperations?: TransformOperation[];
}

// Modificador no Response stage. Altera campos da resposta em voo antes do
// retorno ao browser. `body` e `bodyOperations` são mutuamente exclusivos.
export interface ResponseModifyAction extends BaseAction, HeaderOps {
	type: 'responseModify';
	status?: number;
	statusPhrase?: string;
	body?: string;
	bodyOperations?: TransformOperation[];
}

// Modificador: atrasa a requisição N ms antes de continuar o chain. Não é
// terminal — a chain segue após o wait. Só faz sentido em stage='request'.
export interface RequestDelayAction extends BaseAction {
	type: 'requestDelay';
	timeMs: number;
}

// Modificador: chama o servidor remoto e modifica o resultado antes de
// devolver ao browser. Só faz sentido em stage='response'.
export interface TransformAction extends BaseAction {
	type: 'transform';
	status?: number;
	addHeaders?: Record<string, string>;
	removeHeaders?: string[];
	replaceBody?: string;
	mode?: TransformMode;
	operations?: TransformOperation[];
	advancedScript?: string;
}

// Terminal: substitui a resposta inteira sem chamar a rede (stage='request')
// ou após receber a resposta original (stage='response'). Mock NÃO tem mais
// latency — quem quiser mock atrasado encadeia [requestDelay, mock] no array
// de actions da regra.
export interface MockAction extends BaseAction {
	type: 'mock';
	status: number;
	statusPhrase?: string;
	headers: Record<string, string>;
	body?: string;
	contentType?: string;
}

// Terminal: falha a requisição antes de sair pra rede. Só faz sentido em
// stage='request'.
export interface BlockAction extends BaseAction {
	type: 'block';
	errorReason: BlockErrorReason;
}

// Terminal: pausa a requisição e aguarda interação manual do usuário.
// Em stage='request' abre EditRequestSheet (edita URL/method/headers/body
// antes do envio). Em stage='response' abre EditResponseSheet
// (edita status/headers/body antes do retorno).
export interface BreakpointAction extends BaseAction {
	type: 'breakpoint';
	description?: string;
}

// União discriminada de todos os tipos de ações
export type Action =
	| RequestModifyAction
	| ResponseModifyAction
	| RequestDelayAction
	| TransformAction
	| MockAction
	| BlockAction
	| BreakpointAction;

// Helper: ação é terminal? Terminais interrompem a chain após executar.
export function isTerminalAction(action: Action): boolean {
	return action.type === 'mock' || action.type === 'block' || action.type === 'breakpoint';
}

// Tabela de validade ação×stage. Mock/Breakpoint são válidos em ambos os
// stages porque compartilham o tipo e o `rule.stage` decide o pipeline.
export const REQUEST_STAGE_ACTIONS: readonly ActionType[] = [
	'requestModify',
	'requestDelay',
	'mock',
	'block',
	'breakpoint',
];

export const RESPONSE_STAGE_ACTIONS: readonly ActionType[] = [
	'responseModify',
	'transform',
	'mock',
	'breakpoint',
];

export function isActionValidForStage(actionType: ActionType, stage: RuleStage): boolean {
	if (stage === 'request') return REQUEST_STAGE_ACTIONS.includes(actionType);
	return RESPONSE_STAGE_ACTIONS.includes(actionType);
}

// Helper: matcher é válido neste stage? `header.headerType='response'` só faz
// sentido em regras response (no Request stage não há headers de resposta
// ainda). Body matcher é stage-aware no engine (vê postData ou response body).
export function isMatcherValidForStage(matcher: Matcher, stage: RuleStage): boolean {
	if (matcher.type === 'header' && matcher.headerType === 'response') {
		return stage === 'response';
	}
	return true;
}

// Interface para uma regra completa. Múltiplas ações executam em ordem;
// uma ação terminal interrompe a chain (e bloqueia inserção de novas ações
// abaixo dela na UI).
export interface Rule {
	id: string;
	name: string;
	enabled: boolean;
	stage: RuleStage;
	matchers: Matcher[];
	actions: Action[];
	createdAt: number;
	updatedAt: number;
}

// Forma serializada de uma regra antes de receber id/timestamps do storage.
export type RuleDraft = Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>;

// Identificadores estáveis para presets de Rules Lab.
export type RulePresetId =
	| 'http_error_500'
	| 'http_error_404'
	| 'http_error_401'
	| 'http_error_403'
	| 'latency_fixed'
	| 'latency_range'
	| 'empty_response'
	| 'broken_json';
