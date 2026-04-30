# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Wizard scaffolding em RuleEditor**: o componente `app/src/components/rules/RuleEditor.tsx` agora segue um padrao de 4 steps (`type` | `matcher` | `action` | `review`) com header clicavel e footer fixo. Use `STEPS`/`STEP_META` como referencia ao adicionar/alterar steps. Em modo edit, todos os steps sao clicaveis; em create, sao linearmente desbloqueados via `maxStepIndexReached`.
- **Deteccao de mudancas para confirmacao de descarte**: snapshot do draft inicial (`JSON.stringify`) eh comparado com o draft atual via `useMemo`. `AlertDialog` em paralelo ao `Dialog` principal para confirmar descarte. Pode ser reaproveitado em outros editores grandes.
- **Dialog grande responsivo**: `className="flex max-h-[85vh] w-[90vw] max-w-[60rem] flex-col overflow-hidden sm:max-w-[60rem]"` no `DialogContent` produz ~960px com cap em 90vw e altura em 85vh com scroll interno via `ScrollArea`.
- **Listagem de regras com shadcn Table**: `app/src/components/rules-lab/RulesList.tsx` usa `Table`/`TableHeader`/`TableBody`/`TableRow` com colunas Ordem (priority numero), Status (toggle), Tipo (Badge colorida via `getActionVisuals`), Matcher (URL+metodo via `getMatcherSummary`), Acao (resumo via `getActionSummary`), Atualizado e Acoes. Linhas individuais ficam em `RuleTableRow.tsx`. A coluna Ordem reflete o indice 1-based na ordem original do array `rules` (passado via prop `orderById: Map<string, number>` calculada em `RulesLab.tsx`) — alinha com a regra "primeira que casa vence" do background.
- **Visuals por tipo de acao**: `getActionVisuals(action)` retorna `iconName`/`label`/`bgClass`/`textClass`/`borderClass` consistentes em toda a UI. Usar em badges, cards e icones para que cada tipo (mock=violet, delay=amber, transform=sky, breakpoint=rose) tenha cor unica.
- **Wildcard matching em URL matcher**: padroes contendo `*` no `UrlMatcher.pattern` (modo nao-regex) sao convertidos para regex via `wildcardToRegex` em `app/src/domain/ruleMatching.ts`, escapando demais meta-caracteres. Padroes sem `*` mantem comportamento de `includes()`. O modo `isRegex: true` continua usando `new RegExp(...)`.
- **Multi-select de metodo HTTP**: `MethodMatcher.method` agora aceita `string | string[]` (array para multi-select com 'ANY' como wildcard especial). `methodMatcherCasaInput` em `ruleMatching.ts` lida com ambos os formatos. Componentes legados (`MatcherEditor`) tratam array via primeiro elemento; novos editores usam array. `getMatcherSummary` em `ruleVisuals.ts` formata array como `GET|POST`.
- **Painel de preview com explainMatchers**: `app/src/domain/ruleMatching.ts` exporta `explainMatchers(matchers, input)` retornando `{overall, checks: [{matcher, pass, reason}]}` para alimentar UIs de preview. Matchers desabilitados aparecem com pass=true mas reason "(desabilitado)" — refletindo o comportamento de runtime que ignora-os mas nao os bloqueia.
- **UnifiedMatcherEditor (URL+method)**: `app/src/components/rules/UnifiedMatcherEditor.tsx` consolida URL pattern + method multi-select em layout 2-col (editor a esquerda, preview a direita) usando `grid lg:grid-cols-[1fr_minmax(0,_22rem)]`. Header/body matchers aparecem em "Matchers avancados" abaixo via legacy `MatcherEditor`. Buscar via `findIndex` em vez de `find` para preservar posicao no array (importante porque ordem do array do schema importa).
- **Validacao reativa em wizard**: `validationErrors: FieldError[]` em `useMemo` (id, message, step) recomputa a cada render do draft. Save button `disabled={hasErrors}` reflete instantaneamente. Step Revisar lista os erros como botoes que pulam para o step relevante via `goToStep(err.step)`. Padrao aplicavel a outros wizards/forms multi-step.
- **Toast custom sem dependencia externa**: `app/src/components/rules-lab/RuleSaveToast.tsx` — `<output aria-live="polite">` fixed bottom-right, barra de progresso via `setInterval` 50ms, botoes Desfazer/Fechar. Sem `sonner`/`react-hot-toast`. Use `<output>` em vez de `<div role="status">` para satisfazer biome `useSemanticElements`.
- **Undo via snapshot pre-mutation**: em `RulesLab.tsx`, antes de chamar `addRule`/`updateRule` no callback `onSave` do RuleEditor, captura `previousRules = rules` (estavel no closure ate proxima rerenderizacao apos setRules). Toast leva esse snapshot; Undo faz `chrome.storage.local.set({rules: previousRules})`. Funciona porque `useRules` reflete `chrome.storage.onChanged` automaticamente.
- **Diff visual via JSON.stringify dos sub-objetos**: `JSON.stringify(rule.matchers) !== JSON.stringify(matchers)` para detectar mudanca em estruturas profundas. Reaproveita `getMatcherSummary`/`getActionSummary` para renderizar "antes -> depois" no mesmo formato da listagem principal — consistencia visual gratuita.
- **Type cards no step Tipo do wizard**: 4 cards (mock, transform, delay, breakpoint) na ordem `ACTION_TYPE_ORDER = ['breakpoint','mock','transform','delay']` em grid `sm:grid-cols-2`. Cada card eh `<button type="button" aria-pressed={isSelected}>` com `data-testid="rule-wizard-type-card-${type}"` + `data-selected="true|false"` para testes/visual. `getActionVisuals(createDefaultActionForType(t))` reaproveita as cores/icones definidos. **Em modo edit**, todos os cards exceto o atual ficam `disabled` (aria-disabled) para impedir mudanca de tipo. **Em modo create**, clicar em outro card chama `setAction(createDefaultActionForType(target))` para resetar a action ao default daquele tipo. Helper `createDefaultActionForType(type)` cobre os 4 tipos com defaults razoaveis (mock 200, delay 1000ms, transform sem patches, breakpoint sem descricao).
- **A11y de cards radio-like**: biome 2.x `lint/a11y/useSemanticElements` rejeita `role="radio"` em `<button>` (sugere `<input type="radio">`). Em UI de cards complexos, usar apenas `aria-pressed={selected}` em vez de role. Sem `role="radiogroup"` no wrapper — o `<fieldset>` + `<legend>` ja agrupam semanticamente.
- **JSONPath subset em `domain/jsonPatcher.ts`**: parser puro que aceita `$`, `.nome` (ident `[A-Za-z_][A-Za-z0-9_]*`), `['nome']`, `["nome"]` e `[N]`. Sem dependencias externas (jsonpath-plus nao foi adicionado). Apply funciona via deep clone + `navigateToParent` retornando `{parent, last}` — escolha proposital de retornar erro tipado em vez de fabricar plausibilidade (alinha com regra "no fallbacks"). Resultados sao tagged unions: `{ok:true,output}` ou `{ok:false,error}`. `applyOperations` adiciona `failedAtIndex` para destacar a operacao culpada na UI.
- **Editor declarativo de Transform**: `app/src/components/rules/TransformActionEditor.tsx` — layout 2-col similar ao UnifiedMatcherEditor (`grid lg:grid-cols-[1fr_minmax(0,_22rem)]`). Coluna esquerda lista operacoes ordenadas com select de tipo, input de path, textarea de valor (oculto para `remove`), botoes up/down/remove. Coluna direita tem textarea de sample input + painel de preview (output JSON ou erro tipado). `useMemo` recomputa `operationValidations` (path/value parse) e `previewResult` a cada render — UI fica reativa. Operacao com erro recebe ring vermelho + bloco "Falhou ao aplicar". Operacoes futuras nao executam apos uma falhar (consistente com runtime).
- **Schema `TransformAction.operations` opcional**: optei por nao migrar destrutivamente os campos legados (`status`, `addHeaders`, `removeHeaders`, `replaceBody`) — ficam preservados ao lado dos novos `mode`/`operations`/`advancedScript`. Editor declarativo apenas grava `mode: 'declarative'` + `operations`, sem tocar nos campos legados (sao espaco morto na UI atual). Helper `createDefaultActionForType('transform')` em `RuleEditor.tsx` agora retorna `{type:'transform', enabled:true, mode:'declarative', operations:[]}` para que regras novas comecem com a forma correta.
- **Parsing de valor JSON estrito (sem fallback string)**: ao contrario do que considerei inicialmente (try parse JSON; se falhar, usar string crua), optei por exigir JSON valido sempre — strings precisam de aspas (`"hello"`). Justificativa: aceitar `hello` como string mascara intenc?o ambigua (usuario pode estar tentando digitar JSON com erro). Texto inline orienta o usuario. Honra a regra "no fallbacks" do projeto.
- **`crypto.randomUUID()` em service worker e jsdom**: disponivel em ambos. Helper `newId()` tem fallback para `Math.random` so para ambientes legados, mas tests/runtime sempre pegam o UUID real.
- **Re-matchar regra no inspector em vez de propagar metadados via InterceptedResponse**: `RequestInspector` chama `findMatchingRuleAction(rules, {url, method, headers: request.request?.headers ?? {}, body: request.request?.postData})` quando `isWaiting=true` para descobrir a regra breakpoint que pausou o request — entao surge o `description` ao usuario. Vantagens: (1) sem schema bloat em `InterceptedResponse`, (2) sempre fresh (se o usuario editou a descricao depois da pausa, reflete imediatamente), (3) zero migracao para registros antigos. Use `request.request?.headers` (nao `request.headers` top-level) porque o quirk documentado eh que top-level header sao response headers (issue #19).
- **Input numerico controlado com validacao sem fallback**: padrao em `app/src/components/rules/DelayActionEditor.tsx` — manter `inputValue` como string local + `error: string | null`. `handleInputChange` valida via regex `/^\d+$/` e `Number.parseInt(...)` antes de propagar `onChange` ao pai. Strings invalidas (vazia, com letras, decimais, negativas) pintam erro inline + nao chamam `onChange` — alinhado com regra "no fallbacks". `useEffect([action.timeMs])` ressincroniza o input quando o pai atualiza (ex.: preset clicado recebe `timeMs` diretamente em props apos `onChange`). Para presets, usar `<Button aria-pressed/data-selected>` em vez de `role=radio` em `<button>` (a11y biome).

---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.1
- US-001: renomeacao destrutiva de `modify` para `transform` em todo o codigo
- Files changed:
  - `app/src/types/rules.ts`: ActionType e ModifyAction → TransformAction (sem alias)
  - `app/src/types/index.ts`: re-export atualizado
  - `app/src/domain/rulesIO.ts`: ACTION_TYPES set
  - `app/src/components/rules/ActionEditor.tsx`: case `transform`, renderTransformActionEditor
  - `app/src/components/rules-lab/ruleVisuals.ts`: case `transform`, label "Transform"
  - `app/src/components/rules-lab/RulesToolbar.tsx`: filter id `transform`
  - `app/src/pages/RulesLab.tsx`: counts.transform
  - `app/src/components/rules-lab/__tests__/{ruleVisuals,RulesToolbar}.test.tsx`: testes atualizados
  - `app/src/lib/legacyMigration.ts`: novo `runModifyToTransformMigration` com idempotencia via `modify_to_transform_migrated_at`; `convertLegacyStorage` tambem renomeia regras existentes `modify` → `transform` no caminho legado
  - `app/src/entrypoints/background.ts`: chama `runModifyToTransformMigration` em onInstalled e onStartup
  - `app/src/lib/__tests__/legacyMigration.test.ts`: 3 novos testes
- **Learnings:**
  - O runner de migracao legada (`runLegacyMigration`) eh idempotente via `legacy_migrated_at` — usuarios que ja rodaram a migracao da v0.7 nao executariam novas conversoes. Para cobrir regras `modify` que possam estar persistidas, criamos `runModifyToTransformMigration` com seu proprio flag de idempotencia (`modify_to_transform_migrated_at`).
  - `convertLegacyStorage` agora processa renames das regras existentes (`input.rules`) e marca `hadLegacyData = true` quando ha regras com `type: 'modify'`, garantindo cobertura mesmo no caminho da migracao primaria (caso o usuario esteja em uma instalacao limpa que nunca rodou nada).
  - Biome formatter prefere uma unica linha para `new Set([...])` curtos — quebrar manualmente provoca erro de formatacao.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.3
- US-003: Redesign da listagem de regras com shadcn Table
- Files changed:
  - `app/src/components/rules-lab/ruleVisuals.ts`: adicionado `borderClass` ao `ActionVisuals` para uso em badges
  - `app/src/components/rules-lab/RuleTableRow.tsx`: novo componente — renderiza `<TableRow>` com colunas Ordem (numero), Status (toggle), Tipo (Badge colorida com icone), Matcher (nome + URL/metodo em code), Acao (resumo em code), Atualizado (data) e Acoes (Editar/Duplicar/Excluir). Linha tem `opacity-50` quando `enabled=false`.
  - `app/src/components/rules-lab/RulesList.tsx`: refatorado de cards para shadcn `Table` + `TableHeader`/`TableBody`. Aceita prop `orderById: Map<string, number>` para exibir prioridade 1-based. Mantem paginacao em 10 itens.
  - `app/src/pages/RulesLab.tsx`: calcula `orderById` via `useMemo` a partir de `rules` (indice + 1) e passa para `RulesList`.
  - `app/src/components/rules-lab/RulesEmptyState.tsx`: CTA renomeado de "Nova regra" para "Criar primeira regra" conforme AC.
  - `app/src/components/rules-lab/RuleListItem.tsx`: removido (substituido por `RuleTableRow.tsx`).
  - `app/src/components/rules-lab/__tests__/RuleListItem.test.tsx`: removido (substituido por `RuleTableRow.test.tsx`).
  - `app/src/components/rules-lab/__tests__/RuleTableRow.test.tsx`: novos 5 testes cobrindo renderizacao de colunas, ordem, switch, opacity quando desabilitada e callbacks de acao. Wrap em `<Table><TableBody>` para HTML valido.
  - `app/src/components/rules-lab/__tests__/RulesList.test.tsx`: atualizado para nova API (`orderById`); novos testes para cabecalhos do Table, coluna Ordem, badges de tipo (mock/delay/transform/breakpoint), toggle de status e botoes de acao.
- **Learnings:**
  - `Badge` do shadcn aceita `variant="outline"` mas suas classes de cor sao sobrescritas pelo `cn()` quando passamos `bgClass+textClass+borderClass`. Padrao `gap-1.5 border` + classes do `getActionVisuals` produz badges com cor consistente entre lista, icone e tema.
  - Renderizar `<RuleTableRow>` (que retorna `<tr>`) isolado em testes gera HTML invalido (`tr` fora de `table`). Solucao: envolver em `<Table><TableBody>{...}</TableBody></Table>` no test setup. Padrao util para testar componentes que retornam `tr/td`.
  - A coluna Ordem deve refletir o indice na lista original (prioridade do background), nao na lista filtrada/sorted da UI. `orderById` calculado em `RulesLab` antes do filtro, passado por prop ate a linha.
  - Biome formatter prefere uma unica linha para JSX curto que cabe em 100 cols. Auto-fix juntou linhas que eu tinha quebrado manualmente.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.9
- US-009: Wizard multi-step em Dialog grande para criacao/edicao
- Files changed:
  - `app/src/components/rules/RuleEditor.tsx`: refatorado de Tabs (Match/Then) para wizard linear de 4 steps (Tipo → Matcher → Acao → Revisar). Header com indicador de progresso clicavel (todos os steps em edit, linear em create); footer fixo com Cancelar/Anterior/Proximo|Salvar. Dialog redimensionado para `max-w-[60rem] w-[90vw] max-h-[85vh]`. Step Tipo mostra resumo + descricao do tipo atual (placeholder ate US-010). Step Revisar exibe sumario com nome/tipo/matcher/acao via helpers existentes (`getActionVisuals`, `getActionSummary`, `getMatcherSummary`). Validacao de save pula o usuario para o step relevante quando falha. AlertDialog confirma descarte se `hasUnsavedChanges` (deteccao via snapshot JSON.stringify do draft).
  - `app/src/components/rules/__tests__/RuleEditor.welcome.test.tsx`: ajustado o teste de save com URL vazia para navegar pelos 3 cliques de Proximo antes de clicar em Adicionar (wizard linear obriga essa sequencia)
  - `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx`: novo arquivo com 10 testes cobrindo header de steps, navegacao linear, preservacao de estado, modo edit clicavel direto, modo create linear, confirmacao de descarte (caminho com e sem mudancas), resumo no Revisar e jump para step Matcher quando validacao falha
- **Learnings:**
  - Biome `useExhaustiveDependencies` eh warning (nao error) mas falha o build do CI? Nao — `npm run lint` retornou exit 0 com warnings; o erro reportado foi do formatter (linhas duplas vs unicas). Para evitar o warning, encapsulei o draft serializado em `useMemo` antes do `useMemo` que computa `hasUnsavedChanges`.
  - O `DialogFooter` shadcn usa `flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2` por padrao. Para o wizard com Cancelar a esquerda e navegacao a direita, sobrescrevi com `!flex-row !justify-between` (precisa do `!` para vencer o sm: do shadcn). Padrao util para outros wizards.
  - O `cameFromWelcome` so deve mostrar o link "Voltar" no step `type` (primeiro step). Caso contrario o usuario poderia voltar para a welcome a partir de qualquer step e perder o draft.
  - Ao re-abrir o dialog em modo edit, `setMaxStepIndexReached(STEPS.length - 1)` desbloqueia todos os steps de uma vez (atende AC "pular direto para qualquer step valido"). Em create, fica em 0 e cresce conforme o usuario avanca via Proximo.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.2
- US-002: Prioridade de matching ordenada (primeira que casa vence)
- O comportamento "primeira que casa vence" ja existia em `findMatchingRuleAction` (loop com `return` na primeira regra mock/breakpoint que casa). Esta US adiciona documentacao explicita + cobertura de teste.
- Files changed:
  - `app/src/domain/ruleMatching.ts`: bloco de comentario acima de `findMatchingRuleAction` documentando a regra de prioridade, comportamento de regras desabilitadas e nota sobre delay/transform (que sao puladas hoje porque o background ainda nao consome esses tipos — quando forem implementados, devem retornar aqui igualmente para preservar a regra).
  - `app/src/entrypoints/background.ts`: novo bloco de comentario no header (logo apos o bloco de persistencia) explicando que o array `rules` e a ordem oficial de avaliacao, que reflete drag-and-drop da UI e que `chrome.storage.onChanged` reabsorve mudancas em tempo real.
  - `app/src/domain/__tests__/ruleMatching.test.ts`: novo `describe('prioridade de matching (primeira que casa vence)')` com 5 testes — duas mock rules casando (primeira vence), mock antes de breakpoint, breakpoint antes de mock, reordenar o array muda quem vence, regra desabilitada nao bloqueia subsequente.
- **Learnings:**
  - `findMatchingRuleAction` ja retornava `MatchedRuleAction` apenas para acoes mock/breakpoint. Acoes delay/transform (que existem no schema mas ainda nao sao consumidas pelo background) NAO interrompem a iteracao hoje — elas nao bloqueariam uma regra mock subsequente. Essa pendencia foi documentada via comentario inline e marcada para revisao quando delay/transform forem implementados de verdade. Nao expandi o escopo para resolver agora porque a acao delay/transform nao tem efeito de runtime ainda — incluir aqui adicionaria comportamento sem cobertura ponta-a-ponta.
  - O array `chrome.storage.local.rules` ja preserva a ordem nativamente (e um `Array<Rule>`) e o listener de `chrome.storage.onChanged` em `background.ts` substitui `rules = changes.rules.newValue || []`, entao reorder em UI vira nova prioridade na proxima request sem trabalho extra.
  - O loop de matching usa `if (!rule.enabled || !rule.action.enabled) continue;` ANTES do `matcherMatches(rule, input)`. Isso significa que uma regra desabilitada e tratada como "inexistente" para fins de prioridade — ela nao bloqueia a regra seguinte mesmo que tenha matchers identicos. Validei via teste explicito.
---



## 2026-04-30 - chrome-extension-debug-buddy-jc0.12
- US-012: Step Matcher unificado com preview ao vivo
- Files changed:
  - `app/src/types/rules.ts`: `MethodMatcher.method` agora aceita `string | string[]` para suportar multi-select
  - `app/src/domain/ruleMatching.ts`: extraido `singleMatcherMatches`, adicionado `wildcardToRegex` (padroes nao-regex com `*` viram regex escapando outros meta-chars), `methodMatcherCasaInput` (suporta string/array/ANY), e novas exports `explainMatchers`/`MatcherCheck`/`MatchersExplanation` para preview
  - `app/src/components/rules/UnifiedMatcherEditor.tsx`: novo componente de 600+ linhas — layout 2-col com editor (URL pattern + Regex toggle + method multi-select via Buttons toggle + erros inline + secao "avancada" para header/body matchers) + painel direito de preview (Input para test URL, Select para test method, output verde/vermelho com ícone, lista por-matcher com check/x/circle)
  - `app/src/components/rules/RuleEditor.tsx`: substitui o `MatcherEditor` por `UnifiedMatcherEditor` no step matcher; remove helpers `addMatcher`/`removeMatcher`/`updateMatcher` (movidos para o UnifiedMatcherEditor); valida que metodo nao esta vazio em `validateForSave`
  - `app/src/components/rules/MatcherEditor.tsx`: ajustado `renderMethodMatcherEditor` para coercer `method: string | string[]` para string no Select (pega 'ANY' se presente, senao primeiro elemento) — preserva tipagem do shadcn Select
  - `app/src/components/rules-lab/ruleVisuals.ts`: `getMatcherSummary` formata array de metodos como `GET|POST` em vez de quebrar com array stringificado
  - `app/src/domain/__tests__/ruleMatching.test.ts`: 9 novos testes — wildcards (4), multi-method (3), explainMatchers (5)
  - `app/src/components/rules/__tests__/UnifiedMatcherEditor.test.tsx`: novo arquivo com 14 testes cobrindo URL input, method toggle (add/remove/ANY-replace), erros inline, preview verde/vermelho, secao avancada de header/body, toggle Regex
- **Learnings:**
  - Biome 2.x classifica `role="status"` em `<div>` e `role="group"` em `<div>` como `lint/a11y/useSemanticElements` (erro). Solucao: trocar por elementos semanticos (`<output>` e `<fieldset>` respectivamente) — `output` aceita `aria-live` natively e `fieldset` aceita `<legend className="sr-only">` para nomear o grupo sem visual.
  - LucideIcon names disponiveis sao restritos pelo registro em `app/src/components/ui/lucide-icon.tsx`. Tentei usar `circle-check`, `circle-x`, `circle-dashed` mas nao estao mapeados — o registro tem `check-circle`, `x-circle`, `circle`. Sempre verificar o ICONS map antes de usar nomes novos. Diagnosticos do TS pegam isso instantaneamente porque `LucideIconName` e um union type strict.
  - `Matcher.method = string | string[]` exige defesa em todo lugar que le `m.method`: `getMatcherSummary` (formatacao), `MatcherEditor` (Select coerce), `validateForSave` (length=0 caso array). Optei por keep-string-or-array em vez de migracao destrutiva para nao quebrar regras existentes — consistente com o `convertLegacyStorage` que sempre escreveu `method: string`.
  - Ao editar wildcards, escapar primeiro os meta-chars regex e SO ENTAO transformar `*` em `.*`. Se trocar a ordem (transformar `*` primeiro), o `.` literal no input do usuario seria escapado errado. Teste explicito (`/api/v1.0/*`) cobre isso para evitar regressao.
  - O `findIndex`+`splice` para mutacoes do array de matchers preserva ordem original — essencial porque rules sao serializadas em `chrome.storage.local` e a ordem do array eh visivel via `getMatcherSummary` e drag-and-drop futuro. Usei isso em vez de `find`+spread.
  - `aria-invalid={urlPatternError || undefined}` e o pattern correto para um boolean attribute em React: passar `false` literal nao remove o atributo, passar `undefined` remove. Importante para que o teste com `toHaveAttribute('aria-invalid', 'true')` funcione.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.18
- US-018: Step Revisar e Salvar com diff em modo edicao + validacao agregada + toast Undo
- Files changed:
  - `app/src/components/rules/RuleEditor.tsx`: substituiu `validateForSave()` (que retornava 1 erro + alert) por `validationErrors` em `useMemo` (lista FieldError[] com `step` para navegacao). `handleSave` agora apenas pula para o primeiro erro como guardiao defensivo (botao ja desabilitado). Step Revisar agora renderiza: card de resumo, secao de diff (so em mode='edit'), e bloco verde "Pronto para salvar" ou bloco vermelho com lista clicavel de erros. Botao Salvar `disabled={isSaving || hasErrors}` com `data-testid="rule-wizard-save"`.
  - `app/src/components/rules/RuleEditor.tsx`: novo `renderDiffSection()` — em `mode='edit'`, compara `rule` original com draft via JSON.stringify e renderiza linhas Nome/Estado/Matcher/Acao com destaque amber/ring quando modificadas. Cada linha tem `data-testid="rule-wizard-diff-row-${id}"` e `data-changed`. Quando nada mudou: bloco neutro `data-testid="rule-wizard-diff-empty"`.
  - `app/src/components/rules-lab/RuleSaveToast.tsx`: novo componente custom de toast (sem dep). Posicao fixed bottom-right, barra de progresso, botao Desfazer + Fechar. Auto-dismiss via `setInterval` em ticks de 50ms. `<output aria-live="polite">` para a11y (em vez de `<div role="status">` que falha biome `useSemanticElements`).
  - `app/src/pages/RulesLab.tsx`: estado `saveToast: { message, previousRules } | null`. Em ambos os `onSave` callbacks de RuleEditor, snapshot de `rules` ANTES de chamar addRule/updateRule. Ao sucesso, popula `saveToast`. `undoLastSave()` faz `chrome.storage.local.set({rules: previousRules})`. Render `<RuleSaveToast>` no fim da pagina.
  - `app/src/components/rules/__tests__/RuleEditor.welcome.test.tsx`: substituido teste `preset selecionado bloqueia save com URL vazia` para validar botao desabilitado + lista de erros (em vez de alert + click).
  - `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx`: rewrote `Salvar valida URL...` para `Save desabilitado e erros agregados quando URL pattern vazio`. Adicionados 5 novos testes: clicar em erro navega para step, modo edit sem alteracoes mostra "nenhuma alteracao" + Save habilitado, modo edit com alteracoes destaca campos modificados, modo create nao renderiza diff, Save habilitado dispara onSave com payload completo.
  - `app/src/components/rules-lab/__tests__/RuleSaveToast.test.tsx`: novos 5 testes (open=false, render basico, click Desfazer, click Fechar, auto-dismiss apos durationMs com fakeTimers).
- **Learnings:**
  - **Validacao reativa via useMemo eh melhor que validateForSave imperativo**: a lista `validationErrors` recomputa toda vez que `name`/`matchers` mudam, e o botao Salvar reflete isso instantaneamente via `disabled={hasErrors}`. O usuario nao precisa "tentar salvar" para descobrir que algo esta errado — os erros aparecem assim que ele chega no step Revisar.
  - **`fireEvent.click` em botao disabled NAO chama onClick**: testing-library respeita `disabled`, entao o teste pode clicar no botao Save desabilitado e validar que `onSave` nao foi chamado, sem precisar de spy em alert. Padrao mais limpo que o anterior.
  - **`<output aria-live="polite">` para toast/snackbar**: biome 2.x `lint/a11y/useSemanticElements` rejeita `<div role="status">`. `<output>` aceita `aria-live` natively e nao precisa de role explicito. Mesma licao da US-012, mas vale lembrar.
  - **Snapshot de `rules` ANTES da mutacao para Undo**: como `addRule`/`updateRule` retornam o estado novo mas nao expoem o anterior, o snapshot precisa ser capturado no callback `onSave` antes da chamada. Funciona porque `rules` no closure de RulesLab eh estavel ate a proxima renderizacao apos `setRules` em useRules.
  - **Diff visual via comparacao JSON.stringify dos sub-objetos**: `JSON.stringify(rule.matchers) !== JSON.stringify(matchers)` eh suficiente para detectar mudancas em arrays/objetos profundos. Usei o mesmo helper `getMatcherSummary`/`getActionSummary` para renderizar o "antes" e "depois", garantindo formato consistente com a listagem principal.
  - **vitest fakeTimers + setInterval**: `vi.useFakeTimers()` + `vi.advanceTimersByTime(5100)` dispara o `setInterval` no toast dentro de `act()`. Sem `act()` o React reclama de update fora dele.

### Reusable patterns (also added to top section):
- **Validacao reativa em wizard**: lista `useMemo` de `FieldError[]` (id, message, step) habilitando navegacao por click + Save disabled. Padrao aplicavel a outros wizards.
- **Toast custom sem dep**: `<output aria-live="polite">` fixed bottom-right, barra de progresso via setInterval, botoes Desfazer/Fechar. ~80 linhas, totalmente testavel.
- **Undo via snapshot pre-mutation**: capturar snapshot do estado no closure ANTES de chamar addRule/updateRule; toast leva o snapshot e restaura via `chrome.storage.local.set`.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.10
- US-010: Step Tipo do wizard com selecao visual em 4 cards
- Files changed:
  - `app/src/components/rules/RuleEditor.tsx`:
    - Atualizei `ACTION_TYPE_DESCRIPTION` para descricoes finais conforme AC ("Nao chama o servidor — retorna a resposta mockada", etc.)
    - Adicionei `ACTION_TYPE_ORDER = ['breakpoint','mock','transform','delay']` e `createDefaultActionForType(type): Action` que retorna defaults para cada um dos 4 tipos
    - Refatorei `renderTypeStep()` substituindo o card unico (placeholder de "proxima entrega") por uma `<fieldset>` + grid `sm:grid-cols-2` com 4 cards. Cada card eh um `<button type="button" aria-pressed={isSelected}>`, mostra icone colorido (via `getActionVisuals`), titulo e descricao. Card selecionado tem ring + border destacada + badge "Selecionado". Em modo edit, cards nao-selecionados ficam `disabled` + opacity reduzida. Em modo create, clicar troca o `action` para `createDefaultActionForType(target)`.
    - Texto explicativo varia entre create ("Escolha o comportamento da regra. Voce pode trocar livremente ate salvar.") e edit ("Em edicao, o tipo nao pode ser alterado — para mudar o tipo, crie uma nova regra.")
  - `app/src/components/rules/__tests__/RuleEditor.wizard.test.tsx`: novo `describe('RuleEditor wizard — step Tipo (cards)')` com 6 testes cobrindo: renderizacao dos 4 cards com descricoes corretas, destaque do card selecionado (data-selected/aria-pressed/badge), troca de tipo em modo create, lock em modo edit (cards desabilitados nao mudam selecao), texto explicativo de edit, e payload correto apos trocar tipo + salvar (delay com timeMs default 1000)
- **Learnings:**
  - **Biome rejeita `role="radio"` em `<button>`**: a regra `lint/a11y/useSemanticElements` quer `<input type="radio">`. Para cards visuais ricos, esse mapeamento eh incompativel. Solucao: usar `<fieldset>`+`<legend>` para agrupar e `aria-pressed={selected}` em cada card-button (toggle button pattern). Funciona como radio-group informalmente — usuario consegue navegar com Tab e ativar com Enter/Space, e screen readers anunciam o estado de selecao via aria-pressed.
  - **`getActionVisuals` aceita `Action` (nao `ActionType`)**: como o tipo Action eh union discriminada por `type`, o switch interno so usa `action.type`. Para iterar pelos 4 tipos sem cast `as Action`, usei `createDefaultActionForType(t)` (que ja temos para outros propositos) — gera um Action minimo valido por tipo.
  - **Defaults conscientes para troca de tipo em create**: ao trocar de Mock para Delay, perder os campos do Mock eh aceitavel porque o usuario esta no step Tipo (ainda nao configurou a action). `createDefaultActionForType` reseta para um estado base claro (mock 200, delay 1000ms, transform vazio, breakpoint vazio), o que mantem o step Acao previsivel.
  - **Em edit nao deletei os cards inativos** — mantive todos os 4 visiveis mas com `disabled` + opacity-50 + cursor-not-allowed. Isso reforca visualmente quais sao as 4 opcoes do produto e por que aquele tipo especifico esta locked, em vez de simplesmente ocultar os outros tres. Texto explicativo em edit ("para mudar o tipo, crie uma nova regra") guia o usuario.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.15
- US-015: Editor de acao Breakpoint com descricao opcional + texto explicativo + surfacing no inspector quando o request eh pausado
- Files changed:
  - `app/src/components/rules/ActionEditor.tsx`: removeu o `Select` legado de "Tipo de Acao" do `renderBreakpointActionEditor` (a troca de tipo agora eh exclusivamente no step Tipo do wizard). Atualizou o texto explicativo do bloco azul para casar verbatim com a AC: "Quando esta regra casar, o request sera pausado e o dialog de inspecao sera aberto para edicao manual da resposta antes de prosseguir". Adicionou hint logo abaixo da textarea de descricao explicando onde a descricao aparece. `data-testid` no editor + textarea + bloco de info para test-friendliness. Removi o `Label> Tipo de Acao </Label>` block — `Select`/`SelectContent` continuam usados nos editores legados de mock e delay (espaco morto que sera removido em US futuras quando estes tiverem seus proprios editores limpos).
  - `app/src/components/command-center/RequestInspector.tsx`: importa `findMatchingRuleAction` de `@/domain/ruleMatching` e calcula `matchedBreakpoint` quando `isWaiting === true`. Renderiza um banner rose acima da area de Tabs com icone `octagon-alert` (mesmo do `getActionVisuals.breakpoint`), titulo "Breakpoint pausou esta requisicao" e a descricao da regra. Sem fallback silencioso: se a regra nao casar mais (ex.: foi removida apos a pausa) ou se a descricao for vazia, o banner simplesmente nao renderiza. Usa `request.request?.headers ?? {}` e `request.request?.postData` para alimentar o `RequestMatchInput`.
  - `app/src/components/rules/__tests__/ActionEditor.test.tsx`: novo `describe('acao Breakpoint')` com 3 testes — render do editor com descricao opcional + texto explicativo, ausencia do Select legado de "Tipo de Acao", e digitar no textarea chama onChange com `description` atualizada. Importa `BreakpointAction` adicionalmente.
  - `app/src/components/command-center/__tests__/RequestInspector.test.tsx`: 3 novos testes — banner aparece com `isWaiting=true` + regra breakpoint + descricao, banner NAO aparece quando regra casa mas nao tem descricao, banner NAO aparece quando `isWaiting=false`.
- **Learnings:**
  - **`InterceptedResponse.headers` vs `InterceptedResponse.request?.headers`**: o quirk documentado no CLAUDE.md (issue #19) eh que `headers` na raiz eh sempre dos response headers; o objeto aninhado `request` carrega request headers separadamente. Para `findMatchingRuleAction` usei `request.request?.headers ?? {}` em vez do top-level `request.headers` — caso contrario o matching de header seria contra os response headers (errado).
  - **Reutilizar `findMatchingRuleAction` no inspector eh mais simples que adicionar `breakpointDescription` ao `InterceptedResponse`**: alternativa seria propagar a descricao via `pendingResponses`/IndexedDB, mas isso aumenta o schema e cria pontos de divergencia (descricao stale se a regra foi editada depois). Re-matchar em runtime no inspector eh sempre fresh e nao requer migrate dos registros antigos.
  - **`pause` nao esta no `LucideIcon` registry**: tentei usar nome `pause` para o banner mas o registry so tem icones explicitamente exportados. Opcoes proximas: `octagon-alert` (que ja eh o icone visual do breakpoint), `stop` (StopCircle), `timer`. Escolhi `octagon-alert` por consistencia visual com o badge da listagem (mesmo icone, mesma rosa palette).
  - **Filter trim().length antes de exibir descricao**: `description?.trim() || undefined` para evitar que strings whitespace-only renderizem o banner vazio. Equivalente a `description?.trim().length ? description.trim() : undefined`, mas o `||` curto eh idiomatico em TS.
  - **Test rule casts `as any`**: testes de RequestInspector ja usavam `as any` para evitar boilerplate de matchers/timestamps. Mantive o padrao para os 3 novos testes — nao introduz novo precedente.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.16
- US-016: Editor de Transform em modo declarativo (JSONPath) com lista de operacoes ordenadas + preview ao vivo
- Files changed:
  - `app/src/types/rules.ts`: novos tipos `TransformOperation`, `TransformOperationType` (`'add'|'remove'|'replace'`), `TransformMode` (`'declarative'|'advanced'`); `TransformAction` ganha `mode?`, `operations?`, `advancedScript?` opcionais (campos legados `status`/`addHeaders`/`removeHeaders`/`replaceBody` preservados)
  - `app/src/types/index.ts`: re-export dos novos tipos
  - `app/src/domain/jsonPatcher.ts`: novo modulo puro — `parseJsonPath` (subset: `$`, `.name`, `['name']`, `[N]`), `parseOperationValue` (JSON estrito), `applyOperation` (clone profundo, sem mutacao do input), `applyOperations` (com `failedAtIndex`). Sem dependencias externas. Toda falha eh erro tipado (`ok: false`), zero fallbacks silenciosos.
  - `app/src/domain/__tests__/jsonPatcher.test.ts`: 42 testes unitarios cobrindo parse, valores, add/remove/replace, root, falhas e nao-mutacao
  - `app/src/components/rules/TransformActionEditor.tsx`: novo componente de ~330 linhas — layout 2-col, lista de operacoes com type select / path input / value textarea (oculto em `remove`) / botoes up/down/remove, painel de preview com sample JSON e saida transformada (ou erro tipado por operacao). Validacao reativa via `useMemo`. `data-testid` em todos os campos para test-friendliness.
  - `app/src/components/rules/__tests__/TransformActionEditor.test.tsx`: 18 testes — empty state, edicao de campos, erros inline (path/valor), reordenar, preview com sample default, preview customizado, erro de runtime exposto, multiplas operacoes em ordem
  - `app/src/components/rules/ActionEditor.tsx`: substitui placeholder `renderTransformActionEditor` (que so oferecia switch para mock/breakpoint) por `<TransformActionEditor>` real
  - `app/src/components/rules/RuleEditor.tsx`: `createDefaultActionForType('transform')` agora retorna `{mode:'declarative', operations:[]}` para que regras novas iniciem com schema correto
  - `app/src/components/rules-lab/ruleVisuals.ts`: `getActionSummary` agora mostra `Transform · N operações` quando ha operations, caindo no resumo legado caso contrario
  - `app/src/components/rules-lab/__tests__/ruleVisuals.test.ts`: 3 novos testes para a nova logica de resumo
- **Learnings:**
  - **Subset proprio de JSONPath > dependencia externa**: avaliei `jsonpath-plus` (recomendado pelo PRD) mas implementei um subset puro de ~190 linhas. Justificativa: o subset cobre 100% dos casos requeridos pelo AC (`$`, `.name`, `['name']`, `[N]`), eh totalmente testavel, mantem o bundle enxuto e elimina risco de regressao por update de dep. A documentacao no header do `jsonPatcher.ts` declara explicitamente o que NAO eh suportado (filtros, descida recursiva `..`, slices) para que ninguem assuma capacidades que nao existem.
  - **Tagged union para resultado**: `OperationResult` e `OperationsResult` retornam `{ok:true, output} | {ok:false, error, failedAtIndex?}`. Isso forca chamadores a discriminar sucesso/falha em compile-time (nao tem como ignorar erro). Pattern consistente com `RulesImportResult` em `rulesIO.ts` e com `explainMatchers` em `ruleMatching.ts`.
  - **Validacao de path/valor separada da execucao**: `validateOperation` faz so o parse (sintatico) — nao executa. A execucao (`applyOperation`) re-faz o parse internamente. Isso permite que a UI mostre erros vermelhos imediatamente sem precisar de sample input valido. Trade-off: parse roda 2x quando o sample eh valido — irrelevante na escala de operacoes humanas.
  - **JSON parsing estrito do valor**: optei por exigir JSON valido sempre (strings precisam de aspas) em vez de "try JSON parse; se falhar, usar string". Por que: a regra "no fallbacks" do projeto se aplica aqui — ambiguidade entre "usuario digitou string mal" vs "usuario digitou JSON quebrado" eh perigosa. Texto inline `'"texto entre aspas" ou {"chave": "valor"}'` ja orienta. Os testes `parseOperationValue` cobrem ambos os caminhos (aceitar JSON valido e rejeitar `hello`).
  - **Sample default no preview eh data realista, nao zerada**: pre-popular o textarea com `{"id":42,"name":"Alice","tags":["admin","beta"]}` significa que o usuario chega no editor e ja ve a saida transformada para qualquer operacao tipica — nao precisa colar JSON antes de validar a regra. Mais util que sample vazio.
  - **`previewResult` cobre tres caminhos de erro**: (1) sample JSON invalido, (2) operacao com path/valor invalido, (3) operacao com erro de runtime (chave nao existe, indice fora dos limites). Cada caminho mostra mensagem distinta. O `failedAtIndex >= 0` no preview fica destacado tambem na linha da operacao culpada via `data-failed="true"` + ring vermelho — feedback duplo, alinha o erro do painel com a operacao especifica.
  - **`Object.hasOwn` nao disponivel em ES2020**: tsconfig do projeto usa target/lib ES2020. `Object.hasOwn` eh ES2022. Alternativa portavel: `Object.prototype.hasOwnProperty.call(obj, key)` — funciona em qualquer target. Lembrete de checar `lib` antes de usar APIs novas do ECMAScript.

### Reusable patterns (also added to top section):
- **JSONPath subset em `domain/jsonPatcher.ts`**: parser sem deps, tagged union, sem mutacao do input.
- **Editor declarativo com preview reativo**: layout 2-col + `useMemo` para validacoes + `useMemo` para preview que se autocorrige a cada keystroke.
- **Parsing de valor JSON estrito**: prefere erro a fallback ambiguo.
---


## 2026-04-30 - chrome-extension-debug-buddy-jc0.14
- US-014: Editor de acao Delay com input em ms + presets clicaveis (500ms, 1s, 3s, 5s, 10s)
- Files changed:
  - `app/src/components/rules/DelayActionEditor.tsx`: novo componente dedicado. Input numerico controlado (string local + erro inline), 5 presets como `<Button>` com `aria-pressed/data-selected`, painel explicativo amber (cor visual do tipo Delay) com texto "O servidor remoto sera chamado normalmente; a resposta sera segurada por X ms antes de devolver ao cliente". Sem fallback silencioso: valores invalidos (negativos, decimais, vazios, nao numericos) param em erro inline e NAO propagam onChange — alinhado com a regra "no fallbacks" do projeto.
  - `app/src/components/rules/ActionEditor.tsx`: substituido o placeholder `renderDelayActionEditor` (que so mostrava um Select de "Tipo de Acao" sem editar timeMs) pelo novo componente `DelayActionEditor`. Removido `createEmptyMockAction` (era usado apenas pelo placeholder antigo).
  - `app/src/components/rules/__tests__/DelayActionEditor.test.tsx`: 12 testes cobrindo (1) entrada numerica valida, (2) aceita 0, (3) rejeita negativo/string/vazio/decimal, (4) presets exigidos renderizados, (5) clique em preset emite onChange, (6) preset selecionado destacado por aria-pressed, (7) clicar em preset limpa erro de input, (8) texto explicativo correto e dinamico.
- **Learnings:**
  - O placeholder anterior (`renderDelayActionEditor`) nao tocava em `timeMs` — apenas oferecia um Select para mudar o tipo da acao para mock/breakpoint. Como o wizard novo (US-010) ja faz a selecao de tipo no step "Tipo", esse Select virou ruido. Confirmar que removemos sem regressao via teste end-to-end (RuleEditor.wizard).
  - Em validacao de Input numerico controlado, a estrategia que funciona melhor e: manter `inputValue` como string local + propagar `onChange` ao pai SO quando a string casa o regex `/^\d+$/`. Sincronizar de volta via `useEffect` quando o pai muda `action.timeMs` (ex.: clique em preset re-renderiza com novo timeMs vindo do pai). Tentei inicialmente delegar tudo para `onChange` e ler de volta, mas isso colide com o caso "string parcial enquanto digita" (ex.: o usuario apaga `1000` e digita `2`, no meio do caminho a string fica vazia/`2`).
  - Biome 2.x `lint/a11y/useSemanticElements` ainda rejeita `role="group"` em `<div>` quando o conteudo equivale a `<fieldset>` — usei `<fieldset><legend>` para agrupar os presets, sem custo visual extra (legend ja serve de label).
  - Cor amber (definida em `getActionVisuals` para o tipo `delay`) reaproveitada no painel info para consistencia visual com a badge da listagem.
  - O texto explicativo do PRD usa "será" (ASCII `sera` no acceptance criteria) — escrevi com diacriticos corretos no codigo, conforme a regra do projeto sobre pt-BR.
---
