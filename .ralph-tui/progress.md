# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Wizard scaffolding em RuleEditor**: o componente `app/src/components/rules/RuleEditor.tsx` agora segue um padrao de 4 steps (`type` | `matcher` | `action` | `review`) com header clicavel e footer fixo. Use `STEPS`/`STEP_META` como referencia ao adicionar/alterar steps. Em modo edit, todos os steps sao clicaveis; em create, sao linearmente desbloqueados via `maxStepIndexReached`.
- **Deteccao de mudancas para confirmacao de descarte**: snapshot do draft inicial (`JSON.stringify`) eh comparado com o draft atual via `useMemo`. `AlertDialog` em paralelo ao `Dialog` principal para confirmar descarte. Pode ser reaproveitado em outros editores grandes.
- **Dialog grande responsivo**: `className="flex max-h-[85vh] w-[90vw] max-w-[60rem] flex-col overflow-hidden sm:max-w-[60rem]"` no `DialogContent` produz ~960px com cap em 90vw e altura em 85vh com scroll interno via `ScrollArea`.
- **Listagem de regras com shadcn Table**: `app/src/components/rules-lab/RulesList.tsx` usa `Table`/`TableHeader`/`TableBody`/`TableRow` com colunas Ordem (priority numero), Status (toggle), Tipo (Badge colorida via `getActionVisuals`), Matcher (URL+metodo via `getMatcherSummary`), Acao (resumo via `getActionSummary`), Atualizado e Acoes. Linhas individuais ficam em `RuleTableRow.tsx`. A coluna Ordem reflete o indice 1-based na ordem original do array `rules` (passado via prop `orderById: Map<string, number>` calculada em `RulesLab.tsx`) — alinha com a regra "primeira que casa vence" do background.
- **Visuals por tipo de acao**: `getActionVisuals(action)` retorna `iconName`/`label`/`bgClass`/`textClass`/`borderClass` consistentes em toda a UI. Usar em badges, cards e icones para que cada tipo (mock=violet, delay=amber, transform=sky, breakpoint=rose) tenha cor unica.

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
