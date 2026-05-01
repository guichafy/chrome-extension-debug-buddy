# Substituir botão "Criar Mock" por dropdown de criação de regras

**Data:** 2026-05-01
**Status:** Aprovado para implementação
**Issue tracker:** beads (epic + 4 filhos a criar)

## Contexto

Hoje, ao inspecionar uma Request capturada (`RequestInspector.tsx`), o usuário tem **um único botão "Criar Mock"** que abre o `QuickMockPanel`. Esse painel só permite configurar o **matcher** (URL pattern, query string, método, header matchers da request) — o `MockAction` é pré-preenchido a partir da response capturada (status/headers/body) **mas não é editável**.

O `/rules-lab` (página `RulesLab.tsx`) tem um wizard completo (`RuleEditor.tsx`) que cobre os 4 tipos de action (`mock`, `breakpoint`, `transform`, `delay`) com edição completa de matchers e action via `ActionEditor`. Esse wizard tem 4 passos: **Tipo → Matcher → Ação → Revisar**.

Queremos trazer paridade: ao inspecionar uma Request, o usuário deve poder criar regra de qualquer um dos 4 tipos com edição completa, partindo de matchers pré-preenchidos a partir da request capturada.

## Objetivo

Substituir o botão "Criar Mock" por um dropdown com 4 opções (Mock, Breakpoint, Transform, Latência) que abre o **mesmo `RuleEditor`** usado em `/rules-lab`, pré-preenchido a partir da request, com o passo "Tipo" omitido (o tipo já foi escolhido pelo dropdown).

## Decisões de design (acordadas com o usuário)

1. **Reusar `RuleEditor`** em vez de criar painel novo. Mantém UX consistente com `/rules-lab`.
2. **Substituir totalmente o `QuickMockPanel`** — sem fluxo paralelo.
3. **Pré-preencher matchers** com host+path da URL e o método HTTP da request (sem query string, sem header matchers automáticos). Mesmo comportamento que o `QuickMockPanel` atual.
4. **Esconder o passo "Tipo"** quando aberto via dropdown — o tipo é fixado pela escolha. Barra do wizard mostra apenas Matcher → Ação → Revisar.
5. **Manter a feature de header matchers** (tabela de headers da request com checkboxes). Vai aparecer como seção opcional **dentro do passo "Matcher"** do wizard, e só quando o wizard for aberto a partir de uma Request.
6. **URL routing:** trocar `?mock=<id>` por `?createRule=<id>&type=mock|breakpoint|transform|delay`. Permite deep-link para qualquer tipo.

## Arquitetura

### 1. `RequestInspector.tsx`

Substitui o `<Button>` "Criar Mock" (linhas 115-125) por um `<DropdownMenu>` com 4 itens.

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="sm" variant="outline" disabled={Boolean(request.captureError)}
            data-testid="request-inspector-create-rule">
      <LucideIcon name="plus" /> Criar regra
      <LucideIcon name="chevron-down" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => onCreateRule(request, requestId, 'mock')}>
      ... ícone+cor de Mock ... Mock
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onCreateRule(request, requestId, 'breakpoint')}>
      ... Breakpoint
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onCreateRule(request, requestId, 'transform')}>
      ... Transform
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onCreateRule(request, requestId, 'delay')}>
      ... Latência
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- Ícones e cores reaproveitam `getActionVisuals(actionDefault)` de `components/rules-lab/ruleVisuals`.
- Substitui a prop `onCreateMock(request, requestId)` por `onCreateRule(request, requestId, type: ActionType)`.
- Item "Latência" mapeia para o action type `'delay'` — o label "Latência" combina com a UI atual em PT-BR (`ACTION_TYPE_DESCRIPTION` usa "Atrasa a resposta antes de devolver ao cliente.").

### 2. Props novas no `RuleEditor.tsx`

```ts
interface RuleEditorProps {
  // existentes
  open: boolean;
  mode: 'create' | 'edit';
  rule?: Rule;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: RuleDraft) => Promise<boolean>;

  // novas
  skipTypeStep?: boolean;
  initialDraft?: RuleDraft;
  headerMatcherSource?: {
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
  };
}
```

**Comportamento:**

- `skipTypeStep` (default `false`):
  - `STEPS` vira `['matcher', 'action', 'review']`.
  - `STEP_META` continua igual (tipo só não aparece na barra).
  - Estado inicial: `step = 'matcher'`, `maxStepIndexReached = 0`.
  - O card de tipo (`renderTypeStep`) deixa de ser renderizado.

- `initialDraft` (só usado quando `mode='create'`):
  - Sobrescreve os defaults `'Nova Regra' / DEFAULT_MATCHERS / DEFAULT_ACTION` no `useEffect` de inicialização.
  - O nome inicial vem de `initialDraft.name` (ex.: `'Mock para api.github.com/users'`).
  - `initialSnapshot` é setado com `initialDraft` para detectar "alterações em relação ao pré-preenchido".
  - **Skipa a tela de Welcome** quando `initialDraft` está presente: `setView('editor')` direto.

- `headerMatcherSource`:
  - Quando presente, renderiza abaixo do `<UnifiedMatcherEditor>` no `renderMatcherStep` uma seção `<HeaderMatcherSelector>` (componente novo, lógica extraída do `QuickMockPanel`).
  - O componente recebe `requestHeaders`, `responseHeaders`, e callbacks `onAdd(matcher)` / `onRemove(name, headerType)`.
  - Estado: deriva da lista atual de matchers — pra cada par `(headerType, name)` em `headerMatcherSource`, verifica se há um `HeaderMatcher` correspondente em `matchers` para decidir se o checkbox está marcado.
  - Headers sensíveis (`isSensitiveHeader`) ficam mascarados (`maskHeaderValue`) e podem ser desabilitados quando `value.length === 0`.
  - Toggle adiciona/remove um `HeaderMatcher` do array de matchers.

### 3. Domain helper

Renomear/expandir `app/src/domain/quickMock.ts` → mantém o arquivo (mais simples), mas:

```ts
// Substitui buildQuickMockDraft. Suporta os 4 ActionType.
export function buildRuleDraftFromRequest(
  request: InterceptedResponse,
  options: {
    type: ActionType;
    includeQueryString: boolean;
    headerMatchers: QuickMockHeaderSelection[];
  },
): { ok: true; draft: RuleDraft } | { ok: false; error: QuickMockError };
```

**Lógica por type:**

- `mock`: igual ao atual `buildQuickMockDraft` — status, headers, body, statusPhrase, contentType vêm da response capturada. Body undefined é permitido (normal pra `204 No Content` etc.) — só não inclui o campo `body` no action.
- `breakpoint`: `{ type: 'breakpoint', enabled: true, description: '' }`.
- `transform`: `{ type: 'transform', enabled: true, mode: 'declarative', operations: [] }`.
- `delay`: `{ type: 'delay', enabled: true, timeMs: 1000 }`.

**Erros mantidos** (sem fallback silencioso):
- `capture_error` se `request.captureError`.
- `method_missing` se `!request.method`.
- `header_value_missing` se um header marcado tem valor vazio.

**Erro removido:** `body_unavailable` — está no enum `QuickMockErrorCode` atual mas nunca é emitido (dead code). Limpar o enum.

**Nome da regra:**
- Mock: `'Mock para <pattern>'`
- Breakpoint: `'Breakpoint para <pattern>'`
- Transform: `'Transform para <pattern>'`
- Delay: `'Latência para <pattern>'`

A função `buildQuickMockDraft` antiga é removida — todos os call sites passam pela nova.

### 4. `CommandCenter.tsx`

**URL params:**
- Remove `mockParam` e `quickMockTargetId`.
- Adiciona `createRuleParam = searchParams.get('createRule')` e `createRuleTypeParam = searchParams.get('type')`.
- Valida `type` contra `{'mock','breakpoint','transform','delay'}` — se inválido, limpa o param.

**Substituições:**
- `openQuickMockFor(requestId)` → `openCreateRuleFor(requestId, type: ActionType)` que seta `?createRule=<id>&type=<type>`.
- `closeQuickMock()` → `closeCreateRule()` (deleta os 2 params).
- `handleCreateMock` (linha 147) → `handleCreateRule(request, requestId, type)`.

**Render:**
Substitui o bloco `{quickMockTarget && quickMockTargetId && <QuickMockPanel ... />}` por:

```tsx
{createRuleTarget && createRuleTargetId && createRuleType && (
  <RuleEditor
    open
    mode="create"
    skipTypeStep
    initialDraft={draftFromRequest}
    headerMatcherSource={{
      requestHeaders: createRuleTarget.request?.headers ?? {},
      responseHeaders: createRuleTarget.response?.headers ?? createRuleTarget.headers,
    }}
    onOpenChange={(open) => { if (!open) closeCreateRule(); }}
    onSave={async (draft) => {
      const created = await addRule(draft.name, draft.matchers, draft.action);
      if (created) {
        setRecentRuleId(created.id);
        closeCreateRule();
        return true;
      }
      return false;
    }}
  />
)}
```

`draftFromRequest` é construído via `buildRuleDraftFromRequest(target, { type, includeQueryString: false, headerMatchers: [] })`. Se a função retornar `{ ok: false }`, o componente exibe o erro inline e oferece "Cancelar" — mesmo padrão do QuickMockPanel atual.

`addRule` precisa estar disponível pelo outlet context. Hoje, `useAppOutlet` expõe `rules` mas não `addRule`. Precisa estender `Layout.tsx` pra expor (importar `useRules().addRule` no outlet ou chamar diretamente em `CommandCenter` via `useRules()` — mais simples chamar direto em `CommandCenter`).

### 5. Cleanup

- Deletar `app/src/components/command-center/QuickMockPanel.tsx`.
- Atualizar testes:
  - `RequestInspector.test.tsx` linha 107: trocar `'botão "Criar Mock"'` para `'dropdown "Criar regra"'` com 4 casos (um por tipo) verificando que `onCreateRule` é chamado com o `actionType` correto.
  - `grep -rn "QuickMockPanel\|?mock=\|quickMockTarget\|openQuickMockFor" app/src` antes de fechar a issue — todos os matches devem estar nos arquivos deletados/atualizados acima.
- Remover entrada `QuickMockPanel` de imports/exports.

## Componentes/arquivos novos

1. `app/src/components/rules/HeaderMatcherSelector.tsx` — componente extraído do QuickMockPanel, recebe `headerMatcherSource` + matchers atuais e callbacks de mutação. Reutilizado pelo `RuleEditor` no passo Matcher.

## Componentes/arquivos modificados

1. `app/src/components/command-center/RequestInspector.tsx` — botão → dropdown.
2. `app/src/components/rules/RuleEditor.tsx` — props `skipTypeStep`, `initialDraft`, `headerMatcherSource`; `STEPS` condicional; render do `HeaderMatcherSelector`.
3. `app/src/pages/CommandCenter.tsx` — URL routing novo, render do `RuleEditor`.
4. `app/src/domain/quickMock.ts` → `buildRuleDraftFromRequest` (substitui `buildQuickMockDraft`).
5. `app/src/components/command-center/__tests__/RequestInspector.test.tsx` — atualizar.

## Componentes/arquivos deletados

1. `app/src/components/command-center/QuickMockPanel.tsx`.

## Tipos / Contratos

### `RequestInspectorProps` (atualizado)

```ts
interface RequestInspectorProps {
  request: InterceptedResponse | null;
  requestId: string | null;
  onCreateRule: (request: InterceptedResponse, requestId: string, actionType: ActionType) => void; // novo
  onOpenInRulesLab: (ruleId: string) => void;
  onClose: () => void;
  rules: Rule[];
}
```

### URL search params

| Param            | Valor                                      | Comportamento                                            |
|------------------|--------------------------------------------|----------------------------------------------------------|
| `edit`           | `<requestId>`                              | Abre `EditResponseSheet` para uma request pendente. **Igual hoje**. |
| `createRule`     | `<requestId>`                              | Abre `RuleEditor` (skipTypeStep) pré-preenchido.         |
| `type`           | `mock` \| `breakpoint` \| `transform` \| `delay` | Tipo da action a criar. Inválido → params limpos. |

`edit` continua tendo precedência sobre `createRule` (mesma regra de exclusividade mútua que existe entre `edit` e `mock`).

## Testes

### `RequestInspector.test.tsx`
- Caso atual de "Criar Mock" vira 4 casos: clicar em Mock/Breakpoint/Transform/Latência chama `onCreateRule` com o tipo correto.
- Botão fica desabilitado quando `request.captureError` (igual hoje).

### `CommandCenter.test.tsx` (se existir; criar se não)
- Smoke test: clicar em "Mock" no dropdown abre o `RuleEditor` em mode create, com `skipTypeStep`, e o initialDraft tem o action.type correto.
- URL: param `?createRule=<id>&type=mock` é setado e limpo no fechamento.

### `RuleEditor` (testes existentes em `__tests__/`)
- Adicionar caso: com `skipTypeStep=true`, a barra mostra apenas 3 passos e começa em "Matcher".
- Adicionar caso: com `headerMatcherSource`, a tabela aparece no passo Matcher; toggle adiciona/remove HeaderMatcher.
- Os testes existentes continuam passando (default do skipTypeStep é `false`).

### `domain/quickMock.test.ts`
- Renomear/atualizar testes existentes.
- Adicionar casos para `type: 'breakpoint' | 'transform' | 'delay'`.

## Plano de migração

Não há dados persistidos a migrar — o `QuickMockPanel` é UI transitória e o `?mock=<id>` só vive na URL atual. Usuários com a URL antiga aberta verão o param ser limpo (sem fallback silencioso) e a tela voltar para a timeline.

## Trabalho fora de escopo

- Mudar o `EditResponseSheet` (modal de aprovação de pendências) — continua igual.
- Adicionar templates pré-definidos na criação de regra a partir de uma request — fora de escopo. O usuário sempre começa com matcher pré-preenchido + action default do tipo.
- Permitir trocar o tipo da action depois que o wizard abriu via dropdown — fora de escopo. Se quiser outro tipo, fecha e abre de novo pelo dropdown.

## Beads

A criar:

- **Epic**: `Substituir botão "Criar Mock" por dropdown de criação de regras (4 tipos)`.
- **Filho 1** — Domain: `buildRuleDraftFromRequest` substitui `buildQuickMockDraft`, suporta 4 types.
- **Filho 2** — `RuleEditor`: props `skipTypeStep`, `initialDraft`, `headerMatcherSource`; novo componente `HeaderMatcherSelector`.
- **Filho 3** — `RequestInspector`: dropdown + prop `onCreateRule`. `CommandCenter`: URL routing novo + render do `RuleEditor`.
- **Filho 4** — Cleanup: deletar `QuickMockPanel`, atualizar testes (`RequestInspector.test`, novos casos no RuleEditor, atualizar `quickMock.test`).

Dependências: 2 e 3 dependem de 1; 4 depende de 2 e 3.
