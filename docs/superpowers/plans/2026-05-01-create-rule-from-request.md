# Substituir botão "Criar Mock" por dropdown de criação de regras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o botão "Criar Mock" do `RequestInspector` por um dropdown com 4 opções (Mock, Breakpoint, Transform, Latência) que abre o `RuleEditor` de `/rules-lab` pré-preenchido a partir da request, com o passo "Tipo" omitido.

**Architecture:** O `RuleEditor` ganha 3 props novas (`skipTypeStep`, `initialDraft`, `headerMatcherSource`) que permitem reusá-lo a partir do `CommandCenter` sem duplicar lógica. O domínio `buildQuickMockDraft` é generalizado para `buildRuleDraftFromRequest` cobrindo os 4 action types. O `QuickMockPanel` é deletado.

**Tech Stack:** React 19 + react-router-dom (hash router), Radix UI (`DropdownMenu`), Tailwind v4, Vitest + jsdom + @testing-library/react, Biome (lint+format), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-01-create-rule-from-request-design.md`

---

## File Structure

**Files to create:**
- `app/src/components/rules/HeaderMatcherSelector.tsx` — componente extraído do `QuickMockPanel`. Recebe headers da request + matchers atuais e callbacks de mutação. Reutilizado pelo `RuleEditor`.
- `app/src/components/rules/__tests__/HeaderMatcherSelector.test.tsx` — testes unitários.

**Files to modify:**
- `app/src/domain/quickMock.ts` — `buildRuleDraftFromRequest` substitui `buildQuickMockDraft`, suporta os 4 `ActionType`. Limpar `body_unavailable` (dead code).
- `app/src/domain/__tests__/quickMock.test.ts` — adapta para a nova função, adiciona casos para os 4 types.
- `app/src/components/rules/RuleEditor.tsx` — props novas (`skipTypeStep`, `initialDraft`, `headerMatcherSource`); render condicional do `HeaderMatcherSelector` no passo Matcher.
- `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx` — casos para `skipTypeStep` e `headerMatcherSource`.
- `app/src/components/command-center/RequestInspector.tsx` — botão "Criar Mock" → `DropdownMenu` "Criar regra". Prop `onCreateMock` → `onCreateRule`.
- `app/src/components/command-center/__tests__/RequestInspector.test.tsx` — atualiza casos de "Criar Mock" para dropdown.
- `app/src/pages/CommandCenter.tsx` — URL routing `?mock=` → `?createRule=&type=`; render direto do `RuleEditor`.

**Files to delete:**
- `app/src/components/command-center/QuickMockPanel.tsx` — substituído pelo `RuleEditor` no `CommandCenter`.

**Working directory para todos os comandos:** `app/`.

---

## Task 1: Domain — `buildRuleDraftFromRequest` substitui `buildQuickMockDraft`

**Files:**
- Modify: `app/src/domain/quickMock.ts`
- Modify: `app/src/domain/__tests__/quickMock.test.ts`

### Goal

Generalizar a função para gerar drafts dos 4 `ActionType` (`mock`, `breakpoint`, `transform`, `delay`). Mantém matchers iguais (URL host+path, método, header matchers opcionais). Limpa o erro `body_unavailable` que está no enum mas nunca é emitido.

### Steps

- [ ] **Step 1.1: Atualizar arquivo de testes — remover testes específicos de `buildQuickMockDraft` que serão substituídos**

Reescreve o arquivo `app/src/domain/__tests__/quickMock.test.ts` inteiro com a suite nova. Substitua todo o conteúdo do arquivo:

```ts
import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import {
	buildRuleDraftFromRequest,
	type BuildRuleDraftOptions,
} from '../quickMock';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users?page=1',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1_700_000_000_000,
	mimeType: 'application/json',
	body: '{"ok":true}',
	response: {
		headers: { 'content-type': 'application/json' },
		body: '{"ok":true}',
	},
	request: {
		headers: { authorization: 'Bearer secret', accept: 'application/json' },
	},
	...overrides,
});

const baseOptions = (overrides: Partial<BuildRuleDraftOptions> = {}): BuildRuleDraftOptions => ({
	type: 'mock',
	headerMatchers: [],
	includeQueryString: false,
	...overrides,
});

describe('buildRuleDraftFromRequest — matchers compartilhados', () => {
	test('gera matchers de URL (host+pathname) e método para todos os types', () => {
		for (const type of ['mock', 'breakpoint', 'transform', 'delay'] as const) {
			const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type }));
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.draft.matchers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'url',
						pattern: 'api.example.com/users',
						isRegex: false,
						enabled: true,
					}),
					expect.objectContaining({ type: 'method', method: 'GET', enabled: true }),
				]),
			);
		}
	});

	test('ignora query string por padrão', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').not.toContain('page=1');
	});

	test('inclui query string quando includeQueryString=true', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({ includeQueryString: true }),
		);
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').toContain('page=1');
	});

	test('inclui header matcher selecionado manualmente', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: 'application/json' }],
			}),
		);
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'header',
					headerType: 'request',
					name: 'accept',
					value: 'application/json',
					enabled: true,
				}),
			]),
		);
	});
});

describe('buildRuleDraftFromRequest — type=mock', () => {
	test('action mock reusa status, headers, body e mimeType reais', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 200,
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			contentType: 'application/json',
			statusPhrase: 'OK',
		});
	});

	test('nome derivado de host+pathname com prefixo "Mock para"', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.name).toBe('Mock para api.example.com/users');
	});

	test('aceita body undefined (não inclui campo body no action)', () => {
		const req = baseRequest({
			body: undefined,
			response: { headers: { 'content-type': 'text/plain' } },
		});
		const result = buildRuleDraftFromRequest(req, baseOptions({ type: 'mock' }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect('body' in result.draft.action).toBe(false);
	});

	test('preserva body vazio capturado', () => {
		const req = baseRequest({
			body: '',
			response: { headers: {}, body: '' },
		});
		const result = buildRuleDraftFromRequest(req, baseOptions({ type: 'mock' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({ type: 'mock', body: '' });
	});
});

describe('buildRuleDraftFromRequest — type=breakpoint', () => {
	test('action breakpoint default sem descrição, prefixo de nome correto', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'breakpoint' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({ type: 'breakpoint', enabled: true, description: '' });
		expect(result.draft.name).toBe('Breakpoint para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — type=transform', () => {
	test('action transform default modo declarative com operations vazias', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'transform' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({
			type: 'transform',
			enabled: true,
			mode: 'declarative',
			operations: [],
		});
		expect(result.draft.name).toBe('Transform para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — type=delay', () => {
	test('action delay default 1000ms, prefixo de nome "Latência"', () => {
		const result = buildRuleDraftFromRequest(baseRequest(), baseOptions({ type: 'delay' }));
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toEqual({ type: 'delay', enabled: true, timeMs: 1000 });
		expect(result.draft.name).toBe('Latência para api.example.com/users');
	});
});

describe('buildRuleDraftFromRequest — erros', () => {
	test('falha quando captureError presente', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest({ captureError: 'Net::ERR_FAILED' }),
			baseOptions(),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('capture_error');
		expect(result.error.message).toContain('Net::ERR_FAILED');
	});

	test('falha quando método ausente (não fabrica ANY)', () => {
		const req = baseRequest();
		(req as { method?: string }).method = undefined;
		const result = buildRuleDraftFromRequest(req, baseOptions());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('method_missing');
	});

	test('falha quando header selecionado não tem valor', () => {
		const result = buildRuleDraftFromRequest(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: '' }],
			}),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('header_value_missing');
	});
});
```

- [ ] **Step 1.2: Rodar os testes para confirmar que falham**

Run (a partir de `app/`): `npx vitest run src/domain/__tests__/quickMock.test.ts`
Expected: FAIL com erros do tipo "buildRuleDraftFromRequest is not exported" / "BuildRuleDraftOptions" não existe.

- [ ] **Step 1.3: Reescrever `app/src/domain/quickMock.ts` com a função generalizada**

Substituir o conteúdo do arquivo inteiro:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import type {
	ActionType,
	Action,
	HeaderMatcher,
	Matcher,
	MockAction,
	RuleDraft,
} from '@/types/rules';

export interface QuickMockHeaderSelection {
	headerType: 'request' | 'response';
	name: string;
	value: string;
}

export interface BuildRuleDraftOptions {
	type: ActionType;
	headerMatchers: QuickMockHeaderSelection[];
	includeQueryString: boolean;
}

export type QuickMockErrorCode = 'method_missing' | 'capture_error' | 'header_value_missing';

export interface QuickMockError {
	code: QuickMockErrorCode;
	message: string;
}

export type BuildRuleDraftResult =
	| { ok: true; draft: RuleDraft }
	| { ok: false; error: QuickMockError };

const NAME_PREFIX_BY_TYPE: Record<ActionType, string> = {
	mock: 'Mock',
	breakpoint: 'Breakpoint',
	transform: 'Transform',
	delay: 'Latência',
};

function urlPattern(rawUrl: string, includeQueryString: boolean): string {
	const url = new URL(rawUrl);
	const base = url.host + url.pathname;
	return includeQueryString && url.search ? base + url.search : base;
}

function getResponseHeaders(req: InterceptedResponse): Record<string, string> {
	return req.response?.headers ?? req.headers;
}

function getResponseBody(req: InterceptedResponse): string | undefined {
	if (req.response && 'body' in req.response) return req.response.body;
	return req.body;
}

function buildMockAction(request: InterceptedResponse): MockAction {
	const responseHeaders = getResponseHeaders(request);
	const responseBody = getResponseBody(request);
	return {
		type: 'mock',
		enabled: true,
		status: request.status,
		headers: responseHeaders,
		...(request.statusText ? { statusPhrase: request.statusText } : {}),
		...(responseBody !== undefined ? { body: responseBody } : {}),
		...(request.mimeType !== undefined ? { contentType: request.mimeType } : {}),
	};
}

function buildActionForType(type: ActionType, request: InterceptedResponse): Action {
	switch (type) {
		case 'mock':
			return buildMockAction(request);
		case 'breakpoint':
			return { type: 'breakpoint', enabled: true, description: '' };
		case 'transform':
			return { type: 'transform', enabled: true, mode: 'declarative', operations: [] };
		case 'delay':
			return { type: 'delay', enabled: true, timeMs: 1000 };
		default: {
			const exhaustive: never = type;
			throw new Error(`Tipo de ação não suportado: ${String(exhaustive)}`);
		}
	}
}

export function buildRuleDraftFromRequest(
	request: InterceptedResponse,
	options: BuildRuleDraftOptions,
): BuildRuleDraftResult {
	if (request.captureError) {
		return {
			ok: false,
			error: { code: 'capture_error', message: request.captureError },
		};
	}
	if (!request.method) {
		return {
			ok: false,
			error: {
				code: 'method_missing',
				message: 'Não é possível criar regra sem o método HTTP original.',
			},
		};
	}

	const pattern = urlPattern(request.url, options.includeQueryString);

	const matchers: Matcher[] = [
		{ type: 'url', enabled: true, pattern, isRegex: false },
		{ type: 'method', enabled: true, method: request.method },
	];

	for (const selection of options.headerMatchers) {
		if (!selection.value) {
			return {
				ok: false,
				error: {
					code: 'header_value_missing',
					message: `Header "${selection.name}" foi marcado mas não tem valor capturado.`,
				},
			};
		}
		const headerMatcher: HeaderMatcher = {
			type: 'header',
			enabled: true,
			headerType: selection.headerType,
			name: selection.name,
			value: selection.value,
		};
		matchers.push(headerMatcher);
	}

	const action = buildActionForType(options.type, request);

	const draft: RuleDraft = {
		name: `${NAME_PREFIX_BY_TYPE[options.type]} para ${pattern}`,
		enabled: true,
		matchers,
		action,
	};

	return { ok: true, draft };
}
```

- [ ] **Step 1.4: Rodar os testes do domínio para verificar que passam**

Run: `npx vitest run src/domain/__tests__/quickMock.test.ts`
Expected: PASS — todos os testes da nova suíte passam.

- [ ] **Step 1.5: Verificar que ninguém mais importa `buildQuickMockDraft` ou `QuickMockOptions`**

Run: `grep -rn "buildQuickMockDraft\|QuickMockOptions\|body_unavailable" src --include="*.ts" --include="*.tsx"`
Expected: NENHUM match. Se aparecer algum (em `QuickMockPanel.tsx`), ignore — esse arquivo será deletado em Task 6 e os imports atualizados em Task 5.

- [ ] **Step 1.6: Rodar lint e tipo-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: Sem erros. (Se `QuickMockPanel.tsx` aparecer com erro de import, isso é OK — Task 5 substitui esse arquivo no `CommandCenter`. Para destravar agora, podemos remover o `QuickMockPanel` aqui mesmo se quiser, mas é mais limpo deixar o cleanup para Task 6.)

**Importante:** se o lint quebrar por causa do `QuickMockPanel`, **pule este step** — voltaremos depois de Task 5.

- [ ] **Step 1.7: Commit**

```bash
cd app
git add src/domain/quickMock.ts src/domain/__tests__/quickMock.test.ts
git commit -m "refactor(domain): generaliza buildQuickMockDraft em buildRuleDraftFromRequest

Suporta os 4 ActionType (mock, breakpoint, transform, delay) com matcher
pré-preenchido a partir da request. Remove dead code body_unavailable do
enum de erros."
```

---

## Task 2: `HeaderMatcherSelector` — componente novo

**Files:**
- Create: `app/src/components/rules/HeaderMatcherSelector.tsx`
- Create: `app/src/components/rules/__tests__/HeaderMatcherSelector.test.tsx`

### Goal

Componente reutilizável que mostra a tabela de headers (request+response) com checkboxes. Quando marcado, adiciona um `HeaderMatcher` ao array de matchers do RuleEditor; quando desmarcado, remove. Headers sensíveis ficam mascarados.

### Steps

- [ ] **Step 2.1: Escrever os testes primeiro**

Cria `app/src/components/rules/__tests__/HeaderMatcherSelector.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Matcher } from '@/types/rules';
import { HeaderMatcherSelector } from '../HeaderMatcherSelector';

const baseHeaders = {
	requestHeaders: { authorization: 'Bearer secret', accept: 'application/json' },
	responseHeaders: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
};

describe('HeaderMatcherSelector', () => {
	test('lista todos headers de request e response', () => {
		const matchers: Matcher[] = [];
		render(
			<HeaderMatcherSelector
				headers={baseHeaders}
				matchers={matchers}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByText('authorization')).toBeInTheDocument();
		expect(screen.getByText('accept')).toBeInTheDocument();
		expect(screen.getByText('content-type')).toBeInTheDocument();
		expect(screen.getByText('cache-control')).toBeInTheDocument();
	});

	test('marca o checkbox quando matcher já existe nos matchers', () => {
		const matchers: Matcher[] = [
			{
				type: 'header',
				enabled: true,
				headerType: 'request',
				name: 'accept',
				value: 'application/json',
			},
		];
		render(
			<HeaderMatcherSelector
				headers={baseHeaders}
				matchers={matchers}
				onChange={vi.fn()}
			/>,
		);
		const row = screen.getByTestId('header-matcher-row-request-accept');
		const checkbox = within(row).getByRole('checkbox');
		expect(checkbox).toHaveAttribute('data-state', 'checked');
	});

	test('mascara valor de header sensível (authorization)', () => {
		render(
			<HeaderMatcherSelector
				headers={baseHeaders}
				matchers={[]}
				onChange={vi.fn()}
			/>,
		);
		const row = screen.getByTestId('header-matcher-row-request-authorization');
		expect(row).not.toHaveTextContent('Bearer secret');
	});

	test('clicar checkbox de header não selecionado adiciona HeaderMatcher via onChange', () => {
		const onChange = vi.fn();
		render(
			<HeaderMatcherSelector
				headers={baseHeaders}
				matchers={[]}
				onChange={onChange}
			/>,
		);
		const row = screen.getByTestId('header-matcher-row-response-content-type');
		fireEvent.click(within(row).getByRole('checkbox'));
		expect(onChange).toHaveBeenCalledTimes(1);
		const updated = onChange.mock.calls[0][0] as Matcher[];
		expect(updated).toEqual([
			expect.objectContaining({
				type: 'header',
				headerType: 'response',
				name: 'content-type',
				value: 'application/json',
				enabled: true,
			}),
		]);
	});

	test('clicar checkbox de header já selecionado remove HeaderMatcher via onChange', () => {
		const onChange = vi.fn();
		const existing: Matcher[] = [
			{
				type: 'header',
				enabled: true,
				headerType: 'response',
				name: 'content-type',
				value: 'application/json',
			},
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
		];
		render(
			<HeaderMatcherSelector
				headers={baseHeaders}
				matchers={existing}
				onChange={onChange}
			/>,
		);
		const row = screen.getByTestId('header-matcher-row-response-content-type');
		fireEvent.click(within(row).getByRole('checkbox'));
		expect(onChange).toHaveBeenCalledTimes(1);
		const updated = onChange.mock.calls[0][0] as Matcher[];
		expect(updated).toEqual([
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
		]);
	});

	test('renderiza mensagem se ambos requestHeaders e responseHeaders vazios', () => {
		render(
			<HeaderMatcherSelector
				headers={{ requestHeaders: {}, responseHeaders: {} }}
				matchers={[]}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByText(/nenhum header capturado/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2.2: Rodar os testes para confirmar que falham**

Run: `npx vitest run src/components/rules/__tests__/HeaderMatcherSelector.test.tsx`
Expected: FAIL com "Cannot find module '../HeaderMatcherSelector'".

- [ ] **Step 2.3: Implementar o componente**

Cria `app/src/components/rules/HeaderMatcherSelector.tsx`:

```tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { isSensitiveHeader, maskHeaderValue } from '@/domain/sensitiveHeaders';
import type { HeaderMatcher, Matcher } from '@/types/rules';

export interface HeaderMatcherSource {
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
}

interface HeaderMatcherSelectorProps {
	headers: HeaderMatcherSource;
	matchers: Matcher[];
	onChange: (next: Matcher[]) => void;
}

interface Row {
	headerType: 'request' | 'response';
	name: string;
	value: string;
	sensitive: boolean;
}

function buildRows(source: HeaderMatcherSource): Row[] {
	const rows: Row[] = [];
	for (const [name, value] of Object.entries(source.requestHeaders)) {
		rows.push({ headerType: 'request', name, value, sensitive: isSensitiveHeader(name) });
	}
	for (const [name, value] of Object.entries(source.responseHeaders)) {
		rows.push({ headerType: 'response', name, value, sensitive: isSensitiveHeader(name) });
	}
	return rows;
}

function findExistingIndex(
	matchers: Matcher[],
	headerType: 'request' | 'response',
	name: string,
): number {
	return matchers.findIndex(
		(m) => m.type === 'header' && m.headerType === headerType && m.name === name,
	);
}

export function HeaderMatcherSelector({
	headers,
	matchers,
	onChange,
}: HeaderMatcherSelectorProps) {
	const rows = buildRows(headers);

	if (rows.length === 0) {
		return (
			<div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
				Nenhum header capturado nesta request.
			</div>
		);
	}

	const handleToggle = (row: Row) => {
		const idx = findExistingIndex(matchers, row.headerType, row.name);
		if (idx >= 0) {
			const next = [...matchers];
			next.splice(idx, 1);
			onChange(next);
			return;
		}
		const matcher: HeaderMatcher = {
			type: 'header',
			enabled: true,
			headerType: row.headerType,
			name: row.name,
			value: row.value,
		};
		onChange([...matchers, matcher]);
	};

	return (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">Header matchers (opcional)</h4>
			<p className="text-xs text-muted-foreground">
				Marque headers para exigir o mesmo valor na request original. Headers sensíveis ficam
				mascarados.
			</p>
			<ScrollArea className="max-h-72 rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
						<tr>
							<th className="px-3 py-2 text-left">Inc.</th>
							<th className="px-3 py-2 text-left">Tipo</th>
							<th className="px-3 py-2 text-left">Nome</th>
							<th className="px-3 py-2 text-left">Valor</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const checked = findExistingIndex(matchers, row.headerType, row.name) >= 0;
							return (
								<tr
									key={`${row.headerType}-${row.name}`}
									className="border-t"
									data-testid={`header-matcher-row-${row.headerType}-${row.name}`}
								>
									<td className="px-3 py-2">
										<Checkbox
											checked={checked}
											onCheckedChange={() => handleToggle(row)}
											disabled={row.sensitive && row.value.length === 0}
										/>
									</td>
									<td className="px-3 py-2 text-xs uppercase">{row.headerType}</td>
									<td className="px-3 py-2 font-mono text-xs">{row.name}</td>
									<td className="px-3 py-2 font-mono text-xs break-all">
										{row.sensitive ? maskHeaderValue(row.name, row.value) : row.value}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</ScrollArea>
		</div>
	);
}
```

- [ ] **Step 2.4: Rodar os testes para verificar que passam**

Run: `npx vitest run src/components/rules/__tests__/HeaderMatcherSelector.test.tsx`
Expected: PASS — todos os 6 testes verdes.

- [ ] **Step 2.5: Lint + type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: Sem erros novos. (Avisos pré-existentes do `QuickMockPanel.tsx` ignorados — Task 6.)

- [ ] **Step 2.6: Commit**

```bash
cd app
git add src/components/rules/HeaderMatcherSelector.tsx src/components/rules/__tests__/HeaderMatcherSelector.test.tsx
git commit -m "feat(rules): adiciona HeaderMatcherSelector reutilizável

Componente extraído da lógica do QuickMockPanel. Recebe headers da
request + matchers atuais e callback onChange para adicionar/remover
HeaderMatchers. Reutilizável dentro do RuleEditor."
```

---

## Task 3: `RuleEditor` ganha props `skipTypeStep`, `initialDraft`, `headerMatcherSource`

**Files:**
- Modify: `app/src/components/rules/RuleEditor.tsx`
- Modify: `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx`

### Goal

`RuleEditor` aceita 3 props novas:
1. `skipTypeStep?: boolean` — esconde o passo "Tipo" da barra; wizard começa em "Matcher".
2. `initialDraft?: RuleDraft` — pré-preenche name/matchers/action quando `mode='create'`; pula a tela de welcome.
3. `headerMatcherSource?: HeaderMatcherSource` — quando presente, renderiza `<HeaderMatcherSelector>` no passo Matcher abaixo do `UnifiedMatcherEditor`.

### Steps

- [ ] **Step 3.1: Escrever testes para `skipTypeStep`**

Adiciona ao final de `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx` (antes do último `});` que fecha o describe):

```tsx
describe('RuleEditor — skipTypeStep', () => {
	test('com skipTypeStep oculta passo Tipo da barra e começa em Matcher', () => {
		render(
			<RuleEditor
				open
				mode="create"
				skipTypeStep
				initialDraft={{
					name: 'Mock teste',
					enabled: true,
					matchers: [
						{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
						{ type: 'method', enabled: true, method: 'GET' },
					],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
				}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		const stepBar = screen.getByTestId('rule-wizard-steps');
		expect(within(stepBar).queryByTestId('rule-wizard-step-type')).toBeNull();
		expect(within(stepBar).getByTestId('rule-wizard-step-matcher')).toBeInTheDocument();
		expect(within(stepBar).getByTestId('rule-wizard-step-action')).toBeInTheDocument();
		expect(within(stepBar).getByTestId('rule-wizard-step-review')).toBeInTheDocument();
		expect(screen.getByTestId('rule-wizard-step-matcher')).toHaveAttribute(
			'aria-current',
			'step',
		);
	});

	test('com skipTypeStep wizard avança Matcher → Ação → Revisar', () => {
		render(
			<RuleEditor
				open
				mode="create"
				skipTypeStep
				initialDraft={{
					name: 'Mock teste',
					enabled: true,
					matchers: [
						{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
						{ type: 'method', enabled: true, method: 'GET' },
					],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
				}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute(
			'aria-current',
			'step',
		);
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByTestId('rule-wizard-step-review')).toHaveAttribute(
			'aria-current',
			'step',
		);
	});

	test('initialDraft pré-preenche name/matchers/action e pula welcome', () => {
		const onSave = vi.fn().mockResolvedValue(true);
		render(
			<RuleEditor
				open
				mode="create"
				skipTypeStep
				initialDraft={{
					name: 'Custom name',
					enabled: true,
					matchers: [
						{ type: 'url', enabled: true, pattern: 'api.example.com/x', isRegex: false },
						{ type: 'method', enabled: true, method: 'POST' },
					],
					action: { type: 'breakpoint', enabled: true, description: '' },
				}}
				onOpenChange={vi.fn()}
				onSave={onSave}
			/>,
		);
		// Welcome não aparece
		expect(screen.queryByTestId('preset-blank')).toBeNull();
		// Avança até Revisar
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByText(/Custom name/)).toBeInTheDocument();
	});

	test('headerMatcherSource renderiza HeaderMatcherSelector no passo Matcher', () => {
		render(
			<RuleEditor
				open
				mode="create"
				skipTypeStep
				initialDraft={{
					name: 'Test',
					enabled: true,
					matchers: [
						{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
						{ type: 'method', enabled: true, method: 'GET' },
					],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
				}}
				headerMatcherSource={{
					requestHeaders: { 'x-custom': 'foo' },
					responseHeaders: { 'content-type': 'application/json' },
				}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		// Passo Matcher é o atual; verifica que a tabela de headers aparece
		expect(screen.getByText('x-custom')).toBeInTheDocument();
		expect(screen.getByText('content-type')).toBeInTheDocument();
	});

	test('headerMatcherSource ausente não renderiza HeaderMatcherSelector', () => {
		render(
			<RuleEditor
				open
				mode="create"
				skipTypeStep
				initialDraft={{
					name: 'Test',
					enabled: true,
					matchers: [
						{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
						{ type: 'method', enabled: true, method: 'GET' },
					],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
				}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		expect(screen.queryByText(/Header matchers \(opcional\)/)).toBeNull();
	});
});
```

- [ ] **Step 3.2: Rodar para confirmar que falham**

Run: `npx vitest run src/components/rules/__tests__/RuleEditor.wizard.test.tsx`
Expected: FAIL nos novos testes — `skipTypeStep`, `initialDraft`, `headerMatcherSource` não são props conhecidas.

- [ ] **Step 3.3: Atualizar `RuleEditor.tsx` — adicionar imports e props**

No arquivo `app/src/components/rules/RuleEditor.tsx`:

(a) Adiciona import no topo (depois dos imports existentes):

```tsx
import {
	HeaderMatcherSelector,
	type HeaderMatcherSource,
} from './HeaderMatcherSelector';
import type { RuleDraft } from '@/types/rules';
```

> Nota: `RuleDraft` já é exportado de `@/types/rules` — só precisamos importar.

(b) Atualiza a interface `RuleEditorProps` para:

```tsx
interface RuleEditorProps {
	open: boolean;
	mode: 'create' | 'edit';
	rule?: Rule;
	onOpenChange: (open: boolean) => void;
	onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
	skipTypeStep?: boolean;
	initialDraft?: RuleDraft;
	headerMatcherSource?: HeaderMatcherSource;
}
```

- [ ] **Step 3.4: Atualizar `STEPS` e estado inicial para respeitar `skipTypeStep`**

Substitui a constante `STEPS` (linha 51) e o tipo `WizardStep` por:

```tsx
type WizardStep = 'type' | 'matcher' | 'action' | 'review';

const FULL_STEPS: readonly WizardStep[] = ['type', 'matcher', 'action', 'review'] as const;
const STEPS_WITHOUT_TYPE: readonly WizardStep[] = ['matcher', 'action', 'review'] as const;
```

Na assinatura do componente, recebe as novas props:

```tsx
const RuleEditor: React.FC<RuleEditorProps> = ({
	open,
	mode,
	rule,
	onOpenChange,
	onSave,
	skipTypeStep = false,
	initialDraft,
	headerMatcherSource,
}) => {
```

E logo no início do corpo, deriva a lista de passos:

```tsx
const STEPS = skipTypeStep ? STEPS_WITHOUT_TYPE : FULL_STEPS;
```

- [ ] **Step 3.5: Atualizar estado inicial para respeitar `initialDraft` e `skipTypeStep`**

Substitui o `useState` de `step` (linha 137) e o `useEffect` de inicialização (linhas 196-230):

```tsx
const [step, setStep] = useState<WizardStep>(skipTypeStep ? 'matcher' : 'type');
```

E o `useEffect` de inicialização (atualizado):

```tsx
useEffect(() => {
	if (!open) return;
	if (mode === 'edit' && rule) {
		setName(rule.name);
		setMatchers(rule.matchers);
		setAction(rule.action);
		setEnabled(rule.enabled);
		setView('editor');
		setCameFromWelcome(false);
		setStep(skipTypeStep ? 'matcher' : 'type');
		setMaxStepIndexReached(STEPS.length - 1);
		setInitialSnapshot(
			snapshot({
				name: rule.name,
				enabled: rule.enabled,
				matchers: rule.matchers,
				action: rule.action,
			}),
		);
		setShowCancelConfirm(false);
		return;
	}
	if (mode === 'create') {
		if (initialDraft) {
			setName(initialDraft.name);
			setMatchers(initialDraft.matchers);
			setAction(initialDraft.action);
			setEnabled(initialDraft.enabled);
			setView('editor');
			setCameFromWelcome(false);
			setStep(skipTypeStep ? 'matcher' : 'type');
			setMaxStepIndexReached(0);
			setInitialSnapshot(snapshot(initialDraft));
			setShowCancelConfirm(false);
			return;
		}
		setName('Nova Regra');
		setMatchers(DEFAULT_MATCHERS);
		setAction(DEFAULT_ACTION);
		setEnabled(true);
		setView(skipTypeStep ? 'editor' : 'welcome');
		setCameFromWelcome(false);
		setStep(skipTypeStep ? 'matcher' : 'type');
		setMaxStepIndexReached(0);
		setInitialSnapshot('');
		setShowCancelConfirm(false);
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: STEPS é derivado de skipTypeStep
}, [open, mode, rule, skipTypeStep, initialDraft]);
```

- [ ] **Step 3.6: Renderizar `HeaderMatcherSelector` no passo Matcher**

Substitui a função `renderMatcherStep` (linha 475-486):

```tsx
const renderMatcherStep = () => (
	<div className="space-y-3">
		<div>
			<h3 className="mb-1 text-lg font-medium">Condições de Match</h3>
			<p className="mb-4 text-sm text-muted-foreground">
				Defina o padrão de URL e os métodos HTTP que disparam esta regra. O painel à direita
				mostra em tempo real se a regra casaria uma URL de teste.
			</p>
		</div>
		<UnifiedMatcherEditor matchers={matchers} onChange={setMatchers} />
		{headerMatcherSource && (
			<HeaderMatcherSelector
				headers={headerMatcherSource}
				matchers={matchers}
				onChange={setMatchers}
			/>
		)}
	</div>
);
```

- [ ] **Step 3.7: Rodar os testes do RuleEditor wizard**

Run: `npx vitest run src/components/rules/__tests__/RuleEditor.wizard.test.tsx`
Expected: PASS — todos os testes (existentes + 5 novos) passam.

- [ ] **Step 3.8: Rodar todos os testes do RuleEditor (welcome também)**

Run: `npx vitest run src/components/rules/__tests__/`
Expected: PASS — testes do RuleEditor.welcome continuam passando (default `skipTypeStep=false`).

- [ ] **Step 3.9: Lint + type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: Sem novos erros.

- [ ] **Step 3.10: Commit**

```bash
cd app
git add src/components/rules/RuleEditor.tsx src/components/rules/__tests__/RuleEditor.wizard.test.tsx
git commit -m "feat(rules): RuleEditor aceita skipTypeStep/initialDraft/headerMatcherSource

Permite reusar o wizard a partir de uma request capturada com matchers
pré-preenchidos e o passo Tipo escondido. headerMatcherSource renderiza
o HeaderMatcherSelector dentro do passo Matcher."
```

---

## Task 4: `RequestInspector` substitui botão por dropdown

**Files:**
- Modify: `app/src/components/command-center/RequestInspector.tsx`
- Modify: `app/src/components/command-center/__tests__/RequestInspector.test.tsx`

### Goal

Trocar o `<Button>` "Criar Mock" por um `<DropdownMenu>` "Criar regra" com 4 itens (Mock/Breakpoint/Transform/Latência). Substituir prop `onCreateMock(req, id)` por `onCreateRule(req, id, type)`.

### Steps

- [ ] **Step 4.1: Atualizar testes do RequestInspector**

Em `app/src/components/command-center/__tests__/RequestInspector.test.tsx`:

(a) Atualiza `noopHandlers` (linha 27-31):

```tsx
const noopHandlers = {
	onCreateRule: vi.fn(),
	onOpenInRulesLab: vi.fn(),
	onClose: vi.fn(),
};
```

(b) Substitui o teste "botão Criar Mock sempre visível" (linhas 107-122) por um bloco com 4 testes (um por tipo) + verificação do badge na status row:

```tsx
test('dropdown "Criar regra" sempre visível', () => {
	render(
		<RequestInspector
			request={baseRequest({ isWaiting: true })}
			requestId="r1"
			rules={[]}
			{...noopHandlers}
		/>,
	);
	expect(screen.getByTestId('request-inspector-create-rule')).toBeInTheDocument();
});

test('dropdown desabilitado quando captureError presente', () => {
	render(
		<RequestInspector
			request={baseRequest({ captureError: 'Net::ERR_FAILED' })}
			requestId="r1"
			rules={[]}
			{...noopHandlers}
		/>,
	);
	expect(screen.getByTestId('request-inspector-create-rule')).toBeDisabled();
});

test.each([
	['mock', 'Mock'],
	['breakpoint', 'Breakpoint'],
	['transform', 'Transform'],
	['delay', 'Latência'],
] as const)('item "%s" do dropdown chama onCreateRule com type=%s', (type, label) => {
	const onCreateRule = vi.fn();
	render(
		<RequestInspector
			request={baseRequest({ isWaiting: true })}
			requestId="r1"
			rules={[]}
			{...noopHandlers}
			onCreateRule={onCreateRule}
		/>,
	);
	fireEvent.click(screen.getByTestId('request-inspector-create-rule'));
	const item = screen.getByTestId(`request-inspector-create-rule-${type}`);
	fireEvent.click(item);
	expect(onCreateRule).toHaveBeenCalledTimes(1);
	expect(onCreateRule).toHaveBeenCalledWith(
		expect.objectContaining({ isWaiting: true }),
		'r1',
		type,
	);
	expect(label).toBeTruthy();
});
```

(c) Atualiza o teste "badge de status e botão na mesma linha" (linhas 124-136):

```tsx
test('badge de status e dropdown "Criar regra" ficam na mesma linha (status row)', () => {
	render(
		<RequestInspector
			request={baseRequest({ isWaiting: true })}
			requestId="r1"
			rules={[]}
			{...noopHandlers}
		/>,
	);
	const statusRow = screen.getByTestId('request-inspector-status-row');
	expect(statusRow).toContainElement(screen.getByTestId('awaiting-decision-badge'));
	expect(statusRow).toContainElement(screen.getByTestId('request-inspector-create-rule'));
});
```

- [ ] **Step 4.2: Rodar os testes para confirmar que falham**

Run: `npx vitest run src/components/command-center/__tests__/RequestInspector.test.tsx`
Expected: FAIL — `onCreateRule` não é prop conhecida; `request-inspector-create-rule` não existe.

- [ ] **Step 4.3: Atualizar `RequestInspector.tsx`**

(a) Imports — adicionar/ajustar. O import existente `import type { Rule } from '@/types/rules';` deve virar `import type { Action, ActionType, Rule } from '@/types/rules';`. E adicionar logo abaixo:

```tsx
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getActionVisuals } from '@/components/rules-lab/ruleVisuals';
import { cn } from '@/lib/utils';
```

(b) Atualiza a interface (linhas 13-20):

```tsx
interface RequestInspectorProps {
	request: InterceptedResponse | null;
	requestId: string | null;
	onCreateRule: (request: InterceptedResponse, requestId: string, actionType: ActionType) => void;
	onOpenInRulesLab: (ruleId: string) => void;
	onClose: () => void;
	rules: Rule[];
}
```

(c) Atualiza a desestruturação no componente (linhas 28-35):

```tsx
export function RequestInspector({
	request,
	requestId,
	onCreateRule,
	onOpenInRulesLab,
	onClose,
	rules,
}: RequestInspectorProps) {
```

(d) Substitui o `<Button>` "Criar Mock" (linhas 115-125) pelo dropdown:

```tsx
<DropdownMenu>
	<DropdownMenuTrigger asChild>
		<Button
			size="sm"
			variant="outline"
			disabled={Boolean(request.captureError)}
			className="gap-2"
			data-testid="request-inspector-create-rule"
		>
			<LucideIcon name="plus" className="h-4 w-4" />
			Criar regra
			<LucideIcon name="chevron-down" className="h-4 w-4" />
		</Button>
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		{(['mock', 'breakpoint', 'transform', 'delay'] as const).map((type) => {
			const action: Action =
				type === 'mock'
					? { type: 'mock', enabled: true, status: 200, headers: {} }
					: type === 'breakpoint'
						? { type: 'breakpoint', enabled: true }
						: type === 'transform'
							? { type: 'transform', enabled: true, mode: 'declarative', operations: [] }
							: { type: 'delay', enabled: true, timeMs: 1000 };
			const v = getActionVisuals(action);
			return (
				<DropdownMenuItem
					key={type}
					data-testid={`request-inspector-create-rule-${type}`}
					onClick={() => onCreateRule(request, requestId, type)}
					className="gap-2"
				>
					<span
						className={cn(
							'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
							v.bgClass,
							v.textClass,
						)}
					>
						<LucideIcon name={v.iconName} className="h-3.5 w-3.5" />
					</span>
					<span>{v.label}</span>
				</DropdownMenuItem>
			);
		})}
	</DropdownMenuContent>
</DropdownMenu>
```

(O `Action` e `ActionType` que esse JSX usa estão no import consolidado do passo (a) acima.)

- [ ] **Step 4.4: Rodar os testes do RequestInspector**

Run: `npx vitest run src/components/command-center/__tests__/RequestInspector.test.tsx`
Expected: PASS — incluindo os 4 cases do `test.each`.

- [ ] **Step 4.5: Lint + type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: Erros novos esperados em `CommandCenter.tsx` (que ainda passa `onCreateMock`) e/ou `QuickMockPanel.tsx`. Está OK — Task 5 conserta. **Pule este step se quebrar.**

- [ ] **Step 4.6: Commit**

```bash
cd app
git add src/components/command-center/RequestInspector.tsx src/components/command-center/__tests__/RequestInspector.test.tsx
git commit -m "feat(inspector): substitui botão Criar Mock por dropdown Criar regra

Dropdown com 4 opções (Mock/Breakpoint/Transform/Latência) usando
ícones e cores do getActionVisuals. Prop onCreateMock(req,id) vira
onCreateRule(req,id,type)."
```

---

## Task 5: `CommandCenter` URL routing + render do `RuleEditor`

**Files:**
- Modify: `app/src/pages/CommandCenter.tsx`

### Goal

Substituir `?mock=<id>` por `?createRule=<id>&type=<type>`. Renderizar `<RuleEditor>` direto no lugar do `<QuickMockPanel>`. Wirer `addRule` via `useRules()`.

### Steps

- [ ] **Step 5.1: Reescrever o `CommandCenter.tsx`**

Substitui o conteúdo do arquivo `app/src/pages/CommandCenter.tsx` inteiro:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import type { ActionType, Rule } from '@/types/rules';
import { useAppOutlet } from '@/types/outletContext';
import { useRules } from '@/hooks/useRules';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import RuleEditor from '@/components/rules/RuleEditor';
import { EditResponseSheet } from '@/components/command-center/EditResponseSheet';
import { buildRuleDraftFromRequest } from '@/domain/quickMock';
import { cn } from '@/lib/utils';
import { filtersEqualUrl, parseFiltersFromUrl, serializeFiltersToUrl } from '@/lib/filterUrl';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const VALID_RULE_TYPES: ReadonlySet<ActionType> = new Set([
	'mock',
	'breakpoint',
	'transform',
	'delay',
]);

const isActionType = (value: string | null): value is ActionType =>
	value !== null && VALID_RULE_TYPES.has(value as ActionType);

const CommandCenter: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	const {
		filteredRequests,
		filters,
		setFilters,
		clearAllRequests,
		approveResponseWithEdit,
		pendingResponses,
		rules,
		selectedId,
		selected,
		select,
		clear,
	} = useAppOutlet();

	const { addRule } = useRules();

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);
	const [createRuleError, setCreateRuleError] = useState<string | null>(null);

	const hydratedFromUrlRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: hidrata uma única vez
	useEffect(() => {
		if (hydratedFromUrlRef.current) return;
		hydratedFromUrlRef.current = true;
		const fromUrl = parseFiltersFromUrl(searchParams);
		if (fromUrl.length > 0) setFilters(fromUrl);
	}, []);

	useEffect(() => {
		if (!hydratedFromUrlRef.current) return;
		const desired = serializeFiltersToUrl(filters);
		const current = searchParams.getAll('filter');
		if (filtersEqualUrl(desired, current)) return;
		const next = new URLSearchParams(searchParams);
		next.delete('filter');
		for (const value of desired) next.append('filter', value);
		setSearchParams(next, { replace: true });
	}, [filters, searchParams, setSearchParams]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	useEffect(() => {
		if (selectedId && !selected) clear();
	}, [selectedId, selected, clear]);

	const editParam = searchParams.get('edit');
	const createRuleParam = searchParams.get('createRule');
	const createRuleTypeParam = searchParams.get('type');

	const editSheetTargetId = editParam;
	const createRuleTargetId = !editParam && createRuleParam ? createRuleParam : null;
	const createRuleType = isActionType(createRuleTypeParam) ? createRuleTypeParam : null;

	const editTarget = editSheetTargetId ? (pendingResponses[editSheetTargetId] ?? null) : null;
	const createRuleTarget = createRuleTargetId
		? (filteredRequests[createRuleTargetId] ?? pendingResponses[createRuleTargetId] ?? null)
		: null;

	useEffect(() => {
		const next = new URLSearchParams(searchParams);
		let changed = false;
		if (editParam && !editTarget) {
			next.delete('edit');
			changed = true;
		}
		if (createRuleParam && (!createRuleTarget || !createRuleType) && !editParam) {
			next.delete('createRule');
			next.delete('type');
			changed = true;
		}
		if (editParam && editTarget && (createRuleParam || createRuleTypeParam)) {
			next.delete('createRule');
			next.delete('type');
			changed = true;
		}
		if (changed) setSearchParams(next, { replace: true });
	}, [
		editParam,
		createRuleParam,
		createRuleTypeParam,
		editTarget,
		createRuleTarget,
		createRuleType,
		searchParams,
		setSearchParams,
	]);

	const closeEditSheet = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('edit');
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const closeCreateRule = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('createRule');
		next.delete('type');
		setSearchParams(next, { replace: true });
		setCreateRuleError(null);
	}, [searchParams, setSearchParams]);

	const openCreateRuleFor = useCallback(
		(requestId: string, actionType: ActionType) => {
			const next = new URLSearchParams(searchParams);
			next.set('createRule', requestId);
			next.set('type', actionType);
			next.delete('edit');
			setSearchParams(next, { replace: true });
			setCreateRuleError(null);
		},
		[searchParams, setSearchParams],
	);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateRule = (
		_request: InterceptedResponse,
		requestId: string,
		actionType: ActionType,
	) => {
		openCreateRuleFor(requestId, actionType);
	};

	const draftResult = useMemo(() => {
		if (!createRuleTarget || !createRuleType) return null;
		return buildRuleDraftFromRequest(createRuleTarget, {
			type: createRuleType,
			includeQueryString: false,
			headerMatchers: [],
		});
	}, [createRuleTarget, createRuleType]);

	const handleCreateRuleSave = async (
		newRule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<boolean> => {
		const created = await addRule(newRule.name, newRule.matchers, newRule.action);
		if (created) {
			setRecentRuleId(created.id);
			closeCreateRule();
			return true;
		}
		setCreateRuleError('Falha ao gravar a regra em chrome.storage.local.');
		return false;
	};

	const headerMatcherSource = createRuleTarget
		? {
				requestHeaders: createRuleTarget.request?.headers ?? {},
				responseHeaders: createRuleTarget.response?.headers ?? createRuleTarget.headers,
			}
		: undefined;

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden lg:flex-row">
			<section
				className={cn(
					'flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-4',
					selected ? 'lg:w-[28%] lg:min-w-[320px] lg:flex-shrink-0' : 'flex-1',
				)}
			>
				<RequestTimeline
					requests={filteredRequests}
					selectedId={selectedId}
					onSelect={select}
					filters={filters}
					onFiltersChange={setFilters}
					onClearHistory={() => setClearDialogOpen(true)}
				/>
			</section>

			{selected && selectedId && (
				<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t lg:border-l lg:border-t-0">
					<RequestInspector
						request={{
							...selected,
							generatedRuleId: recentRuleId ?? selected.generatedRuleId,
						}}
						requestId={selectedId}
						onCreateRule={handleCreateRule}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{createRuleTarget && createRuleTargetId && createRuleType && draftResult?.ok && (
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={draftResult.draft}
					headerMatcherSource={headerMatcherSource}
					onOpenChange={(open) => {
						if (!open) closeCreateRule();
					}}
					onSave={handleCreateRuleSave}
				/>
			)}

			{createRuleTarget && draftResult && !draftResult.ok && (
				<AlertDialog open onOpenChange={(o) => !o && closeCreateRule()}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Não foi possível criar regra</AlertDialogTitle>
							<AlertDialogDescription>{draftResult.error.message}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={closeCreateRule}>Fechar</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{createRuleError && (
				<AlertDialog open onOpenChange={() => setCreateRuleError(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Erro ao salvar</AlertDialogTitle>
							<AlertDialogDescription>{createRuleError}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={() => setCreateRuleError(null)}>OK</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{editTarget && editSheetTargetId && (
				<EditResponseSheet
					open
					onOpenChange={(open) => {
						if (!open) closeEditSheet();
					}}
					request={editTarget}
					requestId={editSheetTargetId}
					onSubmit={approveResponseWithEdit}
				/>
			)}

			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove todas as requisições. Não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleClearHistory} className="bg-red-500 hover:bg-red-600">
							Limpar histórico
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default CommandCenter;
```

- [ ] **Step 5.2: Lint + type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: O `CommandCenter.tsx` deve compilar. **Erro esperado:** `QuickMockPanel.tsx` (não importado em lugar nenhum agora) ainda existe no disco e seu import `buildQuickMockDraft` foi deletado em Task 1, então pode quebrar o build se for incluído no bundle. Verificar com: `grep -rn "QuickMockPanel" src --include="*.ts" --include="*.tsx"` — se só o próprio arquivo aparecer, está OK (next task deleta).

- [ ] **Step 5.3: Rodar testes do CommandCenter (caso existam)**

Run: `find src -name "CommandCenter*.test*" -type f`
Expected: provavelmente nenhum match — não há testes diretos. Pular se vazio.

Se houver, rodar `npx vitest run <path>` e ajustar o teste para usar `?createRule=&type=` em vez de `?mock=`.

- [ ] **Step 5.4: Build de produção (smoke test)**

Run: `npm run build`
Expected: BUILD bem-sucedido. Se quebrar com erro relacionado a `QuickMockPanel` importando `buildQuickMockDraft` que não existe mais, isso é OK — Task 6 deleta o arquivo. Continue mesmo assim.

> Se o build falhar e quiser destravar antes do commit, delete `src/components/command-center/QuickMockPanel.tsx` agora e siga para Task 6.

- [ ] **Step 5.5: Commit**

```bash
cd app
git add src/pages/CommandCenter.tsx
git commit -m "feat(command-center): substitui QuickMockPanel por RuleEditor pré-preenchido

URL ?mock=<id> vira ?createRule=<id>&type=<mock|breakpoint|transform|delay>.
Wireia useRules().addRule e mostra erro inline se buildRuleDraftFromRequest
retornar erro tipado (capture_error/method_missing)."
```

---

## Task 6: Cleanup — deletar `QuickMockPanel`, validação final

**Files:**
- Delete: `app/src/components/command-center/QuickMockPanel.tsx`

### Goal

Remover o `QuickMockPanel` (não há mais imports) e garantir que tudo passa: lint, build, testes.

### Steps

- [ ] **Step 6.1: Verificar que ninguém importa o `QuickMockPanel`**

Run: `grep -rn "QuickMockPanel" src --include="*.ts" --include="*.tsx"`
Expected: ÚNICO match deve ser o próprio arquivo `QuickMockPanel.tsx`.

Se aparecer outro lugar, atualize antes de continuar.

- [ ] **Step 6.2: Deletar o arquivo**

```bash
cd app
rm src/components/command-center/QuickMockPanel.tsx
```

- [ ] **Step 6.3: Verificar que não restou referência ao símbolo antigo do domínio**

Run: `grep -rn "buildQuickMockDraft\|QuickMockOptions\|body_unavailable\|openQuickMockFor\|quickMockTarget\|?mock=" src --include="*.ts" --include="*.tsx"`
Expected: NENHUM match.

Se aparecer, ler o arquivo e atualizar (provavelmente algum teste/snapshot esquecido).

- [ ] **Step 6.4: Rodar a suite completa de testes**

Run: `npm test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 6.5: Lint + type-check + build**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: Tudo verde.

- [ ] **Step 6.6: Commit**

```bash
cd app
git add -A
git commit -m "refactor(command-center): remove QuickMockPanel obsoleto

Substituído pelo RuleEditor renderizado direto do CommandCenter via
?createRule=<id>&type=<type>."
```

---

## Task 7: Beads — registrar epic + filhos

### Goal

Registrar a história no beads para histórico, conforme convenção do projeto.

### Steps

- [ ] **Step 7.1: Criar epic + 4 filhos via `bd`**

A partir da raiz do repo (não de `app/`):

```bash
bd create --type=feature --priority=2 \
  --title="Substituir botão Criar Mock por dropdown de criação de regras" \
  --description="Inspector da request troca o botão único 'Criar Mock' por um dropdown com 4 tipos (Mock/Breakpoint/Transform/Latência) que reusa o RuleEditor de /rules-lab pré-preenchido. Spec: docs/superpowers/specs/2026-05-01-create-rule-from-request-design.md."
```

Anote o id retornado (`<EPIC_ID>`).

```bash
bd create --type=task --priority=2 \
  --title="Generalizar buildQuickMockDraft em buildRuleDraftFromRequest" \
  --description="Suporta os 4 ActionType. Limpar body_unavailable do enum. Atualizar testes." 
# anote <T1>

bd create --type=task --priority=2 \
  --title="HeaderMatcherSelector + props skipTypeStep/initialDraft/headerMatcherSource no RuleEditor" \
  --description="Componente novo extraído do QuickMockPanel. RuleEditor aceita as 3 props novas e renderiza o selector no passo Matcher quando aplicável."
# anote <T2>

bd create --type=task --priority=2 \
  --title="RequestInspector dropdown + CommandCenter URL routing" \
  --description="Botão Criar Mock vira DropdownMenu Criar regra. CommandCenter substitui ?mock=<id> por ?createRule=<id>&type=<type>, renderiza RuleEditor direto."
# anote <T3>

bd create --type=task --priority=2 \
  --title="Cleanup: deletar QuickMockPanel e validar build/testes" \
  --description="Remover arquivo, garantir grep -rn limpo, rodar npm test/lint/build."
# anote <T4>
```

- [ ] **Step 7.2: Adicionar dependências**

```bash
bd dep add <T2> <T1>     # T2 depende de T1
bd dep add <T3> <T1>     # T3 depende de T1 (usa buildRuleDraftFromRequest)
bd dep add <T3> <T2>     # T3 depende de T2 (usa skipTypeStep/initialDraft)
bd dep add <T4> <T2>
bd dep add <T4> <T3>
bd dep add <EPIC_ID> <T1>  # epic depende dos 4 filhos
bd dep add <EPIC_ID> <T2>
bd dep add <EPIC_ID> <T3>
bd dep add <EPIC_ID> <T4>
```

- [ ] **Step 7.3: Fechar os 4 tasks ao concluir cada uma**

Conforme cada task do plano fecha, rodar:

```bash
bd close <Tn>
```

Ao fechar T4, fechar também o epic:

```bash
bd close <EPIC_ID>
```

- [ ] **Step 7.4: Push final (session close protocol)**

A partir da raiz do repo:

```bash
git pull --rebase
bd dolt push
git push
git status
```

Expected: `git status` mostra "up to date with origin".

---

## Verification checklist (final)

Antes de considerar a feature pronta, verifique manualmente:

- [ ] `cd app && npm run build:dev` produz `dist/` sem erros.
- [ ] Recarregar a extensão em `chrome://extensions`.
- [ ] Abrir o Command Center, capturar uma request, selecionar uma da timeline.
- [ ] Botão "Criar regra" mostra dropdown com 4 itens, cada um com ícone/cor correto.
- [ ] Clicar "Mock" abre o `RuleEditor` com 3 passos visíveis (Matcher, Ação, Revisar) — sem "Tipo".
- [ ] No passo Matcher: vê URL `host+path` pré-preenchida, método HTTP correto, e a tabela de Header matchers com headers da request capturada.
- [ ] No passo Ação: para Mock, vê status/headers/body já preenchidos da response capturada — todos editáveis.
- [ ] Salvar a regra cria item em `/rules-lab` com nome `Mock para <pattern>`.
- [ ] Repetir para Breakpoint/Transform/Latência: action editor aparece com defaults vazios; salva regra com prefixo correto.
- [ ] Fechar o wizard (X ou Cancelar) limpa `?createRule=&type=` da URL.
- [ ] URL com `?createRule=<id>&type=mock` reabre o wizard se a request ainda existir; param inválido é limpo automaticamente.
- [ ] `RequestHeader` sensível (`authorization`) aparece mascarado na tabela.

---

## Notas

- **Trabalho fora de escopo (mesma do spec):** mudar `EditResponseSheet`, adicionar templates, permitir trocar tipo dentro do wizard. Não toque nesses pontos.
- **Convenções de commit:** Conventional Commits (`feat:`, `refactor:`, etc.) — habilitado pelo husky `commit-msg`.
- **Indentação:** tabs (size 2). Biome reclama se for espaço.
- **No fallbacks rule:** `buildRuleDraftFromRequest` retorna `{ ok: false, error }` em vez de fabricar dados — manter esse padrão. CommandCenter mostra erro inline em vez de continuar.
- **i18n:** todas as strings novas em PT-BR (consistente com o resto do app).
