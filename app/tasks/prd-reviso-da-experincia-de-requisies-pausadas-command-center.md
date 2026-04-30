# PRD: Revisão da experiência de requisições pausadas (Command Center)

## Overview

A entrega anterior (`feature/interception` — commits `faebd11` e `5802009`) introduziu a rota `/pending` com tabela própria, um item de menu "Pausadas" e duas superfícies de notificação (`PendingAlertBanner` + `PendingActionDock`). Em revisão, identificamos redundância: o Command Center (`/command-center`) já é a tabela canônica de requisições e deve ser o único lugar onde o usuário vê requisições pausadas. Este PRD revisa a UX para:

1. Eliminar a rota `/pending` e o item de menu "Pausadas"; "Ver pausadas" passa a aplicar um filtro no `/command-center` via query string.
2. Reformular a ação "Aprovar e editar..." (renomeada para "Editar...") em um Sheet lateral que mostra a Response completa antes da aplicação, com Status Code, Response Headers e Response Body editáveis.
3. Fundir `PendingAlertBanner` em `PendingActionDock`, deixando o Dock como a única superfície de ações em massa para pausadas (Ver pausadas, Ignorar todos, Aprovar próximo) e exibindo a próxima URL pausada como label.

## Goals

- Reduzir superfícies redundantes (rota dedicada + banner + dock) para uma única superfície (Dock + filtro no Command Center).
- Tornar o filtro "pausadas" compartilhável e linkável via URL, integrado ao `FilterBar` existente.
- Garantir que a edição de uma resposta pausada mostre todas as informações que serão entregues ao client antes do "Aplicar e continuar".
- Manter os atalhos `A` / `I` / `J` / `K` funcionais e centralizados no Dock.

## Quality Gates

Estes comandos devem passar para cada user story (rodando dentro de `app/`):

- `npm run lint`
- `npm test`
- `npm run build`

Verificação visual no navegador não é necessária — testes automatizados (vitest + jsdom) são suficientes.

## User Stories

### US-001: Suporte a filtros via query string no Command Center
As a usuário que clica em "Ver pausadas", I want que o filtro seja aplicado via URL (`?filter=...`) compatível com o `FilterBar`, so that o estado seja linkável, sobreviva a refresh e o `FilterBar` reflita o filtro ativo.

**Acceptance Criteria:**
- [ ] `app/src/pages/CommandCenter.tsx` lê o estado inicial de filtros a partir de `useSearchParams()` (chave `filter`) na primeira renderização.
- [ ] Mudanças no `FilterBar` (`setFilters`) sincronizam para a URL via `setSearchParams` sem provocar re-render em loop.
- [ ] Formato da URL é estável e documentado em comentário curto no topo do parser (`?filter=state:pending` para o caso de pausadas; demais filtros existentes continuam suportados).
- [ ] Navegação direta para `/command-center?filter=state:pending` carrega a tabela já filtrada para `isWaiting === true`.
- [ ] Limpar todos os chips remove o parâmetro `filter` da URL.
- [ ] Existe teste em `app/src/pages/__tests__/CommandCenter.test.tsx` (criar se não existir) cobrindo: leitura inicial da URL, escrita ao adicionar chip, escrita ao remover chip.

### US-002: Filtro `state:pending` no FilterBar
As a usuário, I want um chip de filtro `state:pending` reconhecido pelo `FilterBar` so that consigo filtrar pausadas pela mesma sintaxe usada nos demais filtros.

**Acceptance Criteria:**
- [ ] `FilterBar` reconhece `state:pending` como chip válido (sugestão no popover, parsing, render do chip removível).
- [ ] `useAllRequests` (ou a função `matchesFilterGroups`) interpreta `state:pending` como `isWaiting === true`.
- [ ] Outros valores de `state:*` ainda inválidos não quebram a UI — são ignorados ou exibidos como chip desconhecido (definir comportamento explícito, sem fallback silencioso).
- [ ] Teste cobre: `state:pending` só lista requests com `isWaiting === true`, ausência do chip lista todas.

### US-003: Remoção da rota `/pending` e do item de menu "Pausadas"
As a usuário, I want que a rota `/pending` deixe de existir e o item de menu "Pausadas" suma so that o Command Center seja a única superfície de listagem.

**Acceptance Criteria:**
- [ ] `app/src/pages/PendingResponses.tsx` é removido.
- [ ] Entrada da rota `/pending` em `app/src/routes.tsx` é substituída por um redirect (`<Navigate to="/command-center?filter=state:pending" replace />`) e marcada como rota legada (comentário curto explicando o motivo).
- [ ] Item "Pausadas" em `app/src/components/layout/AppSidebar.tsx` (linha 23) é removido junto com seu ícone, se não for usado em outro lugar.
- [ ] `npm run build` produz `app/dist/` sem referências quebradas a `/pending` ou ao componente removido.
- [ ] Nenhum import órfão de `PendingResponses` permanece no repositório.

### US-004: Fusão de `PendingAlertBanner` em `PendingActionDock`
As a usuário, I want uma única superfície (Dock) para ações sobre pausadas so that não exista redundância entre banner topo e dock inferior.

**Acceptance Criteria:**
- [ ] `app/src/components/command-center/PendingAlertBanner.tsx` é removido.
- [ ] Todas as renderizações do `PendingAlertBanner` são removidas (verificar `CommandCenter.tsx` e qualquer outra página que o monte).
- [ ] `PendingActionDock` passa a exibir, sempre que `pendingCount > 0`:
  - Contador (`N pausadas`).
  - Botão **Ver pausadas** que navega para `/command-center?filter=state:pending`.
  - Botão **Ignorar todos** (sem confirmação).
  - Botão primário **Aprovar próximo** (já existente ou novo).
  - Linha secundária (label, truncada) com a URL da próxima requisição pausada.
  - Atalhos `A` / `I` / `J` / `K` exibidos em forma compacta abaixo das ações.
- [ ] Quando `pendingCount === 0`, o Dock não é renderizado.
- [ ] Existe teste cobrindo: render com 0 pausadas (não monta), render com N>0 mostra contador + URL + ações; clique em "Ver pausadas" muda a URL para `/command-center?filter=state:pending`.

### US-005: Ação "Ignorar todos" sem confirmação
As a usuário, I want que "Ignorar todos" no Dock dispense imediatamente todas as requisições pausadas so that posso desfazer um pause em massa rapidamente.

**Acceptance Criteria:**
- [ ] `useResponses` expõe um método `ignoreAllPending()` que itera sobre `pendingResponses` chamando `ignoreResponse(id)` para cada uma (ou despacha uma única action `ignoreAllPending` no background, se preferir um único round-trip — decidir na implementação e documentar).
- [ ] Botão **Ignorar todos** no `PendingActionDock` chama esse método sem AlertDialog ou confirmação intermediária.
- [ ] Após o clique, `pendingResponses` fica vazio e o Dock desmonta automaticamente.
- [ ] Caso a estratégia seja despachar uma única mensagem, `app/src/types/messages.ts` recebe a action correspondente e o background a implementa percorrendo o mapa `pendingResponses`.
- [ ] Erros do `Fetch.continueRequest` (do background) **não são silenciados** — são propagados como `console.error` e a UI exibe um toast/erro visível (sem fallback que finja sucesso). Respeita a regra "no fallbacks" do projeto.
- [ ] Teste cobre: clique no botão chama `ignoreAllPending`, estado é zerado, Dock desmonta.

### US-006: Renomear "Aprovar e editar..." para "Editar..."
As a usuário, I want que a opção do dropdown inline de uma linha pausada seja apenas "Editar..." so that não fique redundante com o "Aprovar".

**Acceptance Criteria:**
- [ ] No dropdown inline da `RequestTable` (criado em US-003 da entrega anterior), o item passa a se chamar **Editar...** em pt-BR.
- [ ] O `aria-label` e qualquer string visível ("Aprovar e editar", "Approve and edit") foi atualizado.
- [ ] Testes existentes que asseguravam o label antigo são atualizados para o novo.

### US-007: Substituir `EditResponseDialog` por um Sheet lateral com Response completa
As a usuário ao clicar em "Editar..." numa requisição pausada, I want um Sheet lateral mostrando a Response completa (Status Code, Response Headers, Response Body) editáveis e botões "Aplicar e continuar" / "Cancelar" so that consigo revisar tudo que será entregue ao client antes de aprovar.

**Acceptance Criteria:**
- [ ] Componente atual `app/src/components/command-center/EditResponseDialog.tsx` é convertido (ou substituído por) um novo componente baseado no `Sheet` do shadcn-ui (lado direito), nome sugerido `EditResponseSheet`.
- [ ] O Sheet exibe, em campos editáveis e claramente rotulados:
  - **Status Code** (input numérico com validação 100–599).
  - **Response Headers** (editor — pode reutilizar o editor existente do Dialog atual; cabeçalhos em formato chave/valor).
  - **Response Body** (editor de texto/JSON existente).
- [ ] O Sheet exibe, em modo somente leitura, dados do request original que ajudam a contextualizar (Method + URL no header do Sheet). Headers de request não são exibidos como editáveis (consistente com a quirk de `InterceptedResponse.headers` ser apenas response headers — issue #19).
- [ ] Botões: **Aplicar e continuar** (primário) chama `approveResponseWithEdit(id, edits)`; **Cancelar** fecha o Sheet sem despachar nada.
- [ ] Validação: não envia se Status Code estiver fora de 100–599 ou se headers tiverem chave vazia. Erros aparecem inline (sem fallback silencioso).
- [ ] Estado de "submitting" desabilita os botões enquanto o background não responde; erro de mensageria exibe alerta visível.
- [ ] Componentes/estado removidos do antigo Dialog (se virar um novo arquivo) não deixam imports órfãos.
- [ ] Existe teste de unidade cobrindo: render com mock `pendingResponse`, edição de Status/Headers/Body, clique em **Aplicar e continuar** dispara `approveResponseWithEdit` com payload correto, **Cancelar** fecha sem despachar, validação bloqueia submit.

### US-008: Limpeza de hotkeys e mensagens órfãs
As a maintainer, I want que a remoção da rota `/pending` e do banner não deixe código morto so that o repositório fique consistente.

**Acceptance Criteria:**
- [ ] `app/src/components/command-center/usePendingHotkeys.ts` continua funcional e passa a ser registrado apenas onde `PendingActionDock` é renderizado (verificar se já é o caso).
- [ ] Nenhuma string `/pending` ou `PendingAlertBanner` permanece no código (exceto em `routes.tsx` no redirect intencional).
- [ ] `app/src/types/messages.ts` reflete exatamente as actions usadas (sem ações deprecated do banner antigo).
- [ ] `git grep` para `PendingAlertBanner`, `Pausadas`, `/pending` retorna apenas: ocorrências esperadas no `routes.tsx` (redirect), no Dock (label "Ver pausadas"), e em testes.

## Functional Requirements

- **FR-1:** O Command Center deve ler o filtro inicial de `useSearchParams()` e refletir mudanças do `FilterBar` na URL via `setSearchParams`, sem causar re-render infinito.
- **FR-2:** O filtro `state:pending` deve ser reconhecido pelo `FilterBar` e por `matchesFilterGroups` (ou equivalente), avaliando `isWaiting === true`.
- **FR-3:** A rota `/pending` deve responder com `<Navigate to="/command-center?filter=state:pending" replace />` para preservar bookmarks.
- **FR-4:** O item de menu "Pausadas" no `AppSidebar` deve ser removido.
- **FR-5:** `PendingAlertBanner` deve ser removido completamente do código.
- **FR-6:** `PendingActionDock` deve renderizar apenas quando `pendingCount > 0` e exibir contador, próxima URL pausada (label truncado), botões **Ver pausadas**, **Ignorar todos**, **Aprovar próximo**, e os atalhos `A` / `I` / `J` / `K`.
- **FR-7:** O botão "Ignorar todos" deve dispensar todas as pausadas sem AlertDialog/confirmação intermediária.
- **FR-8:** A action de "Editar..." (antes "Aprovar e editar...") no dropdown inline da `RequestTable` deve abrir um Sheet lateral.
- **FR-9:** O Sheet deve permitir editar Status Code (100–599), Response Headers (chave/valor) e Response Body antes de chamar `approveResponseWithEdit`.
- **FR-10:** Validação de Status Code e headers deve falhar com erro visível, sem fallback silencioso (regra do projeto "no fallbacks").
- **FR-11:** Toda chamada à mensageria que falhe deve propagar erro para a UI (toast/erro visível), sem mascarar a falha.

## Non-Goals

- Não vamos introduzir confirmação para "Ignorar todos" (decisão explícita 5B).
- Não vamos exibir headers de request como editáveis (issue #19 está em aberto e fora deste escopo).
- Não vamos implementar persistência de drafts de edição (se o usuário fechar o Sheet, os edits são perdidos).
- Não vamos auto-detectar tema de sistema ou mexer em theming.
- Não vamos refatorar `useAllRequests` para reescrever o sistema de filtros — apenas adicionamos suporte a `state:pending` e sincronização com URL.
- Não vamos alterar `IndexedDBServiceImpl` ou contratos de persistência.
- Não vamos remover o `legacy_backup_v1` nem mexer em `legacyMigration.ts`.

## Technical Considerations

- **Sincronização URL ↔ filtros:** cuidar para evitar loops de update entre `useSearchParams` e o estado interno do Command Center. Estratégia recomendada: estado canônico vive na URL, componentes leem dela; mudanças de `FilterBar` chamam `setSearchParams` e não setam state local em paralelo.
- **`Sheet` shadcn-ui:** verificar se o primitive `Sheet` já está vendado em `app/src/components/ui/`. Se não estiver, adicionar via `npm run shadcn:add sheet` antes da implementação (registrar isso na PR).
- **Atomicidade do "Ignorar todos":** preferir uma única mensagem ao background (`ignoreAllPending`) que percorre `pendingResponses` lá — reduz round-trips e mantém o tratamento de erro centralizado. Adicionar a action em `app/src/types/messages.ts` (single source of truth) e implementar handler no `background.ts`.
- **Atalhos `A` / `I` / `J` / `K`:** já existem em `usePendingHotkeys.ts`; só precisam continuar acoplados ao Dock (um único call site).
- **Strings em pt-BR:** todos os labels novos/alterados devem estar em pt-BR para casar com o restante da UI.
- **Indentação tabs:** seguir `.editorconfig` (tabs, size 2). Biome aplica via lint-staged.
- **No fallbacks:** validação de Status/Headers no Sheet deve falhar visivelmente; mensageria com falha deve propagar.

## Success Metrics

- Rota `/pending` deixa de existir; bookmarks antigos redirecionam para `/command-center?filter=state:pending`.
- Apenas uma superfície de ação para pausadas: `PendingActionDock`.
- Teste manual ad-hoc: pausar 3+ requisições, clicar em "Ver pausadas" pelo Dock filtra a tabela; "Ignorar todos" zera o estado; "Editar..." numa linha abre o Sheet lateral com Status/Headers/Body editáveis; "Aplicar e continuar" envia ao client a Response modificada.
- `npm run lint && npm test && npm run build` verde em todas as user stories.

## Open Questions

- Para "Ignorar todos", preferimos uma única mensagem `ignoreAllPending` no background ou um loop client-side de `ignoreResponse`? Recomendação no PRD é a primeira (atomicidade + menos round-trips), mas vale confirmar antes de implementar US-005.
- Devemos manter o redirect de `/pending` indefinidamente ou removê-lo após uma release de transição? Sugerido: manter por 1 release e abrir issue de cleanup.