# PRD: Inspeção e Edição de Responses Interceptadas (Modo Breakpoint)

## Overview
Quando o Debug Buddy está em modo breakpoint, requests são pausadas no estágio `Response` (via `Fetch.requestPaused`) e aguardam decisão do usuário. Hoje a experiência tem três problemas:

1. **Falta visão consolidada das pausadas** — o banner (`PendingAlertBanner`) só oferece "Ignorar todos" e "Aprovar próximo"; não há uma view dedicada para enxergar e operar todas as responses pausadas em formato de tabela.
2. **Falta a ação "Editar Response"** — atualmente o usuário só pode `Aprovar` (continuar como veio) ou `Criar Mock` (gera regra reutilizável). Não existe um caminho rápido para editar **uma única vez** a Response interceptada (status code, headers, body) e devolvê-la modificada via `Fetch.fulfillRequest` sem criar mock persistente.
3. **Hierarquia visual confusa no `RequestInspector`** — os botões `Criar Mock`, `Aprovar` e `Ignorar` competem visualmente (Criar Mock e Aprovar usam a mesma cor cheia), dificultando identificar a ação principal.

Este épico entrega: (a) view dedicada `/pending` com tabela de responses pausadas, (b) ação de **edição one-shot da Response** antes de aprovar, e (c) redesign das ações do inspetor como **split button** com hierarquia clara.

## Goals
- Reduzir cliques para tomar decisão sobre múltiplas responses pausadas (view dedicada com ações inline).
- Permitir manipulação ad-hoc de status, headers e body da Response sem precisar criar uma regra de mock persistente.
- Estabelecer hierarquia visual inequívoca para a ação principal (Aprovar) vs. variações (Aprovar e editar, Criar Mock) vs. ação destrutiva (Ignorar).
- Manter o contrato "Background é o writer" intacto — toda mutação de Response continua passando por `chrome.debugger`/`Fetch.fulfillRequest` orquestrado pelo `background.ts`.
- Não regredir a regra **No fallbacks / no default values** do projeto.

## Quality Gates

These commands must pass for every user story:
- `cd app && npm run lint` — Biome check
- `cd app && npm run build` — Vite production build (também valida TS via emit)
- `cd app && npm test` — Vitest (jsdom)

For UI stories: cobertura via Vitest + `@testing-library/react` é suficiente — verificação manual em browser **não é exigida** neste épico.

## User Stories

### US-001: Rota dedicada `/pending` com lista de responses pausadas
As a user de debug, I want uma view dedicada que liste todas as responses atualmente pausadas (`isWaiting === true`) em formato de tabela so that eu possa ver de uma vez tudo que está aguardando decisão sem precisar abrir o inspetor uma a uma.

**Acceptance Criteria:**
- [ ] Nova rota `/pending` registrada em `app/src/routes.tsx` sob o `Layout` (mesmo shell de Settings/Requests/History).
- [ ] Item de navegação "Pausadas" adicionado em `app/src/components/layout/AppSidebar.tsx` (ou `NavMain.tsx`) com badge mostrando a contagem de pendentes (reutilizando o estado já exposto por `useResponses`).
- [ ] A view consome `useResponses()` filtrando `isWaiting === true` (não criar novo hook — reutilizar o existente).
- [ ] Tabela exibe colunas mínimas: Método, URL, Status capturado, Tempo (se disponível), Ações.
- [ ] Estado vazio renderiza mensagem clara em pt-BR ("Nenhuma response aguardando decisão") e link para o CommandCenter.
- [ ] A view escuta o broadcast `requestUpdated`/`newPendingResponse` do background — quando uma pausada é aprovada/ignorada por outro caminho, ela some da tabela em tempo real.
- [ ] Cobertura: teste de renderização do estado vazio, teste de listagem com 2+ pendentes, teste de remoção reativa após `isWaiting: false`.

### US-002: Banner de pendentes ganha botão "Ver pausadas"
As a user, I want um terceiro botão no `PendingAlertBanner` que me leva direto à view `/pending` so that eu possa rapidamente ir para a tabela consolidada quando tiver muitas pausadas acumuladas.

**Acceptance Criteria:**
- [ ] `app/src/components/command-center/PendingAlertBanner.tsx` recebe nova prop `onViewPending: () => void` (segue o padrão das props existentes `onApproveNext`/`onIgnoreAll`).
- [ ] Botão "Ver pausadas (N)" renderizado com a contagem entre parênteses; estilo `outline` ou `secondary` (não competir com "Aprovar próximo").
- [ ] No `CommandCenter.tsx` (ou onde o banner é montado), o handler usa `useNavigate()` do `react-router-dom` para ir a `/pending`.
- [ ] Ordem dos botões no banner: `Ver pausadas` → `Ignorar todos` → `Aprovar próximo` (ação principal continua à direita).
- [ ] Teste atualizado em `__tests__/PendingAlertBanner.test.tsx` (criar se não existir) cobrindo: renderização da contagem, click chama `onViewPending`.

### US-003: Tabela de `/pending` oferece ações inline por linha
As a user, I want acionar Aprovar / Aprovar e editar / Criar Mock / Ignorar diretamente em cada linha da tabela de pausadas so that eu não precise abrir o inspetor para tomar decisões rápidas.

**Acceptance Criteria:**
- [ ] Cada linha tem um split button idêntico ao do `RequestInspector` (ver US-005) — para evitar duplicação, extrair o componente de ações para `app/src/components/command-center/PendingResponseActions.tsx` e reutilizá-lo em ambos os locais.
- [ ] "Aprovar e editar" abre o mesmo modal de edição da US-004 (compartilhar componente).
- [ ] Click em "Inspecionar" (ícone) abre o `RequestInspector` em painel/sheet sobre a tabela (não navega para fora).
- [ ] As ações operam sobre o `requestId` da linha — não dependem de "request selecionada" global.
- [ ] Teste: cada ação dispara a mensagem correta para o background (`approveResponse` com flags apropriadas, ou nova action — ver US-004).

### US-004: Edição one-shot de Response (status, headers, body) antes de aprovar
As a user, I want editar status code, headers e body da Response interceptada **uma única vez** e devolvê-la modificada à página so that eu possa simular respostas customizadas sem precisar criar uma regra de mock persistente.

**Acceptance Criteria:**
- [ ] Novo modal/sheet `EditResponseDialog` em `app/src/components/command-center/EditResponseDialog.tsx` com 3 campos:
  - Status code (number input, validado: 100–599);
  - Headers (editor key/value, multi-linha — pode reutilizar o estilo já usado em `MockActionEditor`);
  - Body (textarea com auto-detecção de content-type para syntax highlighting opcional via CodeMirror já vendorizado em `app/lib/`).
- [ ] Pré-preenchimento: o modal abre com os valores **reais** capturados da Response interceptada (status, headers, body decodificado).
- [ ] Botões do modal: `Cancelar` (fecha sem efeito) e `Aprovar com edição` (primary).
- [ ] Nova action de mensagem em `app/src/types/messages.ts`: `approveResponseWithEdit` carregando `{ requestId, status, headers, body }`.
- [ ] No `background.ts`, handler dessa action chama `Fetch.fulfillRequest` com os campos editados (NÃO usa `Fetch.continueRequest`), depois chama `patchRequest` para gravar a versão editada em `allRequests` + IndexedDB com flag `editedAtRuntime: true` (adicionar a `InterceptedResponse` em `app/src/types/intercepted.ts`).
- [ ] Se `Fetch.fulfillRequest` falhar, o erro **deve ser propagado** para a UI (toast) — **não** silenciar com fallback de `continueRequest` (regra "no fallbacks").
- [ ] A edição é **one-shot**: nenhuma regra é criada em `chrome.storage.local.rules`. Para persistência o usuário deve usar "Criar Mock".
- [ ] Tabela `/request-history` deve indicar visualmente requests editadas em runtime (ex.: badge "editada" na coluna de status).
- [ ] Cobertura: teste de submissão do modal com payload válido envia a mensagem correta; teste de propagação de erro renderiza toast.

### US-005: `RequestInspector` adota split button com hierarquia clara
As a user, I want um agrupamento de botões no inspetor onde "Aprovar" é claramente a ação principal e "Aprovar e editar" / "Criar Mock" / "Ignorar" são variações acessíveis via dropdown so that eu identifique a ação default num relance e use o teclado para variações.

**Acceptance Criteria:**
- [ ] Em `app/src/components/command-center/RequestInspector.tsx`, substituir o trio de `<Button>` (linhas ~140–165) por um split button:
  - Lado esquerdo: `Aprovar` (variant `default`, primary violeta — é a ação principal).
  - Lado direito: chevron que abre `DropdownMenu` (já vendorizado em `components/ui/dropdown-menu.tsx`) com:
    - `Aprovar e editar...` (abre `EditResponseDialog` da US-004);
    - `Criar Mock` (abre `QuickMockPanel` ou fluxo existente);
    - separador;
    - `Ignorar` (variant destructive — vermelho).
- [ ] Hotkeys (via `kbd.tsx` + listener já existente): `Enter` = Aprovar, `E` = Aprovar e editar, `M` = Criar Mock, `I` = Ignorar. Cada item do dropdown mostra o atalho via `<Kbd>`.
- [ ] Quando `isWaiting === true`, badge `<Badge variant="warning">Aguardando decisão</Badge>` aparece no header do inspetor (próximo ao título/URL); badge some quando a request é aprovada/ignorada.
- [ ] Botões só ficam habilitados quando `isWaiting === true`; quando a request já foi resolvida, o split button vira um indicador `Resolvida` (read-only).
- [ ] Atualizar `__tests__/RequestInspector.test.tsx` para cobrir: render do badge, click no botão principal dispara aprovação, abertura do dropdown, click em cada item dispara a action correspondente, hotkeys funcionam.
- [ ] O componente extraído na US-003 (`PendingResponseActions`) deve ser usado também aqui para garantir consistência — uma única fonte de verdade para o comportamento das ações.

## Functional Requirements
- FR-1: A rota `/pending` deve listar exclusivamente responses com `isWaiting === true` retornadas por `useResponses()`.
- FR-2: O banner `PendingAlertBanner` deve manter a contagem em tempo real e oferecer 3 ações: ver pausadas, ignorar todos, aprovar próximo.
- FR-3: A action `approveResponseWithEdit` deve usar `chrome.debugger.sendCommand('Fetch.fulfillRequest', ...)` com os campos editados; em caso de erro, propagar para a UI sem fallback.
- FR-4: O split button do inspetor deve ser componente compartilhado entre `RequestInspector` e `/pending`, evitando duplicação de lógica de ação.
- FR-5: O modal de edição deve carregar valores reais capturados (status/headers/body decodificado); se body não pôde ser decodificado, mostrar erro explícito — **não** preencher com string vazia.
- [ ] FR-6: O badge "Aguardando decisão" no inspetor deve refletir o estado `isWaiting` em tempo real via broadcast `requestUpdated`.
- FR-7: Ações inline em `/pending` devem operar por `requestId` (sem dependência de seleção global).
- FR-8: Edições one-shot devem ser registradas em IndexedDB com flag `editedAtRuntime: true` para auditoria/diferenciação visual no histórico.

## Non-Goals
- Persistir edições como regras automaticamente — quem quer persistência usa "Criar Mock".
- Editar a **request** (URL, postData, método antes de sair) — escopo é a Response, conforme CLAUDE.md ("Request *headers* are not stored separately from response headers").
- System theme / acessibilidade WCAG completa do split button (cobrir só contraste mínimo, AA não é requisito deste épico).
- Verificação manual em browser ou screenshots no PR (Quality Gates explicita: só Vitest).
- Mudar o protocolo de mensagens para algo diferente de `chrome.runtime.sendMessage`/`chrome.tabs.sendMessage`.
- Bulk edit (editar múltiplas pausadas com o mesmo payload) — fora de escopo, pode virar follow-up.
- Internacionalização das novas strings — manter em pt-BR conforme convenção do projeto (issue #3 trata i18n).

## Technical Considerations
- **Componente compartilhado**: extrair `PendingResponseActions` em `app/src/components/command-center/PendingResponseActions.tsx` para evitar divergência entre inspetor e tabela `/pending`.
- **Tipos**: adicionar `editedAtRuntime?: boolean` em `InterceptedResponse` (`app/src/types/intercepted.ts`) e migrar `__tests__/RequestInspector.test.tsx`/qualquer teste que crie objetos completos.
- **Mensagens**: adicionar `approveResponseWithEdit` à união discriminada em `app/src/types/messages.ts`; o background deve tratar a action e nunca silenciar erros de `Fetch.fulfillRequest`.
- **Decoding do body**: o body chega base64 ou texto via `Fetch.getResponseBody`; o modal deve respeitar `base64Encoded` ao popular e ao reenviar (re-encodar se necessário).
- **shadcn**: `DropdownMenu`, `Button`, `Badge`, `Dialog`/`Sheet`, `Tabs`, `Textarea` já estão vendorizados — não adicionar deps novas.
- **Roteamento**: `createHashRouter` está em `app/src/routes.tsx`; novas rotas devem ser children do `Layout`.
- **IndexedDB**: nenhum schema bump — `editedAtRuntime` é campo opcional, não requer migração.
- **Risco**: o `RequestInspector` tem testes existentes que provavelmente quebram com a refatoração do split button — atualizar todos antes de marcar a US-005 concluída.

## Success Metrics
- Todas as 5 user stories fechadas com `npm run lint && npm run build && npm test` verdes.
- Cobertura do `PendingResponseActions` ≥ 80% (cada ação testada).
- `tsc --noEmit` (parte do `npm run build`) sem novos erros.
- Nenhuma nova regressão introduzida em `useResponses`/`useAllRequests` (testes existentes continuam passando).
- Nenhum novo padrão de fallback silencioso introduzido no background (regra "no fallbacks" preservada).

## Open Questions
- **Encoding do body editado**: ao reenviar via `Fetch.fulfillRequest`, o conteúdo deve ser sempre re-base64 ou enviar texto plano quando o `Content-Type` for textual? Decidir na implementação da US-004 com base no que o CDP aceita — registrar em comentário se houver caso especial.
- **Validação de headers**: bloquear edição de headers controlados pelo Chrome (`Content-Length`, `Transfer-Encoding`) ou só avisar? Sugestão: avisar via toast ao salvar, sem bloquear.
- **Persistência da edição no histórico**: se o usuário editar a Response e o Chrome subsequente fizer cache, isso pode confundir? Provavelmente não (somos Manifest V3 + Fetch domain), mas vale validar manualmente uma vez antes de fechar o épico.