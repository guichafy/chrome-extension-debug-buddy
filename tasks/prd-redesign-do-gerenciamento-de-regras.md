# PRD: Redesign do Gerenciamento de Regras

## Overview
A área de regras do Debug Buddy hoje concentra-se em um modal pequeno e uma listagem básica, dificultando a criação e a manutenção das 4 categorias de comportamento que o interceptador suporta. Este PRD redesenha **toda a experiência** — listagem, modal de criação/edição, fluxos por tipo de regra e prioridade de matching — usando shadcn/ui e práticas de UX/UI consistentes, expondo claramente os tipos **Breakpoint**, **Mock**, **Transform** e **Delay**.

A mudança também consolida o vocabulário do produto: o tipo interno `modify` passa a se chamar `transform` em todo o código (sem camada de compatibilidade), refletindo melhor o que ele faz (chama o servidor remoto e aplica transformações na resposta).

## Goals
- Tornar óbvia a escolha do tipo de regra (Breakpoint / Mock / Transform / Delay) e o que cada um faz
- Reduzir o tempo para criar regras comuns via biblioteca de templates curados
- Permitir gerenciar grandes volumes de regras (busca, filtro, toggle, duplicar, importar/exportar)
- Tornar a prioridade de matching explícita e controlável via drag-and-drop
- Substituir o modal pequeno por um Dialog grande com wizard guiado e preview ao vivo
- Suportar Transform tanto em modo declarativo (JSONPath) quanto avançado (JS)

## Quality Gates

These commands must pass for every user story:
- `cd app && npm run lint` — Biome check
- `cd app && npx tsc --noEmit` — Type checking estrito
- `cd app && npm run build` — Build de produção do Vite
- `cd app && npm test` — Vitest run

Para stories de UI, também:
- Verificar visualmente a extensão carregada em `chrome://extensions` (load unpacked de `app/dist/`) — abrir o interceptor, criar/editar/remover a regra coberta pela story e confirmar comportamento sem regressões em rotas vizinhas

## User Stories

### US-001: Renomear `modify` para `transform` em todo o código
As a maintainer, I want the codebase to call this rule type `transform` everywhere so that the user-facing label and the internal contract stay in sync, with no legacy aliases lingering.

**Acceptance Criteria:**
- [ ] `Rule.action.type` em `app/src/types/rules.ts` aceita `'mock' | 'delay' | 'transform' | 'breakpoint'` (sem `'modify'`)
- [ ] Todos os usos de `'modify'` no background, hooks, componentes e testes foram trocados por `'transform'`
- [ ] Migração one-shot em `app/src/lib/legacyMigration.ts` converte regras gravadas com `type: 'modify'` para `type: 'transform'` em `chrome.storage.local.rules`
- [ ] Nenhum branch de código aceita `'modify'` em runtime após a migração (sem fallback de leitura dupla)
- [ ] Testes existentes que usavam `'modify'` foram atualizados para `'transform'` e passam

### US-002: Prioridade de matching ordenada
As a debugger user, I want the first rule whose matcher matches the request to be the rule that's applied, so that I have an explicit and controllable order of evaluation.

**Acceptance Criteria:**
- [ ] `checkForMock` / `checkForBreakpoint` / lógica de matching no `background.ts` itera regras na ordem do array `rules` e para na primeira que casa
- [ ] A ordem do array reflete a ordem definida pelo usuário na UI
- [ ] Documentação interna (comentário no header de `background.ts` ou na página de regras) explica a regra "primeira que casa vence"
- [ ] Teste cobre cenário com duas regras que casam o mesmo request — apenas a primeira é aplicada

### US-003: Redesign da listagem de regras
As a user, I want a clean, scannable rules table built with shadcn `Table` so that I can browse and act on many rules quickly.

**Acceptance Criteria:**
- [ ] Rota `/` exibe uma tabela shadcn com colunas: Ordem, Status (toggle), Tipo (badge colorida por tipo), Matcher (URL + método), Resumo da ação, Ações (editar/duplicar/remover)
- [ ] Cada tipo (Mock/Delay/Transform/Breakpoint) tem ícone e cor consistentes em toda a UI
- [ ] Estado vazio com call-to-action "Criar primeira regra" que abre o wizard
- [ ] Sem regressões em `/requests` e `/request-history`

### US-004: Busca e filtro na listagem
As a user, I want to search and filter the rules table so that I can find a specific rule among many.

**Acceptance Criteria:**
- [ ] Campo de busca filtra em tempo real por substring de URL pattern ou descrição
- [ ] Filtros multi-seleção por Tipo (Mock/Delay/Transform/Breakpoint) e por Método HTTP (GET/POST/PUT/DELETE/PATCH/ANY)
- [ ] Filtros e busca são combinados (AND)
- [ ] Estado dos filtros persiste durante a sessão da aba do interceptor (não precisa persistir entre reloads)

### US-005: Toggle enabled/disabled por regra
As a user, I want to temporarily disable a rule without deleting it so that I can iterate quickly during a debug session.

**Acceptance Criteria:**
- [ ] Campo `enabled: boolean` adicionado a `Rule` (default `true` para regras existentes via migração)
- [ ] `Switch` shadcn na coluna Status alterna `enabled` e persiste em `chrome.storage.local.rules`
- [ ] Background ignora regras com `enabled === false` durante matching
- [ ] Visual deixa claro que regras desabilitadas estão "apagadas" (opacity reduzida, sem badge ativa)

### US-006: Duplicar regra
As a user, I want to duplicate an existing rule so that I can create variants without re-entering everything.

**Acceptance Criteria:**
- [ ] Ação "Duplicar" no menu da linha cria uma nova regra com mesmo conteúdo, novo `id`, sufixo "(cópia)" no nome/descrição
- [ ] A cópia aparece imediatamente abaixo da regra original na ordem
- [ ] A cópia inicia com `enabled: false` para evitar duplicação acidental de comportamento

### US-007: Reordenar com drag-and-drop
As a user, I want to drag rules to reorder them so that I can control matching priority visually.

**Acceptance Criteria:**
- [ ] Handle de drag visível em cada linha da tabela
- [ ] Dropping reordena o array `rules` em `chrome.storage.local`
- [ ] Background reflete a nova ordem na próxima requisição (já garantido pelo `chrome.storage.onChanged` listener)
- [ ] Animação/feedback visual durante o drag
- [ ] Acessível via teclado (move up/down) — `ArrowUp/ArrowDown` com `Ctrl/Cmd` na linha focada

### US-008: Importar e exportar regras em JSON
As a user, I want to export my rules to a JSON file and import them back so that I can share rule sets with teammates or back them up.

**Acceptance Criteria:**
- [ ] Botão "Exportar" baixa `debug-buddy-rules-<timestamp>.json` com o array completo de regras
- [ ] Botão "Importar" abre seletor de arquivo `.json`, valida o schema e oferece duas opções: "Substituir todas" ou "Acrescentar"
- [ ] Validação rejeita arquivos com schema inválido com mensagem clara (sem fallback silencioso)
- [ ] Regras importadas via "Acrescentar" recebem novos `id`s para evitar colisão

### US-009: Wizard multi-step em Dialog grande
As a user, I want a large, multi-step dialog when creating or editing a rule so that I have room to see all the relevant fields and a preview side-by-side.

**Acceptance Criteria:**
- [ ] Dialog shadcn com largura aproximada de 960px (responsivo, máximo 90vw) e altura máxima de 85vh com scroll interno
- [ ] Cabeçalho fixo mostra os passos: Tipo → Matcher → Ação → Revisar
- [ ] Botões "Anterior" / "Próximo" / "Salvar" no rodapé fixo, com estado disabled adequado por step
- [ ] Estado do wizard preservado ao navegar entre steps (não reinicia ao voltar)
- [ ] Botão "Cancelar" pede confirmação se houver alterações não salvas
- [ ] No modo "Editar regra existente", o usuário pode pular direto para qualquer step válido

### US-010: Step "Tipo" — seleção visual
As a user, I want to pick the rule type with clear visual cards explaining what each type does so that I don't confuse Mock with Transform.

**Acceptance Criteria:**
- [ ] Step "Tipo" exibe 4 cards (Breakpoint, Mock, Transform, Delay) com ícone, título e descrição curta de cada um
- [ ] Descrições refletem o comportamento real:
  - Mock: "Não chama o servidor — retorna a resposta mockada"
  - Transform: "Chama o servidor e aplica modificações na resposta"
  - Delay: "Atrasa a resposta antes de devolver ao cliente"
  - Breakpoint: "Pausa antes de responder e permite editar a resposta em voo"
- [ ] Card selecionado fica visualmente destacado
- [ ] No modo "Editar", o tipo aparece pré-selecionado e bloqueado (mudar tipo = criar regra nova)

### US-011: Biblioteca de templates curados
As a user, I want to start a new rule from a template so that I can quickly cover common scenarios without configuring everything from scratch.

**Acceptance Criteria:**
- [ ] No início do wizard (antes ou junto do step "Tipo"), o usuário pode escolher "Começar do zero" ou "Usar template"
- [ ] Lista inicial com 6-10 templates curados, cobrindo no mínimo:
  - "Simular 500 Internal Server Error" (mock)
  - "Simular 404 Not Found" (mock)
  - "Forçar resposta vazia" (mock)
  - "Atrasar resposta em 3s" (delay)
  - "Adicionar header CORS `Access-Control-Allow-Origin: *`" (transform)
  - "Remover campo `id` da resposta JSON" (transform)
  - "Pausar para inspeção/edição manual" (breakpoint)
- [ ] Selecionar template pré-preenche todos os campos do wizard, mas o usuário pode editar livremente antes de salvar
- [ ] Templates ficam definidos em `app/src/domain/ruleTemplates.ts` (puro, testável) e são consumidos pela UI

### US-012: Step "Matcher" unificado com preview
As a user, I want one place to define what URLs the rule applies to with live feedback so that I know my matcher works before saving.

**Acceptance Criteria:**
- [ ] Editor de matcher unificado: padrão de URL (com suporte a wildcards `*`), método HTTP (multi-select com opção `ANY`)
- [ ] Painel de preview mostra "URL de teste" — usuário cola uma URL e o painel indica se a regra casaria (verde/vermelho) e por quê
- [ ] Validação rejeita matcher vazio (sem default `*`)
- [ ] Mensagens de erro inline em campos inválidos

### US-013: Editor de ação Mock
As a user, I want a dedicated editor for Mock responses so that I can configure status, headers and body comfortably.

**Acceptance Criteria:**
- [ ] Campo numérico para status code (com presets rápidos: 200, 204, 400, 401, 403, 404, 500)
- [ ] Editor de headers (lista de pares chave-valor com adicionar/remover)
- [ ] Editor de body com syntax highlight JSON (reaproveitar bibliotecas em `lib/` — codemirror/jsonlint)
- [ ] Validação de JSON do body com erro inline (sem fallback de "salvar mesmo assim")
- [ ] Botão "Formatar JSON" usa o prettier vendido em `lib/`

### US-014: Editor de ação Delay
As a user, I want a simple delay editor with quick presets so that I can pick common values fast.

**Acceptance Criteria:**
- [ ] Input numérico em milissegundos com mínimo 0
- [ ] Presets clicáveis: 500ms, 1s, 3s, 5s, 10s
- [ ] Texto explicativo: "O servidor remoto será chamado normalmente; a resposta será segurada por X ms antes de devolver ao cliente"
- [ ] Validação rejeita valores negativos ou não numéricos

### US-015: Editor de ação Breakpoint
As a user, I want to configure a Breakpoint rule with a description so that when the dialog appears mid-flight I remember why I set it.

**Acceptance Criteria:**
- [ ] Campo opcional de descrição/notas que aparecerá no `ResponseDialog` quando a regra disparar
- [ ] Texto explicativo: "Quando esta regra casar, o request será pausado e o dialog de inspeção será aberto para edição manual da resposta antes de prosseguir"
- [ ] Sem outros campos de configuração — o comportamento de pause é o atual

### US-016: Editor de Transform — modo declarativo
As a user, I want to add/remove/replace fields in the response without writing code so that simple transforms are accessible.

**Acceptance Criteria:**
- [ ] Lista de operações ordenadas, cada uma com tipo (`add` | `remove` | `replace`), JSONPath alvo e (para `add`/`replace`) valor
- [ ] Botões adicionar/remover/reordenar operações
- [ ] Painel de preview: usuário cola uma response JSON de exemplo, o painel mostra a saída transformada em tempo real
- [ ] Validação de JSONPath inválido com erro inline
- [ ] Operações são aplicadas em ordem; se uma falhar, a falha é exposta (sem fallback silencioso)

### US-017: Editor de Transform — modo avançado JS
As a power user, I want to write a JavaScript transform function for complex cases so that I'm not limited to declarative ops.

**Acceptance Criteria:**
- [ ] Toggle "Modo avançado" alterna entre editor declarativo e editor de código
- [ ] Editor de código (codemirror já vendido em `lib/`) com assinatura fixa: `(response) => transformedResponse`
- [ ] Painel de preview executa a função em sandbox sobre uma response de exemplo colada pelo usuário
- [ ] Erros de execução são exibidos no painel de preview, não silenciados
- [ ] Aviso de segurança: "Código executa no service worker da extensão; só rode código que você confia"
- [ ] Schema da regra distingue claramente `mode: 'declarative'` vs `mode: 'advanced'` no `action.transform`

### US-018: Step "Revisar e Salvar"
As a user, I want a final summary of the rule before saving so that I catch mistakes.

**Acceptance Criteria:**
- [ ] Step final mostra um resumo legível: tipo, matcher, ação, status `enabled`
- [ ] No modo "Editar", exibe diff visual entre estado original e estado novo (campos que mudaram destacados)
- [ ] Validação final agrega erros de todos os steps e os lista; botão "Salvar" fica desabilitado se houver erro
- [ ] Salvar persiste em `chrome.storage.local.rules` e fecha o dialog
- [ ] Toast de confirmação após salvar (com ação "Desfazer" que restaura o estado anterior das regras por 5s)

## Functional Requirements

- FR-1: O schema `Rule` deve usar `'transform'` em vez de `'modify'` em todo o código e storage; a migração one-shot deve converter regras antigas e remover o valor legado
- FR-2: O background deve aplicar regras na ordem do array `rules`, parando na primeira que casa
- FR-3: Regras com `enabled === false` devem ser ignoradas pelo matching no background
- FR-4: A UI de listagem deve oferecer busca por texto, filtros por tipo e método, toggle, duplicar, reordenar via drag-and-drop e import/export JSON
- FR-5: O wizard de criação/edição deve usar Dialog grande (~960px) com steps Tipo → Matcher → Ação → Revisar e suportar templates pré-preenchidos
- FR-6: O step "Matcher" deve oferecer preview ao vivo de match contra uma URL de teste
- FR-7: Cada um dos 4 tipos de ação deve ter um editor dedicado com validação inline (sem fallbacks silenciosos)
- FR-8: O editor de Transform deve oferecer modo declarativo (JSONPath ops) e modo avançado (função JS), ambos com preview
- FR-9: O step "Revisar" deve mostrar resumo + diff (em edição) e bloquear o salvamento se houver erros
- FR-10: Templates curados devem residir em `app/src/domain/ruleTemplates.ts` como módulo puro testável

## Non-Goals

- Internacionalização (issue #3 já trata disso separadamente — UI permanece em PT-BR)
- Sincronização de regras entre dispositivos via `chrome.storage.sync`
- Versionamento/histórico de mudanças por regra
- Editor visual de URL pattern com construtor por componente (host, path, query) — manter input de pattern com wildcards
- Suporte a request body matching (matcher continua URL + método)
- Captura/storage separado de request headers (issue #19 segue independente)
- Compatibilidade com regras gravadas em formato anterior à migração `modify` → `transform` (migração é destrutiva por decisão)

## Technical Considerations

- Componentes shadcn/ui a usar/adicionar: `Dialog`, `Sheet` (caso adapte), `Table`, `Tabs`, `Switch`, `Badge`, `Card`, `Select`, `Input`, `Textarea`, `Tooltip`, `DropdownMenu`, `Stepper` (custom ou via Tabs verticais), `AlertDialog` (para confirmação de cancelamento). Adicionar via `npm run shadcn:add <name>`.
- Drag-and-drop: avaliar `dnd-kit` (alinhado com React 19) — adicionar como dependência se ainda não presente.
- Editor de código (US-017) deve reaproveitar o codemirror já em `app/lib/` em vez de adicionar nova dependência.
- JSONPath: avaliar lib pequena tipo `jsonpath-plus` para o modo declarativo do Transform.
- O fluxo de migração de `'modify'` → `'transform'` segue o padrão de `app/src/lib/legacyMigration.ts` (one-shot no install/update); decisão explícita: **sem** backup deste valor (diferente de `legacy_backup_v1` do schema antigo).
- Estado do wizard pode ser local ao componente Dialog (não precisa global) — reduzir acoplamento.
- Persistência continua sendo `chrome.storage.local.rules` (não tocar em IndexedDB ou em `pendingResponses` neste PRD).

## Success Metrics

- 4 tipos de regra ficam disponíveis no wizard com UX consistente
- Templates curados cobrem casos de uso comuns sem necessidade de edição manual
- Listagem suporta busca, filtro, toggle, duplicar, reorder e import/export sem regressões
- Toda interação de regra acontece no Dialog grande (não há mais modal pequeno)
- Build (`npm run build`), tipos (`npx tsc --noEmit`), lint (`npm run lint`) e testes (`npm test`) passam em todas as stories
- Zero ocorrências de `'modify'` no código após US-001 (verificável via `grep`)

## Open Questions

- Qual ícone exato usar para cada tipo de regra? (sugerido: `Pause` para Breakpoint, `ServerOff` para Mock, `Wand2` para Transform, `Clock` para Delay — confirmar antes de implementar)
- O preview ao vivo do Transform avançado (JS) deve rodar em um Worker isolado por segurança ou pode rodar inline no service worker? Decisão fica para a story US-017.
- Atalho de teclado para abrir o wizard (ex.: `N` na rota `/`) — desejável ou fora do escopo?
- Deve haver paginação na tabela quando o número de regras passar de N (ex.: 50)? Hoje a base de regras é pequena, mas vale considerar.