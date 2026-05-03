# Session Replay — Correções Pós-Lançamento (2026-05-02)

## Contexto

Após shippar o Epic Session Replay (Phases 1-6), o usuário reportou 4 problemas críticos
ao validar o build:

1. **Gravação independente da interceptação.** Hoje há dois toggles separados ("Iniciar
   Interceptação" e "Gravação"). Espera-se um lifecycle único: ao iniciar interceptação,
   a gravação inicia automaticamente; ao parar, a gravação para.
2. **Replay mostra "0 eventos · 0 fases · 990 eventos visuais".** rrweb captura, mas
   `session.events` (network/console/error/route) ficam vazios. A timeline da direita
   exibe "Nenhum evento até o ponto atual".
3. **Console logs não aparecem no replay.** Mesma causa do (2): eventos descartados
   silenciosamente antes da primeira `pageDetected`.
4. **Banner "GRAVANDO" só aparece após F5.** Sem broadcast no start, o `useRecording`
   só descobre a mudança no próximo polling de 1 s — e em alguns cenários demora muito
   mais. F5 força re-mount + refresh imediato, mascarando o atraso.

Adicionalmente, o usuário pede que a aba de eventos do replay mostre as requisições
"como no Command Center" — ou seja, com a mesma riqueza visual (DataTable com colunas
status/método/tipo/duração/tamanho), filtrada pelo cutoff temporal do playhead.

## Causas-raiz (mapeadas em código)

| # | Onde | Sintoma |
|---|------|---------|
| 1 | `background.ts:1591` `startDebugging` / `:1697` `stopDebugging` não chamam `recorder.startSession`/`stopSession`. | Lifecycles desacoplados; UI tem dois switches independentes em `SiteHeader` + `RecordingToggle`. |
| 2 | `background.ts:153-161` `currentPhaseId(session)` lança erro se `session.detectionPhases` está vazio. Todos os handlers (console/error/network) chamam essa função e `catch (err)` silencia o throw. | Eventos disparados antes do primeiro `pageDetected` (probe demora) são descartados. rrweb não usa essa função → continua gravando. |
| 3 | `Layout.tsx:242` `<RecordingBanner tabId={…} />` lê de `useRecording`, que faz polling 1 s. Sem broadcast de `recordingStateChanged`, UI fica fora de sincronia até o próximo poll/F5. | Banner aparece tardiamente. |
| 4 | `ReplayPage.tsx:86-88` filtra `session.events` por timestamp ≤ playhead — funciona, mas com lista vazia (consequência do bug 2) nunca renderiza nada. Lista é compacta (`EventRow`) e não rica como o Command Center. | "0 eventos" + visual pobre. |

## Decisões de design

### D1. Acoplar gravação à interceptação

**Decisão:** Iniciar interceptação dispara automaticamente uma sessão de gravação;
parar interceptação encerra a sessão. O switch "Gravação" deixa de ser controle de
start/stop e passa a ser **opt-out de privacidade** (usuário desliga a captura visual
durante uma sessão de debug específica, ex.: páginas com dados sensíveis).

- `startDebugging(tabId)` em `background.ts` chama `recorder.startSession(...)` no
  fluxo final de attach (após enable de Fetch/Network/Runtime). Canvas capture lê o
  default da config de privacidade.
- `stopDebugging()` chama `recorder.stopSession(activeSessionId)` antes do
  `chrome.debugger.detach`. Eventuais sessões pendentes são finalizadas.
- A flag `recordingDisabled` (nova preferência em `chrome.storage.local`, default
  `false`) controla se a gravação acompanha a interceptação. Quando `true`, o
  `startDebugging` não inicia gravação.
- O `RecordingToggle` da `SiteHeader` passa a controlar `recordingDisabled` (em vez
  de start/stop direto). Visualmente: switch desligado = "Gravação desativada para
  esta sessão", ligado = "Gravando junto com a interceptação".
- O dialog `Iniciar gravação` (que pergunta sobre canvas capture) move para
  `Iniciar Interceptação`, exibido apenas se a gravação está habilitada e ainda não
  há preferência salva de canvas. Alternativa: ler de `RedactionConfig.captureCanvas`
  (já existe) e remover o dialog inline.

**Trade-off:** Usuário perde a capacidade de iniciar gravação **sem** debugger
attached. Aceitável — gravação sem interceptação não tem valor prático (perde-se
captura de network) e nenhum fluxo do produto depende disso.

### D2. Bootstrap DetectionPhase em `startSession`

**Decisão:** `recorder.startSession()` cria síncronamente uma DetectionPhase inicial
("bootstrap") antes de retornar. Eventos disparados antes da primeira `pageDetected`
real entram nessa fase.

- Nova fase tem id estável (`bootstrap-${sessionId}`), `startTimestamp = session.startedAt`,
  `kind = 'bootstrap'` (novo discriminante), `pageUrl = '(detectando…)'`,
  `triggerType = 'session-start'`.
- Quando o primeiro `pageDetected` real chega, o handler verifica se a fase ativa é
  bootstrap e a **atualiza in-place** (preenche pageUrl, fingerprint, kind ← detected
  trigger), em vez de criar uma nova. Isso evita poluir a timeline com um marcador
  fantasma.
- Se o `pageDetected` chega em um tab/frame diferente do bootstrap (ex.: redirect),
  cria nova phase normalmente (comportamento atual preservado).
- `currentPhaseId()` deixa de lançar — agora sempre há ≥ 1 fase. Mantemos o throw
  como guarda defensiva (passa a ser unreachable em runtime mas serve como assert).

**Trade-off:** UX da timeline ganha uma fase "detectando…" se a probe nunca disparar
(ex.: tab fechada antes da injeção). Aceitável — sinaliza ao usuário que algo
aconteceu mesmo sem detecção, e os eventos capturados ficam visíveis em vez de perdidos.

### D3. Broadcast `recordingStateChanged`

**Decisão:** `background.ts` broadcasta `recordingStateChanged` via `broadcastToUI`
sempre que: (a) sessão começa, (b) sessão termina, (c) tamanho/duração mudam de
forma significativa (apenas o caso a/b — não broadcastamos ticks; polling continua
para isso). `useRecording` adiciona `chrome.runtime.onMessage` listener que, ao
receber a mensagem, chama `refresh()` imediatamente.

- Action nova `recordingStateChanged` em `messages.ts`.
- Payload: `{ tabId, active, sessionId?, startedAt? }`. `RecordingStatus` derivado
  via `refresh()` consequente — não duplicamos campos.
- Polling de 1 s do hook continua existindo como rede de segurança.

**Trade-off:** Mensagem extra. Custo zero em termos de overhead — Chrome
`runtime.sendMessage` é barato e o listener filtra cedo por action.

### D4. Aba "Requisições" no replay com paridade Command Center

**Decisão:** `ReplayPage` ganha uma quarta tab "Requisições" entre Timeline e
Antipatterns. Renderiza o mesmo `DataTable` + `columns` do Command Center
(`app/src/components/requests/`), mas com a fonte de dados sendo
`session.events.filter(type === 'network')` mapeado para `RequestRow` e
**filtrado pelo cutoff temporal do playhead** (mesma lógica de `cutoffTimestamp`
já presente).

- A aba "Timeline" continua existindo para o fluxo cronológico misto (console +
  network + route). Ela usa `EventRow` compacto.
- Reutilizamos o componente `DataTable` e o array `columns` direto — sem
  duplicação. Único trabalho: função `sessionNetworkEventsToRequestRows(events,
  cutoff)` que adapta o tipo `SessionEvent` (variante network) para `RequestRow`.
- Click em uma linha abre o `ResponseDialog` em modo read-only (sem botões
  Continuar/Modificar — são ações live-only).
- Empty state: "Nenhuma requisição capturada até [tempo]s." com indicação clara
  de que é por causa do playhead (incentiva o usuário a avançar).

**Trade-off:** Mais código compartilhado entre Command Center e Replay. Risco
mínimo — `columns` já é um valor exportado.

## Componentes afetados

### Modificados

- `app/src/entrypoints/background.ts`
  - `startDebugging`: chamar `recorder.startSession` ao final, gated por
    `!recordingDisabled` em `chrome.storage.local`.
  - `stopDebugging`: chamar `recorder.stopSession(activeSessionId)` antes do detach.
  - `currentPhaseId`: lançar continua, mas em runtime é unreachable após D2.
  - Mensagem `startRecording`/`stopRecording`: deprecadas (mantemos por compat
    interna; UI não usa mais para start/stop, só para `recordingDisabled`).
  - Broadcast `recordingStateChanged` em `recorder.startSession`/`stopSession` resolved.
- `app/src/lib/session/recorder.ts`
  - `startSession`: criar bootstrap DetectionPhase. Adicionar campo `kind` ao tipo
    `DetectionPhase`.
  - Novo método `replaceBootstrapPhase(sessionId, payload)`: chamado pelo
    handler de `pageDetected` quando a fase ativa é bootstrap.
- `app/src/lib/session/types.ts`
  - `DetectionPhase.kind?: 'bootstrap' | 'detected'` (default `'detected'` para
    backward-compat com sessões importadas antigas).
- `app/src/types/messages.ts`
  - `MessageAction` ganha `'recordingStateChanged'`.
- `app/src/hooks/useRecording.ts`
  - Adicionar `chrome.runtime.onMessage` listener que chama `refresh()` ao receber
    `recordingStateChanged`.
- `app/src/components/recording/RecordingToggle.tsx`
  - Repropósito: switch agora controla `recordingDisabled` (semântica invertida —
    UI continua "Gravação ON/OFF", storage é `recordingDisabled` por clareza).
  - Dialog de canvas capture: removido daqui, movido para o fluxo de start
    interception OU substituído por leitura da `RedactionConfig.captureCanvas`.
- `app/src/pages/ReplayPage.tsx`
  - Adicionar tab "Requisições" com `DataTable` + `columns` reutilizados.
  - Mapear `session.events` (variante network) → `RequestRow[]`, filtrar por cutoff.
- `app/src/pages/Layout.tsx`
  - Manter `<RecordingBanner />` no mesmo lugar — agora reage rápido por causa
    do broadcast.

### Novos

- `app/src/lib/session/sessionNetworkAdapter.ts` (e `__tests__/`)
  - Função pura `sessionEventsToRequestRows(events, startedAt, cutoffTimestamp)`.
  - Testes cobrindo filtro por cutoff, mapeamento de campos (status, mimeType,
    duration, transferSize quando disponível).

## Storage / migração

- Nova chave `chrome.storage.local.recordingDisabled` (boolean, default `false`).
- Sessões antigas sem `DetectionPhase.kind` continuam carregando — o filtro
  `kind === 'bootstrap'` retorna `false` para elas (campo undefined), nenhuma
  lógica quebra.
- Nenhuma migração de IndexedDB (sessões já gravadas continuam reproduzíveis;
  ganham `0 eventos` se foram afetadas pelo bug 2 — esperado).

## Testes

### Unitários

- `recorder.startSession` cria bootstrap phase e ela é a `currentPhaseId` imediatamente.
- `replaceBootstrapPhase` atualiza in-place quando phase ativa é bootstrap; cria
  nova quando já é `detected`.
- `sessionEventsToRequestRows` filtra por cutoff, omite eventos de outros tipos.
- `useRecording`: ao receber `recordingStateChanged`, chama `refresh()` antes do
  próximo polling.

### Integração

- `startDebugging` → `recorder.startSession` chamada com tabId correto.
- `stopDebugging` → `recorder.stopSession` chamada com sessionId ativo; sessão
  finalizada antes do detach.
- Console event disparado antes do primeiro `pageDetected` é persistido na
  bootstrap phase (não descartado).

### E2E (opcional, follow-up)

- Adicionar a `app/e2e/` um caso "interceptação inicia gravação automaticamente":
  start interception em pokemon.com → verificar `session.events.length > 0` em
  IndexedDB ao parar.

## Não-objetivos

- Reescrever o `EventRow` ou a tab Timeline.
- Mover a gravação para fora do contexto debugger (ex.: gravar sem attach).
- Persistir `recordingDisabled` por tab (é global por extensão).
- Migrar sessões antigas para reincluir eventos perdidos — impossível, dados
  foram dropados.

## Risco

- **Baixo:** mudanças cirúrgicas em pontos bem isolados (lifecycle + bootstrap
  phase + broadcast + nova tab).
- **Mitigação:** suite de 1082 testes existente como base; adicionar +~15 testes
  novos cobrindo cada decisão.

## Plano de fases

Fase única (não há blocking entre as 4 correções, mas Bug 2 é pré-requisito real
do Bug 4 — a aba "Requisições" precisa de eventos). Ordem sugerida:

1. **Bug 2** (bootstrap phase) — desbloqueia replay funcional.
2. **Bug 1** (lifecycle binding) — UX correta a partir daqui.
3. **Bug 3** (broadcast banner) — UI responsiva.
4. **Bug 4** (aba Requisições) — paridade visual com Command Center.

Cada uma terá seus próprios commits e revisões via subagent-driven-development.
