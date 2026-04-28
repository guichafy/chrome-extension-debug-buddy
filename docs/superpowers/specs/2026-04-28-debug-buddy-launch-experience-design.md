# Debug Buddy Launch Experience Design

Data: 2026-04-28
Status: Aguardando revisão do usuário

## Resumo

Esta spec define a nova experiência de lançamento do Debug Buddy: uma ferramenta que deve se sentir como um “HTTP Toolkit dentro do Chrome”, mantendo como requisito central ser um proxy visual rápido para desenvolvedores frontend.

A entrega aprovada é a abordagem **Produto de Lançamento Faseado**:

- **Command Center** como tela principal de investigação em tempo real.
- **Request Inspector** lateral persistente no lugar do modal como superfície padrão.
- **Quick Mock** como momento principal: transformar tráfego real em regra/mock em segundos.
- **Rules Lab** como experiência dedicada para refinar regras, presets e ações.
- **Pacote enxuto de features de lançamento**: presets de falha/latência, replay básico de resposta salva e export/import de regras.
- **Fundação visual anti-regressão** para impedir bugs de ícones, overflow, truncamento e CSS em modais, inspector, side panel e páginas principais.

## Objetivos

1. Dar ao usuário uma visão contínua do tráfego interceptado, com seleção rápida de request e detalhes persistentes.
2. Permitir criar mocks a partir de tráfego real com defaults seguros e revisão clara do que será salvo.
3. Tornar o gerenciamento de regras uma experiência própria, inspirada em “lab”, não apenas uma tabela.
4. Adicionar features suficientes para a entrega parecer lançamento: presets, replay básico e export/import.
5. Reduzir dependência de modais para leitura de request e evitar regressões visuais como ícones renderizados como texto gigante.
6. Preservar a arquitetura do projeto: background como autoridade de runtime, IndexedDB como histórico durável e `chrome.storage.local` como fonte das regras.

## Não Objetivos

- Não implementar sessões nomeadas, snapshots completos ou colaboração nesta primeira entrega.
- Não criar replay avançado com reexecução de request real via rede; o replay inicial é visual/funcional sobre a resposta salva.
- Não resolver i18n completo da issue #3 neste pacote.
- Não reescrever o background inteiro nem mudar o modelo de persistência principal.
- Não manter o modal atual como centro da experiência de leitura de request.

## Contexto Atual

O app hoje tem três áreas principais:

- `Settings`: regras configuradas.
- `Requests`: pendências interceptadas.
- `RequestHistory`: histórico persistido em IndexedDB.

O background script é a autoridade para estado runtime e escrita:

- Captura via `chrome.debugger` + Fetch/Network domains.
- Escreve em `allRequests` e IndexedDB por `persistRequest`/`patchRequest`.
- Envia eventos para UI (`newRequest`, `requestUpdated`, `newPendingResponse`).

A UI é leitora reativa:

- `useAllRequests` lê IndexedDB, escuta mensagens e re-sincroniza.
- `useResponses` lida com pendências e ações de aprovação/ignorar.
- `useRules` faz CRUD das regras em `chrome.storage.local`.

A nova experiência deve reaproveitar esse contrato, evitando que componentes de UI escrevam diretamente no histórico.

## Arquitetura Da Experiência

### Command Center

O Command Center substitui a separação mental entre “pendências” e “histórico” por uma única superfície de trabalho.

Ele contém:

- Top bar com aba alvo, estado de interceptação, contagem de pendências e ação iniciar/parar.
- Timeline/tabela central de requests capturadas.
- Filtros rápidos por status, método, tipo, mockadas, falhas e pendentes.
- Busca global por URL, método, status, MIME type e termos do corpo quando disponível.
- Live tail com opção de pausar auto-refresh.
- Seleção de request que atualiza o inspector lateral sem abrir modal.

As linhas da timeline devem destacar:

- Método.
- URL truncada de forma previsível.
- Status e status text quando reais.
- Duração real quando disponível.
- Estado: proxy, aguardando, modificada, mockada, falha de captura.

### Request Inspector

O inspector lateral é a nova superfície padrão para ler e agir sobre uma request.

Ele mostra:

- Header compacto com método, URL, status, duração e estado.
- Quick Mock no topo quando a request permite gerar regra.
- Abas/seções para visão geral, request headers, response headers, body, preview e timing.
- Estados explícitos para body indisponível, erro de captura e request incompleta.
- Ações rápidas: criar mock, abrir no Rules Lab, replay básico, copiar dados não sensíveis e ignorar/aprovar quando pendente.

Modais e drawers ficam reservados para:

- Confirmações destrutivas.
- Import/export.
- Edição de payload grande.
- Visualizações que exigem foco amplo, como body muito extenso ou imagem grande.

### Rules Lab

Rules Lab é a área dedicada para criar, revisar e operar regras.

Ele contém:

- Lista de regras ativas, pausadas e com erro de validação.
- Cards de presets para falha, latência, timeout, resposta vazia e payload quebrado.
- Editor de matchers e actions.
- Área de revisão da regra criada pelo Quick Mock.
- Export/import de regras.
- Ações para duplicar, ativar/desativar, editar e remover regras.

O Rules Lab deve usar a mesma estrutura canônica `Rule[]` existente em `app/src/types/rules.ts`.

## Quick Mock

Quick Mock é o momento principal da entrega.

### Default Seguro

Ao selecionar uma request e acionar Quick Mock, o app gera uma sugestão de regra com:

- Matcher de método obrigatório.
- Matcher de URL baseado em host + pathname.
- Query string ignorada inicialmente.
- Ação `mock` baseada na resposta real capturada.

Esse default evita regras frágeis por query dinâmica e reduz risco de match amplo demais.

### Header Matchers

O Quick Mock deve permitir match por headers no próprio inspector.

Comportamento:

- A UI mostra “Adicionar header matcher”.
- O usuário escolhe manualmente headers capturados.
- Headers sensíveis, como `authorization`, `cookie`, `set-cookie` e chaves semelhantes, devem aparecer mascarados e desmarcados.
- Nenhum header entra como matcher automaticamente.
- A regra salva inclui `HeaderMatcher` com `headerType` correto (`request` ou `response`).

### Falhas Visíveis

Quick Mock não deve criar regra quando faltar dado exigido.

Exemplos:

- Sem método HTTP original.
- Body indisponível quando a ação mock precisa reproduzir um corpo real. Resposta realmente vazia é válida quando capturada como vazia.
- Erro de captura.
- Headers selecionados sem valor real.

Nesses casos, a UI mostra erro tipado e orienta o próximo passo. Não deve haver fallback silencioso nem dado fabricado.

### Pós-Salvamento

Ao salvar:

- A regra entra em `chrome.storage.local.rules`.
- A request selecionada ganha indicação visual de que gerou mock.
- O inspector mostra confirmação.
- A UI oferece abrir a regra recém-criada no Rules Lab.

## Features Do Pacote De Lançamento

### Presets De Falha E Latência

Rules Lab deve oferecer presets para:

- Erro HTTP comum (`500`, `404`, `401`, `403`).
- Latência fixa.
- Latência por intervalo.
- Timeout/simulação de resposta muito lenta, quando compatível com o fluxo atual.
- Resposta vazia.
- Payload JSON quebrado.

Presets criam regras editáveis. Eles não devem aplicar comportamento oculto fora do schema `Rule`.

### Replay Básico

Replay básico significa reabrir/visualizar a resposta salva sem depender de nova captura.

Escopo inicial:

- Reexibir headers/body/status de uma request salva.
- Comparar visualmente “capturado” vs “mock atual” quando a request já gerou regra.
- Permitir copiar ou usar a resposta salva como base para novo mock.

Fora do escopo inicial:

- Reenviar request pela rede.
- Reproduzir sequência inteira de sessão.
- Reexecutar autenticação ou side effects.

### Export/Import De Regras

Rules Lab deve permitir:

- Exportar `Rule[]` para JSON.
- Importar JSON validado.
- Rejeitar arquivo inválido com erro claro.
- Mostrar preview antes de substituir ou mesclar regras.

Import não deve sobrescrever regras silenciosamente. A escolha entre merge/substituição deve ser explícita.

## Fundação Visual E Shadcn

### Ícones

A implementação deve seguir o padrão shadcn do projeto:

- Usar a `iconLibrary` configurada pelo shadcn. Na prática atual do projeto, a dependência disponível é `lucide-react`; o plano de implementação deve confirmar com `npx shadcn@latest info --json`.
- Ícones devem ser componentes importados, não strings passadas para lookup.
- Em `Button`, ícones usam `data-icon="inline-start"` ou `data-icon="inline-end"`.
- Não aplicar classes manuais de tamanho em ícones dentro de primitives shadcn; o componente deve controlar o sizing.
- Novas superfícies não devem depender do wrapper atual `Icon` baseado em fonte Material Icons.

Esse ponto é obrigatório para evitar o bug em que uma fonte ausente transforma o nome do ícone em texto visível/gigante, como no botão de fechar visto no modal.

### Layout E Overflow

Regras de UI:

- Headers de request usam grid com colunas fixas para método/ações e `minmax(0, 1fr)` para URL.
- URLs longas usam truncamento previsível e tooltip quando útil.
- Body, headers longos e previews têm áreas scrolláveis próprias.
- O footer e as ações nunca devem ser empurrados para fora por conteúdo longo.
- Botões de ícone têm dimensões estáveis.
- Texto dentro de botões não pode quebrar o layout em desktop, side panel ou largura estreita.
- Evitar cards aninhados. Command Center deve parecer uma superfície de trabalho, não uma coleção de cards empilhados.

### Responsividade

Breakpoints obrigatórios:

- Desktop largo.
- Desktop comum.
- Side panel/tablet.
- Largura estreita.

Em largura estreita:

- Timeline continua utilizável.
- Inspector pode virar painel abaixo ou drawer, mas não modal obrigatório para cada clique.
- Ações principais permanecem acessíveis.

## Arquitetura Técnica

### Componentes Propostos

- `CommandCenterPage`: compõe timeline, filtros, live tail e inspector.
- `RequestTimeline`: renderiza lista/tabela de requests.
- `RequestInspector`: mostra detalhe persistente e ações rápidas.
- `QuickMockPanel`: gera e salva regra sugerida.
- `RulesLabPage`: gerencia presets, regras e import/export.
- `RulePresetCard`: cria drafts de regras a partir de presets.
- `RuleDraftSummary`: mostra o que será salvo antes de persistir.

### Funções Puras E Domínio

Criar funções puras para evitar lógica de regra espalhada pela UI:

- `buildQuickMockDraft(request, options)`:
  - Entrada: `InterceptedResponse` e opções selecionadas pelo usuário.
  - Saída: `{ ok: true, ruleDraft }` ou `{ ok: false, error }`.
- `validateRuleImport(value)`:
  - Valida shape do JSON importado.
- `createPresetRule(preset, baseMatcher?)`:
  - Cria regra editável a partir de preset.

Essas funções devem ficar em `domain/` ou `lib/` conforme o padrão do projeto e ter testes unitários.

### Tipos E Mensagens

Novas ações entre UI e background devem ser adicionadas em `app/src/types/messages.ts`.

Possíveis mensagens:

- `createRuleFromRequest` se a criação precisar passar pelo background.
- `exportRules` não precisa de background se ler de `chrome.storage.local` pela UI.
- `importRules` pode usar o fluxo existente de `useRules`, desde que valide antes.

A implementação deve escolher o menor caminho compatível com a autoridade atual:

- Histórico continua sendo escrito pelo background.
- Regras continuam em `chrome.storage.local`.
- UI pode criar/editar regras pelo hook existente, desde que a validação seja explícita.

### Persistência

Sem mudança de banco obrigatória.

Possíveis extensões:

- Marcar request que gerou mock com campo derivado em UI, ou persistir `generatedRuleId` se isso for necessário para reabrir vínculo depois.
- Se persistir novo campo em `InterceptedResponse`, atualizar tipos, IndexedDB consumers e testes.

Qualquer novo campo deve representar dado real. Não usar hash, timestamp ou placeholder para simular vínculo.

## Tratamento De Erros

Erros devem ser visíveis e específicos.

Casos obrigatórios:

- Body indisponível.
- Método ausente.
- Header selecionado sem valor.
- JSON de import inválido.
- Falha ao salvar regra em `chrome.storage.local`.
- Falha ao persistir request.
- Request com `captureError`.

O app não deve:

- Retornar string vazia para body que falhou ao decodificar.
- Inventar status phrase.
- Continuar request modificada depois de erro de modificação sem informar o usuário.
- Criar matcher com `ANY` quando método for exigido.

## Testes E Verificação

### Unitários

Adicionar testes para:

- `buildQuickMockDraft` com método + host + pathname.
- Query ignorada por padrão.
- Header matchers selecionados manualmente.
- Headers sensíveis mascarados/desmarcados.
- Erros tipados quando método/body/header faltarem.
- Presets de falha e latência.
- Validação de import/export.

### UI

Adicionar testes com React Testing Library para:

- Command Center renderizando lista e inspector.
- Seleção de request atualizando inspector sem modal.
- Quick Mock mostrando preview de regra.
- Seleção manual de header matcher.
- Salvamento chamando `useRules`/persistência esperada.
- Rules Lab renderizando presets, regras e ações.
- Estados vazios e erros.

### Visual

Antes de concluir a implementação:

- Rodar build.
- Abrir a aplicação local/extension build quando aplicável.
- Capturar screenshots em desktop, side panel/tablet e largura estreita.
- Verificar especificamente:
  - Ícones renderizam como SVG/componentes, não texto.
  - Botão de fechar tem dimensão estável.
  - URLs longas truncam corretamente.
  - Body/headers longos não quebram header/footer.
  - Inspector não sobrepõe timeline.
  - Rules Lab mantém densidade e leitura.

### CI

Comandos esperados a partir de `app/`:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`

## Relação Com Issues Abertas

- #3 i18n fica fora deste pacote.
- #6 versão no sidebar pode ser incluída como polish se a implementação tocar o footer/sidebar, mas não é requisito central desta spec.

## Critérios De Aceite

1. Usuário consegue iniciar interceptação, selecionar uma request e ver detalhes no inspector sem abrir modal.
2. Usuário consegue criar mock a partir de uma request real pelo Quick Mock.
3. Regra criada usa método + host + pathname por padrão.
4. Usuário consegue adicionar matcher por headers manualmente.
5. Headers sensíveis não entram automaticamente e não são expostos sem intenção.
6. Rules Lab permite revisar e editar a regra criada.
7. Presets de falha/latência criam regras editáveis.
8. Export/import de regras valida dados e pede escolha explícita para merge/substituição.
9. Replay básico permite reabrir/usar resposta salva como base de mock.
10. Ícones seguem o padrão shadcn e não dependem de fonte Material Icons nas novas superfícies.
11. Layout passa por verificação visual em breakpoints críticos.
12. Lint, typecheck, build e testes ficam verdes.

## Plano De Implementação Posterior

Após aprovação desta spec, o próximo passo é criar um plano detalhado com a skill `writing-plans`. O plano deve decompor a entrega em fases pequenas, provavelmente nesta ordem:

1. Fundação visual/shadcn e substituição de ícones nas superfícies tocadas.
2. Funções puras de Quick Mock e testes.
3. Command Center + Request Inspector.
4. Quick Mock integrado.
5. Rules Lab + presets.
6. Export/import e replay básico.
7. Verificação visual e hardening.
