# SelectTabDialog — Redesign de busca, filtros e densidade

Data: 2026-04-28
Status: Aguardando revisão do usuário

## Resumo

Reescrever o `SelectTabDialog` (`app/src/components/SelectTabDialog.tsx`) — o modal que o usuário usa para escolher qual aba o `chrome.debugger` vai atacar — para que ele seja utilizável quando há muitas abas abertas. O dialog atual mostra apenas título + URL com tooltip e altura fixa de 300 px, sem busca nem filtro, o que torna a escolha custosa em sessões reais de desenvolvimento.

A nova versão entrega:

- Modal maior (`max-w-4xl`, ~896 px × `max-h-[85vh]`) com lista interna scrollável.
- Barra de busca por título e URL no topo, com atalho `/` para focar.
- Chips de filtro de domínio gerados a partir das abas atuais, com contagem por domínio e chip "Todos" como reset.
- Linha de aba em densidade "padrão" (favicon 20 px + título + URL truncada + chip de domínio + seta), preservando ordem das abas do Chrome.
- Badge "Atual" destacando a aba já selecionada como `targetTab`.
- Navegação por teclado (`↑/↓ Enter Esc /`) e estados explícitos de carregamento, vazio, sem-resultado e erro.

A entrega mantém o escopo atual de janelas (`currentWindow: true`) e não toca em `background.ts`, `useDebugging` nem na persistência de `targetTabInfo`.

## Objetivos

1. Tornar viável a seleção de aba quando o usuário tem muitas abas abertas, sem precisar fechar abas só para encontrar a certa.
2. Reduzir ambiguidade entre abas com mesmo título mostrando título e URL juntos na linha (caso clássico: vários `localhost:*`).
3. Permitir restringir rapidamente a lista por domínio sem digitar, via chips clicáveis.
4. Permitir fluxo 100 % por teclado (`/` para buscar, setas para navegar, Enter para confirmar, Esc para fechar).
5. Sinalizar visualmente a aba já selecionada como alvo (`targetTabInfo`), para o usuário entender em qual aba ele está antes de trocar.
6. Cumprir a regra do projeto "sem fallbacks": qualquer falha do `chrome.tabs.query` ou URL inválida deve ser visível, não silenciada.

## Não Objetivos

- Não suportar múltiplas janelas (mantém `currentWindow: true`).
- Não persistir filtros/busca entre aberturas do dialog.
- Não adicionar listener live em `chrome.tabs.onUpdated`/`onRemoved` para reagir a mudanças enquanto o dialog está aberto — a query é feita uma vez na abertura.
- Não introduzir biblioteca de virtualização (lista pequena, paginação não justificada).
- Não adicionar filtros de estado (audível, fixada, ativa) nem agrupamento por janela.
- Não tocar em `background.ts`, `useDebugging`, fluxo de attach do debugger ou esquema de `targetTabInfo` em `chrome.storage.local`.
- Não alterar o componente `SiteHeader` que dispara o dialog nem a mensagem `openSelectTabDialog`.

## Contexto Atual

O `SelectTabDialog` é montado em `app/src/pages/Layout.tsx:44-48` e é aberto por dois caminhos:

- Clique no botão "Selecionar aba" do `SiteHeader` (passado via `onSelectTabClick`).
- Mensagem `openSelectTabDialog` enviada pelo `background.ts:214` quando o usuário tenta iniciar a depuração sem uma aba alvo.

A confirmação chama `onSelectTab(tabId, tabTitle, tabUrl)` que envia `{ action: 'setTargetTab', ... }` para o background — fluxo que **não muda** nesta entrega.

A implementação atual (`app/src/components/SelectTabDialog.tsx`) tem todos os limites listados em "Resumo": query única em `chrome.tabs.query({ currentWindow: true })`, filtragem inline de `chrome://` e `chrome-extension://`, lista de altura fixa em 300 px com título e URL apenas via tooltip, sem busca ou filtros, sem destaque de aba já selecionada, sem navegação por teclado.

## Decisões fechadas no brainstorm

Estas escolhas saíram da sessão de brainstorming (mockups em `.superpowers/brainstorm/`) e são pré-requisito da implementação:

- **Escopo de janelas:** `currentWindow: true` — sem mudança.
- **Filtros:** busca por texto + chips de domínio (single-select), com chip "Todos" como reset. Sem filtro de estado, sem multi-select.
- **Densidade da linha:** padrão de 2 linhas — favicon 20 px à esquerda, bloco título/URL no meio, chip de domínio + seta `›` à direita.
- **Tamanho do modal:** `max-w-4xl` × `max-h-[85vh]`. `DialogContent` usa `flex-col`; `TabList` é `flex-1` com `overflow-y-auto`, ocupando todo o espaço disponível sob a toolbar e acima do rodapé (sem altura fixa).
- **Ordem da lista:** ordem do Chrome (preservar `tab.index`) — espelha a barra de abas do navegador.
- **Indicador de aba atual:** badge verde "Atual" quando `tab.id === targetTabInfo.tabId`.
- **Atalho de busca:** `/` foca o input quando o foco não está em outro `<input>`/`<textarea>`.

## Arquitetura

### Estrutura de arquivos

A implementação atual tem ~180 linhas e vai aproximadamente dobrar. O componente é dividido em sub-componentes co-locados, todos sob `app/src/components/select-tab/`:

```
app/src/components/select-tab/
├── SelectTabDialog.tsx          # container: estado, query, atalhos globais
├── TabSearchBar.tsx             # input de busca com ícone e atalho `/`
├── DomainChipFilter.tsx         # barra de chips com contagem
├── TabList.tsx                  # lista com role="listbox" + scroll
├── TabRow.tsx                   # uma linha (favicon, título, URL, chip, badge)
├── EmptyState.tsx               # mensagens de vazio / sem-resultado / erro
├── hooks/
│   └── useFilteredTabs.ts       # query + filtros derivados
└── __tests__/
    ├── SelectTabDialog.test.tsx
    ├── DomainChipFilter.test.tsx
    ├── TabSearchBar.test.tsx
    └── useFilteredTabs.test.ts
```

O arquivo antigo `app/src/components/SelectTabDialog.tsx` é removido. O import em `app/src/pages/Layout.tsx:3` passa a apontar para `../components/select-tab/SelectTabDialog`.

### Componentes

**`SelectTabDialog`** — props idênticas às atuais (`open`, `onOpenChange`, `onSelectTab`). Responsabilidades:

- Disparar `useFilteredTabs` quando `open === true`.
- Manter estado local: `query` (string), `activeDomain` (string | null, `null` = "Todos"), `focusedIndex` (number).
- Carregar `targetTabInfo` de `chrome.storage.local` na abertura para destacar a aba atual.
- Registrar handlers de teclado globais (`/`, `↑`, `↓`, `Enter`) enquanto o dialog está aberto.
- Resetar `query`, `activeDomain` e `focusedIndex` a cada `open` → `true`.
- Renderizar `TabSearchBar`, `DomainChipFilter`, `TabList` ou `EmptyState`, e o rodapé com dicas de teclado.

**`TabSearchBar`** — recebe `value`, `onChange`, `count` (número de abas filtradas). Renderiza `<input>` com ícone de lupa e badge `/` à direita indicando o atalho. Foco controlado via `ref` exposto pelo container.

**`DomainChipFilter`** — recebe `domains: { name: string; count: number }[]`, `total: number`, `active: string | null`, `onChange: (domain: string | null) => void`. Renderiza chip "Todos" + um chip por domínio em ordem de contagem decrescente. Usa `<button>` com `aria-pressed`.

**`TabList`** — recebe `tabs: Tab[]`, `focusedIndex`, `currentTabId: number | null`, `onSelect`. Renderiza `role="listbox"` com `aria-activedescendant` apontando para a linha focada. Scroll-into-view automático para a linha focada.

**`TabRow`** — recebe `tab`, `isFocused`, `isCurrent`, `onSelect`. Renderiza favicon (`<img src={tab.favIconUrl}>` com fallback para placeholder neutro caso ausente — o "fallback" aqui é apenas visual, não esconde erro), título, URL truncada, chip de domínio, badge "Atual" se `isCurrent`, e seta `›`. Linha inteira é clicável.

**`EmptyState`** — recebe `variant: 'loading' | 'no-tabs' | 'no-results' | 'error'`, `query?: string`, `error?: Error`, `onClearSearch?: () => void`. Renderiza a mensagem apropriada.

### Hook `useFilteredTabs`

Assinatura:

```ts
function useFilteredTabs(open: boolean, query: string, activeDomain: string | null): {
  state: 'loading' | 'ready' | 'error';
  error: Error | null;
  allTabs: Tab[];        // após filtro de páginas internas
  filteredTabs: Tab[];   // após busca + chip de domínio
  domains: { name: string; count: number }[];
};
```

Comportamento:

1. Quando `open` muda para `true`, dispara `chrome.tabs.query({ currentWindow: true })` envolvido em `Promise`.
2. Se a Promise rejeita ou `chrome.runtime.lastError` é setado, expõe `state: 'error'` com o `Error` real. **Não retorna lista vazia para esconder o erro.**
3. Filtra abas inelegíveis: descarta aquelas sem `id`, sem `url`, sem `title`, ou cuja URL começa com `chrome://`, `chrome-extension://`, `about:`, `view-source:`, `devtools://`. Esse filtro é explícito (não é fallback).
4. Deriva `domains` agrupando por `hostname` extraído via `new URL(tab.url).hostname`. Se `new URL` lança, a aba entra no domínio especial `"(URL inválida)"` — visível como chip próprio, sem fingir um domínio real.
5. Aplica filtro: `filteredTabs = allTabs.filter(t => matchesQuery(t) && matchesDomain(t))`.
   - `matchesQuery(t)`: `query` vazia → true; senão, comparação case-insensitive (`toLocaleLowerCase`) contra `t.title` **e** `t.url`.
   - `matchesDomain(t)`: `activeDomain === null` → true; senão, `hostnameOf(t) === activeDomain`.

### Tipo `Tab`

```ts
interface Tab {
  id: number;            // garantido não-undefined após filtro
  title: string;         // garantido não-vazio após filtro
  url: string;           // garantido não-vazio após filtro
  hostname: string;      // pré-computado; "(URL inválida)" se new URL falhou
  favIconUrl?: string;
  index: number;         // ordem do Chrome
}
```

## Fluxo de dados

```
abrir dialog (open=true)
   │
   ▼
useFilteredTabs.useEffect dispara chrome.tabs.query
   │
   ├─ erro do chrome ─────► state='error', mostra EmptyState 'error'
   │
   ▼ ok
 tabs raw → filtra inelegíveis → mapeia para Tab[] com hostname
   │
   ▼
estado: query='', activeDomain=null, focusedIndex=0
   │
   ▼
domains = group(allTabs, hostname).sort(by count desc)
filteredTabs = allTabs (nada filtrado ainda)
   │
   ▼
render: TabSearchBar, DomainChipFilter, TabList(filteredTabs)
                           │
   ┌───────────────────────┤
   │                       │
usuário digita        usuário clica chip
   │                       │
   ▼                       ▼
query muda            activeDomain muda
   │                       │
   └─────────┬─────────────┘
             ▼
filteredTabs recalculado
focusedIndex resetado para 0
   │
   ▼
keyboard: ↑/↓ ajusta focusedIndex (clamp), Enter chama onSelect(tabs[focusedIndex])
   │
   ▼
onSelect → onSelectTab(id, title, url) → onOpenChange(false)
```

## Acessibilidade e teclado

- `Dialog` do shadcn já fornece foco trap, `Esc` para fechar, e `aria-labelledby`/`aria-describedby` via `DialogTitle`/`DialogDescription`.
- `TabSearchBar input` recebe `aria-label="Buscar abas por título ou URL"` e `aria-controls="tab-listbox"`.
- `TabList` é `role="listbox"` com `id="tab-listbox"`, `aria-label="Abas disponíveis"`, e `aria-activedescendant={focused-row-id}`.
- `TabRow` é `role="option"`, `aria-selected={isFocused}`, com `id={"tab-row-" + tab.id}` previsível para o `aria-activedescendant`.
- Chips são `<button type="button">` com `aria-pressed`. O chip "Todos" tem `aria-label="Mostrar todos os domínios"`.
- Atalho `/`: handler em `keydown` global (registrado enquanto `open === true`) verifica `e.target` — se o foco está em `<input>` ou `<textarea>`, deixa o caractere passar; senão, `e.preventDefault()` e foca o input via ref.
- `↑/↓`: enquanto o dialog está aberto, decrementa/incrementa `focusedIndex` com `Math.max(0, ...)` / `Math.min(filteredTabs.length - 1, ...)`. `scrollIntoView({ block: 'nearest' })` na linha focada.
- `Enter`: se `focusedIndex` aponta para uma aba válida, chama `handleSelect(tabs[focusedIndex])`; senão, no-op.
- Quando `filteredTabs.length === 0`, `↑/↓/Enter` não fazem nada.

## Tratamento de erros (regra do projeto: sem fallbacks)

- `chrome.tabs.query` rejeita ou seta `chrome.runtime.lastError` → `useFilteredTabs` retorna `state: 'error'`. `EmptyState` variante `'error'` mostra a mensagem exata do `Error`. Não há fallback para lista vazia.
- Aba sem `id`, `title` ou `url` → filtrada de saída por ser inelegível (não é fallback — é critério de elegibilidade explícito).
- `new URL(tab.url)` lança → `hostname` recebe a string literal `"(URL inválida)"`, e a aba aparece num chip dedicado. **Não fingimos um hostname** nem escondemos a aba.
- `tab.favIconUrl` ausente → `TabRow` renderiza um placeholder neutro (caixa cinza com a inicial do hostname). Esse default é puramente visual sobre um campo que o Chrome explicitamente declara opcional — é o comportamento esperado, não um erro escondido.
- `chrome.storage.local.get('targetTabInfo')` falha → ignora o destaque "Atual" silenciosamente (não bloqueia o fluxo de seleção). Loga via `console.warn`. Justificativa: não impedir o usuário de selecionar uma nova aba só porque o destaque informativo falhou.

## Estados de UI

| Variante | Quando | Conteúdo |
|----------|--------|----------|
| `loading` | `useFilteredTabs.state === 'loading'` | Spinner atual (mantido). |
| `no-tabs` | `state === 'ready'` e `allTabs.length === 0` | Mensagem "Nenhuma aba disponível para interceptação". |
| `no-results` | `state === 'ready'` e `filteredTabs.length === 0` mas `allTabs.length > 0` | Mensagem "Nenhuma aba corresponde a *<query>*" e botão "Limpar busca" que zera `query` e `activeDomain`. |
| `error` | `state === 'error'` | Card de erro com `error.message` real e botão "Tentar novamente" que re-dispara a query. |

## Estilo e design tokens

Usa exclusivamente tokens existentes em `app/src/styles/globals.css` (`@theme` block: `--color-primary`, `--color-muted`, `--color-accent`, etc.) e classes Tailwind v4 já disponíveis. Não introduz novos tokens. Mantém indentação por tabs e biome config (single quotes, trailing commas, semicolons, print width 100, JSX double quotes).

UI strings em português-BR (continua o padrão dos outros componentes).

Componentes shadcn vendorizados a serem usados: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `Input`, `Button`, `Badge`, `ScrollArea`, `LucideIcon`. Nada de novo a vendorizar.

## Testes

Suite mínima em `app/src/components/select-tab/__tests__/`:

**`useFilteredTabs.test.ts`**

- Quando o mock de `chrome.tabs.query` rejeita, retorna `state: 'error'` com o erro original.
- Filtra abas com URL `chrome://`, `chrome-extension://`, `about:`, `view-source:`, `devtools://`.
- Filtra abas sem `id`, `title` ou `url`.
- `domains` agrupa por hostname e ordena por contagem decrescente.
- URLs inválidas viram domínio `"(URL inválida)"` sem disparar exceção do hook.
- `query` faz match case-insensitive em título E URL.
- `activeDomain` filtra apenas abas com aquele hostname; `null` retorna todas.

**`SelectTabDialog.test.tsx`**

- Abre, mostra spinner enquanto `state === 'loading'`, depois renderiza a lista.
- Renderiza badge "Atual" na aba cujo `id` bate com `targetTabInfo.tabId` mockado em `chrome.storage.local.get`.
- Pressionar `↓` move o destaque visual para a próxima linha.
- Pressionar `Enter` na linha focada chama `onSelectTab(id, title, url)` e fecha o dialog.
- Pressionar `/` (com foco fora do input) foca o input de busca.
- Digitar na busca filtra a lista; clicar em "Limpar busca" no estado `no-results` zera `query` e volta a lista cheia.

**`DomainChipFilter.test.tsx`**

- Renderiza um chip por domínio + chip "Todos" como primeiro e ativo por padrão.
- Clique em chip emite `onChange(domain)`; clique em "Todos" emite `onChange(null)`.
- Renderiza contagem ao lado do nome.
- Chip ativo recebe `aria-pressed="true"`.

**`TabSearchBar.test.tsx`**

- Renderiza ícone de lupa e badge `/`.
- `onChange` é disparado ao digitar.
- Recebe foco programático via `ref`.

Mocks de `chrome.tabs.query`, `chrome.runtime.lastError` e `chrome.storage.local.get` são adicionados em `app/vitest.setup.ts` (já existe stub do `chrome` global — apenas estender).

Cobertura alvo: caminhos felizes + cada caminho de erro listado em "Tratamento de erros".

## Plano de migração

1. Criar nova estrutura em `app/src/components/select-tab/` com todos os arquivos novos e testes verdes.
2. Atualizar import em `app/src/pages/Layout.tsx:3` para `../components/select-tab/SelectTabDialog`.
3. Remover `app/src/components/SelectTabDialog.tsx`.
4. Rodar `npm run lint`, `npm test`, `npm run build` em `app/` — todos verdes.
5. Validar manualmente conforme "Critérios de aceitação".

Não há migração de dados ou compatibilidade externa — o contrato com `Layout.tsx` (props `open`, `onOpenChange`, `onSelectTab`) é idêntico.

## Critérios de aceitação

Validação manual no browser depois do build:

1. Abrir o dialog → modal aparece grande (claramente maior que hoje), com busca focada por padrão.
2. Com 5+ abas abertas em domínios diferentes, chips de domínio aparecem ordenados por contagem.
3. Digitar parte de um título reduz a lista em tempo real; o contador "X de Y abas" no rodapé reflete a redução.
4. Clicar num chip de domínio reduz a lista a esse domínio; clicar em "Todos" volta tudo.
5. Pressionar `↑/↓` move o destaque; `Enter` confirma e fecha o dialog; `Esc` fecha sem selecionar; `/` foca a busca.
6. Se já há `targetTab` selecionado e a aba existe na lista, ela exibe a badge "Atual".
7. Filtrar a busca a um termo inexistente mostra estado "Nenhuma aba corresponde" com botão para limpar.
8. Forçar erro no `chrome.tabs.query` (ex: stub no devtools) mostra a mensagem real do erro, não lista vazia.
9. `npm run lint`, `npm test`, `npm run build` em `app/` permanecem verdes.

## Riscos e mitigações

- **Risco:** o atalho `/` pode conflitar com atalhos do Chrome ou de outras partes da extensão.
  **Mitigação:** o handler só é registrado enquanto o dialog está aberto e ignora o evento se o foco está em outro `<input>`/`<textarea>`.

- **Risco:** com muitas abas (caso extremo, 100+), a lista pode ficar pesada.
  **Mitigação:** primeira entrega assume distribuição realista (até ~50 abas) e renderiza tudo. Se o code review apontar lentidão perceptível com 100+ abas, virtualização (`react-window`) entra como PR separado — fora do escopo desta spec.

- **Risco:** `tab.favIconUrl` pode apontar para uma URL externa lenta, atrasando o render.
  **Mitigação:** `<img loading="lazy">` e fallback imediato (placeholder cinza com inicial). O placeholder aparece enquanto o favicon carrega — sem layout shift.

- **Risco:** dividir o componente em vários arquivos cria fricção desnecessária se o componente não crescer mais.
  **Mitigação:** a divisão é justificada agora pelo aumento de ~180 → ~360 linhas e por ter quatro responsabilidades distintas (busca, chips, lista, container). Caso encolha no futuro, consolidação é trivial.
