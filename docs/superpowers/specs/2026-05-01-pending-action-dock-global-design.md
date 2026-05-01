# PendingActionDock global — design

**Data:** 2026-05-01
**Status:** aprovado em brainstorming
**Bead relacionada:** `chrome-extension-debug-buddy-9dt`

## Problema

Hoje o `PendingActionDock` é renderizado dentro de `app/src/pages/CommandCenter.tsx` e está acoplado a estado local desse componente: `selectedId` (do `useRequestSelection`), `filters`/`setFilters` (do `useAllRequests`), e os states locais `editSheetTargetId`/`quickMockTargetId` que abrem `EditResponseSheet` e `QuickMockPanel`. Como consequência, o Dock só aparece quando a rota ativa é `/command-center` — em `/rules-lab` o usuário não vê requests pendentes nem consegue agir sobre elas sem voltar para o Command Center.

A intenção é tornar o Dock um componente disponível em **todas** as rotas (atuais: `/command-center`, `/rules-lab`; e futuras), com comportamento consistente.

## Decisões de UX (validadas em brainstorming)

1. **Editar / Criar Mock fora do `/command-center`**: clicar nesses botões navega para `/command-center` com query param (`?edit=<id>` ou `?mock=<id>`). O CommandCenter hidrata o param e abre o sheet/panel correspondente. **Não** vamos migrar `EditResponseSheet`/`QuickMockPanel` para o Layout.
2. **Alvo do Dock**: estado global, sobrevive entre rotas. A "seleção pendente" (que hoje vive em `useRequestSelection` no CommandCenter) é promovida para o Layout, e a timeline do CommandCenter passa a consumir o mesmo estado.
3. **J / K (próximo / anterior)**: mexem no único `selectedId` global. Em `/command-center`, isso reflete também na timeline e no Inspector (comportamento atual preservado). Em `/rules-lab` ou outras rotas, atualiza o alvo do Dock e — se o usuário voltar ao Command Center — a seleção da timeline já está sincronizada.

## Abordagem técnica

**`useOutletContext` do react-router** (em vez de Context Provider novo ou store externo). Layout instancia os hooks compartilhados e os passa via `<Outlet context={...} />`. Rotas filhas consomem com `useOutletContext<AppOutletContext>()`.

Por quê:
- Idiomático em react-router; não introduz convenção nova no projeto (que hoje só usa Context da `sidebar` shadcn).
- Layout já é o "shell" do app; alinha responsabilidades naturalmente.
- Bonus arquitetural: hoje `Layout.tsx` (linha 27) e `CommandCenter.tsx` (linha 31) instanciam `useAllRequests` separadamente — consolidar no Layout elimina conexões duplicadas ao IndexedDB e listeners redundantes de `chrome.runtime`.

## Distribuição de responsabilidades

### `app/src/pages/Layout.tsx` — novo dono do estado global

Instancia (em ordem):
- `useDebugging()` — já tem
- `useAllRequests()` — já tem; passa a ser a única instância
- `useResponses()` — **novo aqui**
- `useRules()` — **novo aqui**
- `useRequestSelection(filteredRequests)` — **novo aqui**
- `useSessionMarker()` / `useNetworkMetrics()` — já tem

Deriva (com `useMemo`, mantendo a mesma fórmula que existe hoje em CommandCenter):
- `pendingIdsOrdered`, `pendingCount`, `dockTargetIndex`, `hasSelectedPending`, `nextPendingUrl`

Define callbacks (com `useCallback`):
- `approveNext`, `ignoreCurrent`, `editNext`, `createMockNext`, `handleIgnoreAll`, `navigateNext`, `navigatePrev`, `onViewPending`

Edit/CreateMock callbacks usam `navigate('/command-center?edit=<id>')` ou `?mock=<id>` (rota atual `'/command-center'` já é detectada implicitamente — react-router só atualiza search params, sem unmount).

`onViewPending` faz:
1. Adiciona o filtro `state:pending` via `setFilters` (que vive no Layout, então persiste mesmo sem estar em `/command-center`).
2. Se `location.pathname !== '/command-center'`, chama `navigate('/command-center')`.

Registra `usePendingHotkeys({...})` (movido de CommandCenter — A/I/J/K/Esc agora são globais de fato, não dependentes da rota ativa).

Renderiza `<PendingActionDock {...dockProps} />` direto no shell, fora do `<Outlet />`.

### `app/src/types/outletContext.ts` — novo arquivo

```ts
import type { Filter } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { useOutletContext } from 'react-router-dom';

export interface AppOutletContext {
	// Selection (compartilhada com Dock)
	selectedId: string | null;
	selected: InterceptedResponse | null;
	select: (id: string) => void;
	clear: () => void;

	// Histórico
	filteredRequests: Record<string, InterceptedResponse>;
	filters: Filter[];
	setFilters: (filters: Filter[]) => void;
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
	autoRefreshEnabled: boolean;
	clearAllRequests: () => Promise<void>;

	// Pendentes
	pendingResponses: Record<string, InterceptedResponse>;
	approveResponse: (id: string, mods: ResponseMods) => Promise<void>;
	approveResponseWithEdit: (id: string, mods: ResponseMods) => Promise<void>;
	ignoreResponse: (id: string) => Promise<void>;
	ignoreAllPending: () => Promise<{ succeeded: number; failed: Failure[] }>;

	// Rules
	rules: Rule[];
}

export const useAppOutlet = (): AppOutletContext => useOutletContext<AppOutletContext>();
```

(Tipos `ResponseMods`, `Failure`, `Filter` já existem nos arquivos correspondentes — apenas importar.)

### `app/src/pages/CommandCenter.tsx` — encolhe

Remove:
- Todas as 4 chamadas de hooks (`useAllRequests`, `useResponses`, `useRules`, `useRequestSelection`).
- A derivação de `pendingIdsOrdered`/`pendingCount`/etc.
- Os callbacks de Dock (`approveNext`, `editNext`, `createMockNext`, `handleIgnoreAll`, `navigateNext`, `navigatePrev`).
- A chamada de `usePendingHotkeys`.
- A renderização de `<PendingActionDock />`.

Mantém:
- `clearDialogOpen` (modal local).
- `recentRuleId` (UX local — id da regra recém-criada).
- `quickMockTargetId` / `editSheetTargetId` — agora **hidratados a partir de `?edit` / `?mock`** em vez de state puro (ver seção "Contrato de query params" abaixo).
- Renderização de `<EditResponseSheet />` e `<QuickMockPanel />`.
- Hidratação/sincronização de filtros via URL (já existente — nada muda).
- Layout split timeline + inspector.

Substitui as chamadas de hook por uma única:

```ts
const ctx = useAppOutlet();
const {
	selectedId, selected, select, clear,
	filteredRequests, filters, setFilters,
	pauseAutoRefresh, enableAutoRefresh, autoRefreshEnabled, clearAllRequests,
	pendingResponses, approveResponseWithEdit,
	rules,
} = ctx;
```

### `app/src/pages/RulesLab.tsx` e rotas futuras

Sem alteração. O Dock aparece automaticamente porque é renderizado pelo Layout, fora do `Outlet`.

## Contrato de query params (`?edit` / `?mock`)

CommandCenter, ao montar e quando `searchParams` mudam, sincroniza `editSheetTargetId` e `quickMockTargetId` com `?edit` e `?mock`:

- Se param presente e diferente do state local → atualizar o state local.
- Se sheet/panel fecha (`onOpenChange(false)`) → remover o param via `setSearchParams(next, { replace: true })`.
- Se id no URL não existe em `pendingResponses` (para `?edit`) ou em `filteredRequests`/`pendingResponses` (para `?mock`) → limpar o param. Sem fallback silencioso, conforme regra do projeto.
- `?edit` e `?mock` são **mutuamente exclusivos**: abrir um remove o outro.

Por que query params:
- Deep-link funciona após hard reload.
- Comportamento uniforme vindo de qualquer rota.
- Reaproveita o padrão que `?filter=` já estabelece em CommandCenter.

## Hotkeys

Sem mudança no `usePendingHotkeys` em si — só muda o local da chamada (Layout em vez de CommandCenter). O hook já filtra `INPUT/TEXTAREA/SELECT/contenteditable`, então não conflita com o RuleEditor (CodeMirror) em `/rules-lab`. `onEscape: clear` continua funcionando — `clear` é a mesma função, agora vinda do Layout.

## Testes

**Existentes que precisam ajuste**:
- `app/src/pages/__tests__/CommandCenter.test.tsx` — hoje renderiza `<CommandCenter />` diretamente. Precisa de um wrapper que monte `<Layout><Outlet /></Layout>` via `MemoryRouter` para fornecer o outlet context. Criar helper `renderWithLayout(initialRoute: string)` em `app/src/test/renderWithLayout.tsx`.
- `app/src/components/command-center/__tests__/PendingActionDock.*` (se houver) — sem mudança; é apresentacional puro.

**Novos**:
- `app/src/pages/__tests__/Layout.dock.test.tsx`:
  - Dock renderiza em `/rules-lab` quando há `pendingCount > 0`.
  - Clicar "Editar" partindo de `/rules-lab` → URL vira `/command-center?edit=<id>` e o `EditResponseSheet` abre.
  - Clicar "Criar Mock" partindo de `/rules-lab` → URL vira `/command-center?mock=<id>` e o `QuickMockPanel` abre.
  - Clicar "Ver pausadas" partindo de `/rules-lab` → navega e aplica filtro `state:pending`.
  - Hotkey `A` aprova a pendente partindo de `/rules-lab`.
  - Hotkey `J` em `/rules-lab` muda `selectedId`; voltando para `/command-center`, a timeline reflete a nova seleção.

## Não-objetivos

- **Não** vamos mover `EditResponseSheet`/`QuickMockPanel` para o Layout (decisão P1).
- **Não** vamos mudar o comportamento dentro do CommandCenter (tudo que funciona hoje continua funcionando idêntico).
- **Não** vamos introduzir Context Provider novo nem store externo (decisão de Abordagem 2).
- **Não** vamos refatorar a hidratação de `?filter=` (já funciona, fora do escopo).

## Riscos e cuidados

- **Loop de sincronização URL ↔ state** em `?edit` / `?mock`: o useEffect que sincroniza precisa comparar antes de chamar `setSearchParams`, mesma técnica já usada em filtros (`filtersEqualUrl`).
- **Re-render desnecessário** ao consolidar hooks no Layout: passar callbacks/objetos via context dispara re-render em todas as rotas filhas. Mitigar com `useMemo`/`useCallback` para o objeto context.
- **Mudança de instância de hooks**: ao remover a segunda chamada de `useAllRequests` no CommandCenter, garantir que nada externo a essa página dependa de uma instância separada (já verificado: `useAllRequests` é stateless do ponto de vista de side-effects além de IDB/listener — funciona com instância única).

## Arquivos afetados (alto nível)

| Arquivo | Tipo | Mudança |
|---|---|---|
| `app/src/pages/Layout.tsx` | edit | Vira dono do estado global; instancia hooks; renderiza Dock; registra hotkeys; expõe outlet context |
| `app/src/pages/CommandCenter.tsx` | edit | Encolhe; consome `useAppOutlet`; hidrata `?edit`/`?mock` |
| `app/src/types/outletContext.ts` | new | Interface `AppOutletContext` + helper `useAppOutlet` |
| `app/src/components/command-center/PendingActionDock.tsx` | nenhuma | Sem mudança — props já estão certas |
| `app/src/components/command-center/usePendingHotkeys.ts` | nenhuma | Sem mudança |
| `app/src/test/renderWithLayout.tsx` | new | Helper de teste para wrapper Layout+Router |
| `app/src/pages/__tests__/CommandCenter.test.tsx` | edit | Usa `renderWithLayout` |
| `app/src/pages/__tests__/Layout.dock.test.tsx` | new | Cobre comportamento global do Dock |

O detalhamento dos passos de implementação (ordem, dependências, comandos de verificação) será desenvolvido no plano de implementação.
