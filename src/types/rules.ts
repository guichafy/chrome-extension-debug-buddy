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

// Matcher para métodos HTTP
export interface MethodMatcher extends BaseMatcher {
  type: 'method';
  method: string; // GET, POST, PUT, DELETE, etc.
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
export type ActionType = 'mock' | 'delay' | 'modify';

// Interface base para todas as ações
export interface BaseAction {
  type: ActionType;
  enabled: boolean;
}

// Ação para retornar uma resposta mockada
export interface MockAction extends BaseAction {
  type: 'mock';
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

// Ação para adicionar um delay na resposta
export interface DelayAction extends BaseAction {
  type: 'delay';
  timeMs: number;
}

// Ação para modificar a requisição/resposta
export interface ModifyAction extends BaseAction {
  type: 'modify';
  status?: number;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  replaceBody?: string;
}

// União de todos os tipos de ações
export type Action = MockAction | DelayAction | ModifyAction;

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
