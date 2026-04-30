# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **URL ↔ React state sync sem loop**: usar `useRef(false)` como flag de hidratação. Effect 1 (sem deps) lê URL → seta state e marca a flag. Effect 2 (deps em state) só roda após hidratação, compara serialized atual com URL antes de chamar `setSearchParams(next, { replace: true })` para evitar re-render redundante. Helper `filtersEqualUrl(desired, current)` em `app/src/lib/filterUrl.ts`.
- **Mocks de hooks com estado real em testes**: para hooks que precisam refletir mudanças no teste (ex.: `setFilters` propagando para a UI), usar `vi.mock(path, () => ({ useFoo: () => { const [x, setX] = React.useState(...); return {...} } }))` em vez de retornar objetos estáticos. Permite testar fluxos completos `URL → setState → re-render → assert`.
- **Testar páginas pesadas com sub-componentes mockados**: stub `RequestTimeline` (e similares) com um componente que apenas expõe os props relevantes via `data-testid` e botões de ação — evita renderizar Radix popovers / DataTable em jsdom mas mantém o teste de integração da página.
- **Validar enums no parser, não no avaliador**: para filtros com valores de enum (ex.: `state:` → RequestState), validar a lista canônica em `parseFilterToken` e descartar tokens inválidos. Comparar `state === (value as Enum)` no avaliador parece "explícito" mas é silently-incorrect: um valor desconhecido nunca casa, o que filtra tudo da tabela e esconde o bug. Validar no parser é o ponto certo (consistente com a regra "no fallbacks") e mantém o avaliador simples.
- **Ações internas que aplicam filtros chamam `setFilters` direto, não navegam via redirect**: rotas legadas tipo `<Navigate to="/command-center?filter=state:pending" replace />` só funcionam para entry-points externos (bookmark/sidebar/outra tela) porque dependem de o `Command Center` montar do zero para o Effect 1 (URL → filters) hidratar. Se a ação parte de dentro do próprio `/command-center` (banner, botão na tabela), o react-router pode pular o remount e o Effect 2 (filters → URL) acaba apagando o filtro porque o estado do hook ainda está vazio. Em ações internas, mutar o state diretamente.
- **`vi.hoisted` para mocks de módulo parametrizáveis por teste**: quando o mesmo arquivo de teste precisa que um hook mockado retorne valores diferentes em cenários distintos (ex.: `pendingResponses: {}` em uns testes e `{ r1: ... }` em outros), declarar um stub mutável com `const responseStubs = vi.hoisted(() => ({ pendingResponses: {}, ... }))` e referenciá-lo no `vi.mock(...)` factory. Como `vi.mock` e `vi.hoisted` são ambos içados para o topo, o factory consegue ler a referência. Cada teste reseta `responseStubs.x = ...` em `beforeEach` e o próximo render do hook lê o novo valor. Mais limpo do que abandonar o mock estático e re-mockar via `vi.doMock` por teste.
- **Mock de hook stateful quando o teste observa transição (não só chamada)**: quando o cenário precisa verificar que uma ação de hook *altera* o estado retornado (ex.: clicar em "Ignorar todos" → `pendingResponses` esvazia → componente condicional desmonta), o mock factory pode usar `React.useState(() => responseStubs.x)` como inicializador e expor um wrapper que chama o vi.fn rastreável E faz `setState({})` localmente. Combina o melhor dos dois mundos: as assertions `toHaveBeenCalled` continuam funcionando contra o vi.fn original, e o React vê uma mudança real de state que dispara re-render. Alternativa pior é fazer rerender manual passando novo valor de stub.
- **Validação de header com chave vazia**: `rowsToHeaders` historicamente fazia `if (!trimmedName) continue` (skip silencioso) — mas quando o usuário digita um valor sem nome de header, o silêncio viola a regra "no fallbacks" porque o request final sai sem o header que o usuário queria. A solução é: linhas inteiramente vazias (chave + valor) continuam descartáveis (UX: usuário clicou "Adicionar header" e desistiu), mas linha com `value` preenchido e `name` vazio é erro inline (dicionário `headerErrors[rowId]`) que bloqueia submit, com mensagem agregada no toast existente. O `setHeaderErrors({})` em `updateRow`/`removeRow` limpa o erro à medida que o usuário corrige, sem precisar revalidar tudo.

---

## 2026-04-30 - US-001 (Suporte a filtros via query string no Command Center)

- **What was implemented:**
  - Novo módulo `app/src/lib/filterUrl.ts` com parser/serializador estável (`?filter=field:value` ou `?filter=field:operator:value`, repetido). Defaults por campo documentados no topo (state/method/type/mime/status/duration → `is`; url/free → `contains`; timestamp → `gte`).
  - `app/src/pages/CommandCenter.tsx` agora hidrata os filtros do FilterBar a partir de `useSearchParams()` na primeira render e espelha mudanças do FilterBar de volta para a URL via `setSearchParams(..., { replace: true })`. Usa `useRef` como guarda de hidratação + `filtersEqualUrl` para evitar re-render em loop.
  - Limpar todos os chips remove o parâmetro `filter` da URL (`URLSearchParams.delete('filter')` antes de re-anexar — quando não há nada a anexar, o parâmetro some).
  - Novo arquivo de testes `app/src/pages/__tests__/CommandCenter.test.tsx` cobrindo: leitura inicial da URL (`?filter=state:pending`), escrita ao adicionar chip, escrita ao remover chip + clear all.
- **Files changed:**
  - `app/src/lib/filterUrl.ts` (novo)
  - `app/src/pages/CommandCenter.tsx` (sync URL ↔ filters)
  - `app/src/pages/__tests__/CommandCenter.test.tsx` (novo)
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (694 passes), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - `useSearchParams` do react-router 6 é estável o suficiente para ser usado como segunda fonte de verdade (espelho), desde que se use a flag de hidratação para evitar loops e a guarda de igualdade antes do `setSearchParams`. Tentar derivar o state direto da URL (sem hook intermediário) seria mais elegante, mas `useAllRequests` já encapsula `filters` e refazer essa API não fazia parte do escopo.
  - O parser tem que ser tolerante: split apenas no primeiro `:` para identificar o campo, depois testar o segundo token contra a lista fechada de operadores; valores tipo `https://api.example.com/...` funcionam naturalmente porque `https` não é um operador válido.
  - `vi.mock('@/hooks/useAllRequests', () => ({ useAllRequests: () => { const [filters, setFilters] = React.useState([]); ... } }))` foi a chave para o teste de integração — sem isso o `setFilters` mockado teria que ser stateful manualmente via `mockImplementation` e seria muito mais ruidoso.
---


## 2026-04-30 - US-002 (Filtro state:pending no FilterBar)

- **What was implemented:**
  - Já existia desde a entrega anterior: sugestão "Apenas pendentes" no popover (`filterSuggestions.ts:148-154`), parsing em `parseFilterToken`, render do chip removível com badge `warning` (`FilterChip.tsx:18,46`), e avaliação em `matchesFilter` via `getRequestState(request) === 'pending'` (que checa `isWaiting === true`). Esta US fechou os pontos faltantes:
  - **Validação explícita de valores de `state:*`** em `app/src/lib/filterUrl.ts`: novo guard `isValidStateValue` + check no `parseFilterToken` que descarta tokens com valor fora de `pending|mocked|modified|failed|proxy`. Sem isso, `?filter=state:foo` viraria um chip ativo que, por nunca casar com nenhum estado real, silenciosamente filtraria todas as linhas da tabela — comportamento que viola a regra "no fallbacks".
  - **Novo arquivo de testes** `app/src/lib/__tests__/filterUrl.test.ts` cobrindo: parsing de `state:pending` (e demais estados válidos), descarte de `state:foo`/`state:`/`state:PENDING` (case-sensitive), `parseFiltersFromUrl` filtrando inválidos no meio da lista, round-trip serialize↔parse, `filtersEqualUrl`.
  - **Teste adicional em `filterMatching.test.ts`** validando o fluxo completo da AC: `state:pending` aplicado a uma coleção lista apenas requests com `isWaiting === true`; lista vazia mantém todas.
- **Files changed:**
  - `app/src/lib/filterUrl.ts` — adicionado `VALID_STATE_VALUES`, `isValidStateValue`, e check no `parseFilterToken`.
  - `app/src/lib/__tests__/filterUrl.test.ts` (novo) — 8 testes.
  - `app/src/lib/__tests__/filterMatching.test.ts` — adicionado teste de coleção para state:pending.
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (705 passes — 11 a mais que a baseline da US-001), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - O FilterBar/FilterChip/filterMatching já estavam preparados para `state:pending` desde antes da feature/interception — a lacuna real era a validação de entrada vinda da URL. Isso reforça o padrão "validar no parser, não no avaliador" registrado no topo.
  - `getRequestState` é a fonte de verdade para o filtro `state:` (`isWaiting === true → 'pending'`). Mudar a semântica do filtro `state:pending` é só mexer em `getRequestState`, nada de espalhar `isWaiting === true` por outros pontos.
---


## 2026-04-30 - US-003 (Remoção da rota /pending e do item de menu Pausadas)

- **What was implemented:**
  - `app/src/pages/PendingResponses.tsx` e o teste correspondente `app/src/pages/__tests__/PendingResponses.test.tsx` foram removidos.
  - `app/src/routes.tsx`: rota `/pending` substituída por `<Navigate to="/command-center?filter=state:pending" replace />`, com comentário curto marcando-a como rota legada para preservar bookmarks antigos. Import lazy de `PendingResponses` foi removido.
  - `app/src/components/layout/AppSidebar.tsx`: item "Pausadas" removido do `navItems`. A prop `pendingResponsesCount` (e `mocksCount`, que já estava marcada como obsoleta) saiu da assinatura, e o type alias passou a estender direto `Sidebar`. Ícone `hourglass` continua importado pelo lucide-icon registry porque é reutilizado em RequestInspector/PendingAlertBanner/NetworkMetricsBar/requestState.
  - `app/src/pages/Layout.tsx`: removido `useResponses()` (que só servia para alimentar o contador da sidebar) e a passagem de `pendingResponsesCount` para `<AppSidebar />`.
  - `app/src/components/__tests__/AppSidebar.test.tsx`: testes ajustados para não depender mais de `pendingResponsesCount` nem do label "Pausadas". Novo teste "expõe somente Command Center e Rules Lab no menu" cobre a regressão (2 nav-items, sem contador, sem texto "Pausadas").
  - `app/src/pages/CommandCenter.tsx`: `onViewPending` no `PendingAlertBanner` agora aplica diretamente `setFilters([{state:is:pending}])` em vez de `navigate('/pending')`. Ver Learnings — depender do redirect a partir de uma tela já montada não força remount confiável e o Effect 2 da página (filters→URL) zeraria o filtro recém-aplicado.
  - `app/src/components/command-center/PendingResponseActions.tsx`: docstring atualizada para não referenciar mais "tabela de /pending".
- **Files changed:**
  - Removidos: `app/src/pages/PendingResponses.tsx`, `app/src/pages/__tests__/PendingResponses.test.tsx`.
  - Editados: `app/src/routes.tsx`, `app/src/components/layout/AppSidebar.tsx`, `app/src/pages/Layout.tsx`, `app/src/pages/CommandCenter.tsx`, `app/src/components/command-center/PendingResponseActions.tsx`, `app/src/components/__tests__/AppSidebar.test.tsx`.
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (692 passes — 13 a menos por causa da remoção do test file e da consolidação dos testes do AppSidebar), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - Botão de "Ver pausadas" dentro do próprio `/command-center` não pode contar com o redirect `/pending → /command-center?filter=state:pending` para aplicar o filtro: como o usuário já está em `/command-center`, o react-router pode evitar o remount completo, e o Effect 2 (filters → URL) compara o estado atual do hook (vazio) com a URL (state:pending) e _apaga_ o filtro recém-aplicado. A solução robusta é setar `setFilters([...])` diretamente quando a ação parte da própria tela; o redirect continua útil para bookmarks externos / sidebar em outras superfícies, onde a tela monta do zero e o Effect 1 (URL → filters) hidrata.
  - Quando se remove uma rota/menu, vale procurar não só o `import` órfão (AC pede isso explicitamente) mas também dos consumidores indiretos: `AppSidebar` recebia `pendingResponsesCount` que só existia para alimentar o item "Pausadas"; `Layout` chamava `useResponses()` só pra calcular esse contador. Limpando os dois, eliminamos uma assinatura de prop e uma chamada de hook que ficariam mortas.
---


## 2026-04-30 - US-004 (Fusão de PendingAlertBanner em PendingActionDock)

- **What was implemented:**
  - `PendingActionDock` agora é a única superfície de ação para pausadas. A assinatura ganhou `nextPendingUrl: string | null`, `onApproveNext`, `onIgnoreAll`, `onViewPending` (callbacks já existiam no CommandCenter, mas eram passados para o banner). Layout do Dock: header com ícone hourglass + contador `N pausadas` + posição (`i / N` ou `próximo de N`); linha secundária com URL truncada (e `title=` para tooltip nativo); botão primário "Aprovar próximo" (full-width); par "Ver pausadas" / "Ignorar todos" em `grid-cols-2`; e a régua compacta de atalhos A/I/J/K já existente. Continuou retornando `null` quando `pendingCount === 0`.
  - `app/src/pages/CommandCenter.tsx`: removido o import e a renderização do `PendingAlertBanner`. O `useMemo` que já calculava `pendingIdsOrdered`/`pendingCount`/`hasSelectedPending` ganhou `nextPendingUrl` (URL do request que `approveNext`/`ignoreCurrent` tem como alvo — selecionado se houver, senão o primeiro da fila). Os três callbacks (`approveNext`, `ignoreAll`, `onViewPending` que aplica `setFilters([state:is:pending])`) passaram a ir para o Dock.
  - Removidos: `app/src/components/command-center/PendingAlertBanner.tsx` e `app/src/components/command-center/__tests__/PendingAlertBanner.test.tsx`.
  - Novo `app/src/components/command-center/__tests__/PendingActionDock.test.tsx` (10 testes): render nulo quando `pendingCount === 0`; contador singular/plural; URL truncada com `title`; presença das 3 ações (Aprovar próximo, Ver pausadas, Ignorar todos); presença das 4 teclas A/I/J/K; cliques disparam o callback correto; label primário troca para "Aprovar" quando há pausada selecionada; posição `i / N` quando selecionada.
  - `app/src/pages/__tests__/CommandCenter.test.tsx` adaptado: o factory do `vi.mock('@/hooks/useResponses')` agora lê de uma referência mutável criada via `vi.hoisted`, permitindo que cada teste defina `responseStubs.pendingResponses = { ... }` antes do render. Removidos os mocks de `PendingAlertBanner` e `PendingActionDock` (o Dock real é renderizado; com `pendingResponses: {}` ele retorna `null` então os testes existentes continuam passando). Adicionados 3 novos testes integrando Dock real + ciclo URL: Dock não monta sem pausadas, Dock mostra contador/URL/ações com pausadas, clique em "Ver pausadas" muda a URL para `?filter=state:pending`.
- **Files changed:**
  - Removidos: `app/src/components/command-center/PendingAlertBanner.tsx`, `app/src/components/command-center/__tests__/PendingAlertBanner.test.tsx`.
  - Editados: `app/src/components/command-center/PendingActionDock.tsx`, `app/src/pages/CommandCenter.tsx`, `app/src/pages/__tests__/CommandCenter.test.tsx`.
  - Novo: `app/src/components/command-center/__tests__/PendingActionDock.test.tsx`.
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (697 passes — 5 a mais que a baseline da US-003: 10 novos no Dock - 8 removidos do banner + 3 novos no CommandCenter), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - O Dock unificado caiu naturalmente em três blocos verticais: header (contador + posição), linha de contexto (URL truncada), ações (primária full-width + secundárias 2-col), atalhos (4-col compacto). Manter a primária (`Aprovar próximo`) em uma linha própria evita que ela compita visualmente com `Ver pausadas` / `Ignorar todos`.
  - O cálculo de `nextPendingUrl` precisa replicar exatamente a resolução de `approveNext`/`ignoreCurrent` (selecionado se houver, senão primeiro da fila ordenada). Caso contrário, a URL exibida no Dock pode não corresponder ao que o botão "Aprovar próximo" realmente vai aprovar — bug sutil mas confuso para o usuário.
  - Mocks com `vi.hoisted` (ver pattern no topo) tornaram trivial cobrir o cenário de URL update vindo do Dock real, sem precisar duplicar o setup do CommandCenter num arquivo de teste separado.
---


## 2026-04-30 - US-006 (Renomear "Aprovar e editar..." para "Editar...")

- **What was implemented:**
  - `app/src/components/command-center/PendingResponseActions.tsx`: o item do dropdown passou de `<span>Aprovar e editar…</span>` para `<span>Editar…</span>`. Como o `DropdownMenuItem` deriva o accessible name do conteúdo de texto (não há `aria-label` explícito), atualizar a `<span>` é o suficiente para também atualizar o nome acessível. O `data-testid="pending-actions-edit"` foi mantido para não quebrar consumidores e refletir que a ação continua sendo "abrir o editor".
  - Docstring do componente também atualizada (linha 45) para listar a variação como "Editar..." em vez de "Aprovar e editar...".
  - `app/src/components/command-center/__tests__/PendingResponseActions.test.tsx`: o nome do teste antigo `'item "Aprovar e editar" abre o EditResponseDialog'` virou `'item "Editar" abre o EditResponseDialog'`. O `getByTestId('pending-actions-edit')` continua o mesmo.
- **Files changed:**
  - `app/src/components/command-center/PendingResponseActions.tsx`
  - `app/src/components/command-center/__tests__/PendingResponseActions.test.tsx`
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (699 passes — mesma baseline da US-005, sem testes adicionados ou removidos), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - Para uma string visível dentro de um `DropdownMenuItem` shadcn, o accessible name do item vem do texto filho — não precisa propagar `aria-label` separado. A AC pediu para revisar `aria-label`, mas como nenhum item de PendingResponseActions usa `aria-label` (só o trigger "Mais ações", que é genérico e independente do label do item), a única superfície a alterar é o conteúdo `<span>`.
  - Procurar antes por todos os pontos da string canônica ("Aprovar e editar", "approve-and-edit", "approveAndEdit") evita renomear só metade — mesmo que o resultado aqui só tenha 2 lugares em código + 1 nome de teste, o hábito de varrer também variantes em inglês/camelCase mantém o trabalho consistente quando o componente já tem internacionalização parcial.
---


## 2026-04-30 - US-005 (Ação "Ignorar todos" sem confirmação)

- **What was implemented:**
  - **Decisão de design**: iterar no front (`useResponses` chama `ignoreResponse(id)` para cada pendente em sequência) em vez de criar uma nova action `ignoreAllPending` no background. Razão documentada no comentário do método: o protocolo de mensagens permanece simples (uma única action `approveResponse` sem `modifications`), o tratamento de erro existente em `ignoreResponse` (console.error + alert) continua valendo por request, e o broadcast `requestUpdated` que o background já emite após cada `Fetch.continueRequest` sincroniza o estado da UI em tempo real. Sem novo handler no background, sem alteração em `app/src/types/messages.ts`.
  - `app/src/hooks/useResponses.ts`: novo método `ignoreAllPending()` exposto, snapshot de `Object.keys(pendingResponses)` + `await ignoreResponse(id)` sequencial, retornando `Promise<void>`.
  - `app/src/pages/CommandCenter.tsx`: removido o iterador local `ignoreAll` (era duplicação do que agora vive no hook); `PendingActionDock.onIgnoreAll` passou a apontar direto para `ignoreAllPending` vindo do hook. Não havia AlertDialog intermediário no caminho do botão "Ignorar todos" — só o `<AlertDialog>` do `clearAllRequests` continua existindo, sem relação com pendentes.
  - `app/src/pages/__tests__/CommandCenter.test.tsx`:
    - O mock de `useResponses` virou stateful (usa `React.useState`) para que o `ignoreAllPending` mockado realmente esvazie o `pendingResponses` retornado pelo hook entre renders. Sem isso, o React não desmontaria o Dock após o clique. Mantém o vi.fn (`responseStubs.ignoreAllPending`) para assertions de chamada.
    - Dois testes novos cobrindo a AC: (1) clique em "Ignorar todos" chama `ignoreAllPending` exatamente uma vez e nenhum `[role=alertdialog]` aparece (sem confirmação intermediária); (2) após o clique, `pending-action-dock` desmonta (via `waitFor` + `queryByTestId === null`).
- **Files changed:**
  - `app/src/hooks/useResponses.ts` — adicionado `ignoreAllPending`, exposto no retorno.
  - `app/src/pages/CommandCenter.tsx` — `ignoreAll` local removido, prop do Dock aponta para o método do hook.
  - `app/src/pages/__tests__/CommandCenter.test.tsx` — mock stateful, stub `ignoreAllPending` no `vi.hoisted`, +2 testes.
- **Quality gates:** `npm run lint`, `npm run build`, `npm test` (699 passes — 2 a mais que a baseline da US-004), `npx tsc --noEmit` — todos verdes.
- **Learnings:**
  - "Ignorar todos" como simples iterador no hook é a opção certa quando o background já tem o evento de eco (`requestUpdated`/`isWaiting:false`) que mantém a UI sincronizada — uma action dedicada `ignoreAllPending` no protocolo seria peso morto e diluiria o ponto de entrada (todo "ignore" deve passar pelo mesmo caminho `approveResponse` sem modifications, que já tem console.error correto).
  - Mocks de hooks com `useState` interno são úteis quando o teste precisa observar transição de estado (não só chamadas de método). O custo é baixo (poucas linhas) e elimina a alternativa pior de fazer rerender manual com novo valor de stub.
  - O comentário no método `ignoreAllPending` explica a *decisão* (iterar no front vs nova action), não o *código* — esse é o tipo de comentário que fica útil quando alguém revisitar o ponto pensando em "deveria ter virado uma ação atômica?".
---


## 2026-04-30 - US-007 (EditResponseSheet substitui EditResponseDialog)

- **What was implemented:**
  - Novo `app/src/components/command-center/EditResponseSheet.tsx`: Sheet do shadcn-ui (`side="right"`, `sm:max-w-2xl`) com layout vertical em três regiões (`SheetHeader` com borda inferior + `ScrollArea` com formulário + `SheetFooter` com borda superior). Header inclui um bloco `data-testid="edit-response-context"` em modo somente-leitura mostrando Method (badge mono em `bg-primary/10`) + URL (text mono truncado com `title=` para tooltip nativo do navegador) — atende a AC "request original visível para contextualizar". Body com Status code (input numérico, validação inline 100–599), Response headers (editor chave/valor com botão "Adicionar header"/"Remover header") e Response body (Textarea mono).
  - Validação de header com chave vazia agora bloqueia submit (`headerErrors` por linha, mensagem inline + toast de erro agregado). Linha 100% vazia continua descartável (consistente com fluxo de "adicionar header" e desistir). Status code fora de [100,599] também bloqueia submit como antes.
  - Botão primário renomeado de "Aprovar com edição" → "Aplicar e continuar" (texto mostrado quando não está submitting; troca para "Aplicando…" durante a chamada). Ambos botões (Cancelar/Aplicar) ficam `disabled` enquanto `submitting` para evitar double-submit / fechamento prematuro.
  - `app/src/components/command-center/PendingResponseActions.tsx`: import trocado para `EditResponseSheet`, state local renomeado `editDialogOpen` → `editSheetOpen` (e propagado para `useHotkeys.enabled`), comentário do useHotkeys atualizado para "sheet aberto".
  - Comentários cross-arquivo que referenciavam `EditResponseDialog` por nome (`types/intercepted.ts`, `hooks/useResponses.ts`, `entrypoints/background.ts:519` e `:638`) atualizados para `EditResponseSheet` — mantém os pointers internos coerentes.
  - Removidos: `EditResponseDialog.tsx` e `__tests__/EditResponseDialog.test.tsx`.
  - Novo arquivo de testes `__tests__/EditResponseSheet.test.tsx` (10 testes): render do contexto Method+URL como read-only, pré-preenchimento, submit feliz com payload `{status, headers, body}`, erro inline quando `onSubmit` retorna `success:false`, exception path, validação de status 50, validação de header com chave vazia (bloqueia submit + erro inline), Cancelar (não dispara submit), botões disabled durante submit pendente, warning de Content-Length, remoção de header.
  - Testes existentes em `PendingResponseActions.test.tsx` ajustados: `edit-response-dialog` testid → `edit-response-sheet` (replace_all) e nomes dos testes que mencionavam "EditResponseDialog" trocados para "EditResponseSheet".
- **Files changed:**
  - Novos: `app/src/components/command-center/EditResponseSheet.tsx`, `app/src/components/command-center/__tests__/EditResponseSheet.test.tsx`.
  - Editados: `app/src/components/command-center/PendingResponseActions.tsx`, `app/src/components/command-center/__tests__/PendingResponseActions.test.tsx`, `app/src/types/intercepted.ts`, `app/src/hooks/useResponses.ts`, `app/src/entrypoints/background.ts`.
  - Removidos: `app/src/components/command-center/EditResponseDialog.tsx`, `app/src/components/command-center/__tests__/EditResponseDialog.test.tsx`.
- **Quality gates:** `npm run lint` ✅, `npm run build` ✅, `npm test` ✅ (702 passes — 3 a mais que a baseline da US-006: novos testes do Sheet (10) menos os testes do Dialog removidos (8) + ajuste +1), `npx tsc --noEmit` ✅.
- **Learnings:**
  - Sheet do shadcn-ui já está vendado em `app/src/components/ui/sheet.tsx` (Radix Dialog reutilizado com `cva` para definir `side`). Com `flex flex-col gap-0 p-0` no `SheetContent` e `border-b/border-t` em `SheetHeader`/`SheetFooter`, o conteúdo do meio (`ScrollArea` com `min-h-0 flex-1`) fica scrollável de forma natural — exatamente o que o ResponseDialog/Body grande precisa quando o Sheet ocupa toda a altura da tela.
  - Para um bloco visual de contexto read-only dentro do header, `data-testid="edit-response-context"` (e sub-testids `-method`/`-url`) é mais robusto do que tentar achar texto cru via `getByText` — em testes com snapshots de URL longa, o `break-all` do CSS pode dividir a string em múltiplos nós DOM e quebrar `getByText`. Sub-testids também tornam trivial asserir "não há input editável aqui dentro" (`querySelectorAll('input,textarea').length === 0`).
  - O comentário "header com valor preenchido + chave vazia é erro" precisa estar no parser/avaliador (handleSubmit) e não só na UI — é a mesma lógica do "validar enums no parser, não no avaliador" registrado no topo. Bloquear submit + dar erro inline é a tradução natural da regra "no fallbacks" para esse fluxo.
---


## 2026-04-30 - US-008 (Limpeza de hotkeys e mensagens órfãs)

- **What was implemented:**
  - Auditoria de toda a base buscando referências órfãs ao banner removido e à rota `/pending`. Resultado:
    - `usePendingHotkeys` está registrado **somente** em `app/src/pages/CommandCenter.tsx:150` — exatamente onde `PendingActionDock` é montado (linha 213). Ambos compartilham o mesmo gate (`pendingCount > 0` → `enabled`/`return null`), então o hook nunca fica ativo enquanto o Dock não está visível. AC ok.
    - `git grep PendingAlertBanner` em `app/src/` retorna **0 ocorrências** (apenas `tasks/prd*.md`, que são docs históricos descrevendo a remoção).
    - `git grep /pending` em `app/src/` retorna **1 ocorrência**: o comentário do redirect legado em `routes.tsx:16`. A rota é `path: 'pending'` com `Navigate to="/command-center?filter=state:pending"` — comportamento intencional para preservar bookmarks.
    - `git grep Pausadas` (capitalizado) em `app/src/` retorna 3 ocorrências, todas em `__tests__/AppSidebar.test.tsx` (testes de regressão garantindo que o item de menu continua removido). `pausadas` (minúsculo) aparece em testes do Dock/CommandCenter, no label "Ver pausadas" do próprio Dock, e em strings/comentários sobre regras pausadas (RulesLab — conceito independente, sobre regras desativadas, não sobre requests).
    - `app/src/types/messages.ts`: cada uma das 21 actions na união foi cross-checada com `git grep` — todas têm uso ativo (3+ arquivos cada). O único item adicionado durante a entrega anterior do banner foi `approveResponseWithEdit`, que continua sendo o caminho do EditResponseSheet/Inspector. Nada deprecated para remover.
  - Achado adicional não pedido pela AC mas dentro do espírito da US: CSS órfão remanescente em `app/src/styles/globals.css`. O bloco `pending-banner-sweep` (animation + keyframes + classe) era usado pelo `PendingAlertBanner` removido e nunca foi adotado em outro lugar (`grep` confirma 3 hits, todos no próprio CSS). Removidos: o `@keyframes pending-banner-sweep`, o seletor `.pending-banner-sweep`, e o comentário-cabeçalho que descrevia o efeito do banner. Atualizado o comentário do `.kbd` (linha 237 → "usada no PendingActionDock", removendo o "e no banner").
- **Files changed:**
  - `app/src/styles/globals.css` — removido o keyframe + classe `pending-banner-sweep` órfãos e o comentário órfão; atualizado comentário do `.kbd`.
- **Quality gates:** `npm run lint` ✅ (152 arquivos checados, sem fixes), `npm run build` ✅, `npm test` ✅ (702 passes — mesma baseline da US-007), `npx tsc --noEmit` ✅.
- **Learnings:**
  - Quando se remove um componente que tinha CSS dedicado (`PendingAlertBanner` → `.pending-banner-sweep`), o CSS órfão não dispara nenhum erro de build/lint do Biome porque ele não analisa CSS — fica residual silencioso. A varredura final de uma feature de remoção precisa incluir um `grep` pelas classes/keyframes do componente removido, não só pelo nome do arquivo/símbolo.
  - A AC pedia para verificar `usePendingHotkeys` "registrado apenas onde PendingActionDock é renderizado". Importante notar que `usePendingHotkeys` é só importado/registrado em CommandCenter, mas o Dock também só é montado em CommandCenter — então a condição é trivialmente satisfeita. O risco hipotético seria registrar o hook em `Layout` (global) e o Dock em `CommandCenter` (local), criando hotkeys ativas em rotas onde o Dock não está visível. A organização atual evita esse problema sem precisar de assertion explícita.
---
