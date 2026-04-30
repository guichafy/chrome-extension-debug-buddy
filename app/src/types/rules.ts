// Tipos para o sistema de regras

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

// Matcher para corpo da requisição/resposta
export interface BodyMatcher extends BaseMatcher {
	type: 'body';
	pattern: string;
	isRegex: boolean;
	contentType?: string;
}

// União de todos os tipos de matchers
export type Matcher = UrlMatcher | MethodMatcher | HeaderMatcher | BodyMatcher;

// Tipos de ações disponíveis
export type ActionType = 'mock' | 'delay' | 'transform' | 'breakpoint';

// Interface base para todas as ações
export interface BaseAction {
	type: ActionType;
	enabled: boolean;
}

export type MockLatency =
	| {
			mode: 'fixed';
			delayMs: number;
	  }
	| {
			mode: 'range';
			minMs: number;
			maxMs: number;
	  };

// Ação para retornar uma resposta mockada
export interface MockAction extends BaseAction {
	type: 'mock';
	status: number;
	statusPhrase?: string;
	headers: Record<string, string>;
	body?: string;
	contentType?: string;
	latency?: MockLatency;
}

// Ação para adicionar um delay na resposta
export interface DelayAction extends BaseAction {
	type: 'delay';
	timeMs: number;
}

// Tipos de operações declarativas aplicadas pela ação Transform sobre o body
// JSON da resposta. Cada operação navega o documento via JSONPath subset
// (`$`, `.name`, `['name']`, `[N]`) e altera, remove ou substitui valores.
export type TransformOperationType = 'add' | 'remove' | 'replace';

// Operação declarativa aplicada à resposta JSON. `value` é uma string contendo
// JSON literal — strings devem vir entre aspas (ex.: `"hello"`), objetos e
// arrays como JSON válido. Operações `remove` ignoram `value`.
export interface TransformOperation {
	id: string;
	type: TransformOperationType;
	path: string;
	value?: string;
}

// Modo do editor de Transform. `declarative` usa `operations`; `advanced` usa
// `advancedScript` (US-017, ainda não implementado pelo runtime).
export type TransformMode = 'declarative' | 'advanced';

// Ação para transformar a resposta (chama o servidor remoto e modifica o resultado)
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

// Ação para pausar a requisição e aguardar interação do usuário
export interface BreakpointAction extends BaseAction {
	type: 'breakpoint';
	description?: string; // Descrição opcional para o usuário
}

// União de todos os tipos de ações
export type Action = MockAction | DelayAction | TransformAction | BreakpointAction;

// Interface para uma regra completa
export interface Rule {
	id: string;
	name: string;
	enabled: boolean;
	matchers: Matcher[];
	action: Action;
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
