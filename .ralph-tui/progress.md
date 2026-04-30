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
