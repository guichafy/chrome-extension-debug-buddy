# Debug Buddy

[English](README.md)

Debug Buddy é uma extensão Chrome Manifest V3 que intercepta, modifica, mocka
e pausa o tráfego HTTP de uma aba do navegador, para você ver como a sua
aplicação web se comporta quando uma API falha, fica lenta ou muda o contrato —
sem mexer no backend, no código do frontend ou no ambiente.

Ela controla o Chrome DevTools Protocol (domínios `Fetch` e `Network`) via
`chrome.debugger`, então funciona com qualquer página, framework ou cliente
HTTP.

![Command Center com tráfego interceptado: checkout bloqueado, carrinho mockado, pedidos com atraso, lista de produtos transformada e respostas 404/500 reais](docs/images/command-center.png)

> A interface está disponível em português (Brasil) e inglês. Ela segue o
> idioma do Chrome e pode ser trocada a qualquer momento no rodapé da barra
> lateral.

## Para que serve

Use o Debug Buddy para reproduzir, sob demanda, situações difíceis de obter de
um backend real:

- um endpoint retorna `500`, `503`, `404`, `401` ou qualquer outro status;
- uma requisição demora segundos a mais que o normal;
- o body foge do contrato esperado (campo ausente, tipo errado, valor zerado);
- uma requisição nunca chega ao servidor (conexão recusada, abortada, offline);
- um header precisa ser injetado ou removido (token de auth, feature flag);
- uma API ainda não existe e precisa de mock durante o desenvolvimento;
- você precisa pausar uma requisição, olhar o conteúdo e decidir o que acontece.

## Início rápido

Este repositório ainda não aponta para uma página pública na Chrome Web Store,
então instale a partir do código-fonte:

```bash
cd app
npm install
npm run build
```

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta `app/dist/`.
3. Clique no ícone do Debug Buddy na barra do Chrome. A interface abre em uma
   aba própria; ela também fica disponível no Side Panel do Chrome. Para
   trocar o idioma, use o seletor no rodapé da barra lateral.
4. No cabeçalho, escolha a **aba alvo** — a aplicação que você quer depurar.
5. Clique em **Iniciar Análise**. O Chrome mostra a barra "começou a
   depurar este navegador" na aba alvo; isso é esperado.
6. Use a aplicação normalmente e acompanhe o tráfego no **Command Center**.
7. Clique em **Parar Análise** ao terminar. Qualquer requisição ainda
   pausada é liberada antes de o debugger ser desanexado.

## Tour pelas funcionalidades

### Command Center — tráfego ao vivo

Toda requisição da aba alvo aparece em uma única tabela com o tipo de
interceptação (pass-through, mock, modificada, transform, atraso, bloqueio,
breakpoint), duração, tamanho, método, URL e status. O cabeçalho mostra
métricas ao vivo (requisições, bytes transferidos, recursos) e a barra de
filtro aceita `method:`, `status:`, `state:` ou texto livre. O histórico fica
salvo no IndexedDB, então sobrevive ao fechamento da interface.

Clique em uma linha para abrir o **inspector** com as abas Overview, Request e
Response, além da aba **Modificações** sempre que uma regra reescreveu a
request ou a response. **Criar regra** transforma uma captura real em uma
regra pré-preenchida.

![Inspector aberto em uma requisição mockada](docs/images/request-inspector.png)

### Breakpoints — pausar, inspecionar, decidir

A ação `breakpoint` segura a requisição — antes do envio ou depois que o
servidor respondeu — até você agir. O dock de pendentes permite **Aprovar**,
**Editar…** (status, headers e body antes de liberar), **Criar Mock** ou
ignorar. Atalhos de teclado: <kbd>A</kbd> aprova, <kbd>I</kbd> ignora,
<kbd>J</kbd>/<kbd>K</kbd> próxima/anterior.

![Dock de ações pendentes com uma requisição pausada para /api/inventory](docs/images/pending-breakpoint.png)

### Rules Lab — regras de interceptação

As regras são ordenadas por prioridade (arraste, ou <kbd>Ctrl/Cmd</kbd> +
<kbd>↑/↓</kbd>), podem ser pausadas individualmente e filtradas por tipo e
método HTTP. Cada regra casa por URL (substring ou regex), método, header e
body, e executa uma **chain ordenada de ações** em um stage:

| Stage | Quando roda | Ações |
|---|---|---|
| `request` | antes de a requisição sair do navegador | `requestModify`, `requestDelay`, `mock`, `block`, `breakpoint` |
| `response` | depois que o servidor respondeu | `responseModify`, `transform`, `mock`, `breakpoint` |

`mock`, `block` e `breakpoint` são **terminais**: encerram a chain, então
precisam ser a última ação. As regras podem ser exportadas e importadas em
JSON; a importação valida essas invariantes.

![Rules Lab listando regras de stage request e response](docs/images/rules-lab.png)

O editor de regras passa por **Tipo** (tipo e stage), **Matcher**, **Ação** e
**Revisar**:

![Editor de regra no passo de ações, editando headers da request](docs/images/rule-editor.png)

#### Exemplo de regra

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "name": "Injeta auth e mocka /api/users",
  "enabled": true,
  "stage": "request",
  "matchers": [
    { "type": "url", "enabled": true, "pattern": "/api/users", "isRegex": false }
  ],
  "actions": [
    {
      "type": "requestModify",
      "enabled": true,
      "addHeaders": { "Authorization": "Bearer test-token" }
    },
    {
      "type": "mock",
      "enabled": true,
      "status": 200,
      "headers": { "Content-Type": "application/json" },
      "body": "{\"users\":[]}"
    }
  ],
  "createdAt": 1715000000000,
  "updatedAt": 1715000000000
}
```

`requestModify` reescreve os headers e a ação terminal `mock` responde sem
tocar a rede. Para agir sobre o que o servidor devolveu (forçar um `503`,
alterar um campo do JSON com `transform`), use `"stage": "response"`.

### Sessões — Session Replay

Com a interceptação ligada, o Debug Buddy grava a aba alvo com
[rrweb](https://github.com/rrweb-io/rrweb) (até 50 MB ou 10 minutos por
sessão; o switch **Gravação** no cabeçalho desliga). A página de replay
reproduz o DOM ao lado de uma timeline com chamadas de rede, erros de console
e navegações, uma aba **Requisições** e **Recomendações**. As sessões podem ser
exportadas e importadas como arquivos `.dbsession`; importar uma sessão
gravada em outra origem pede confirmação antes.

![Replay da loja de demonstração com a timeline de rede e console](docs/images/session-replay.png)

O ícone de atividade ao lado do switch de gravação abre o **Live Insights**: as
tecnologias detectadas na página alvo e recomendações, atualizadas enquanto
você navega.

### Privacidade — redação de dados

A página **Privacidade** controla o que é mascarado antes de os dados serem
salvos: nomes de headers e padrões de valor, padrões de body, saída de
console, todos os inputs ou seletores CSS escolhidos na gravação do DOM,
domínios que nunca devem ser gravados, caminhos de usuário em stack traces e
purge automática após N dias.

## Como funciona

1. A interface (aba ou Side Panel) envia comandos ao background service
   worker, que é dono de todo o estado em tempo de execução.
2. Em **Iniciar Análise**, o worker chama `chrome.debugger.attach` na aba
   alvo e habilita `Network` (timing) e `Fetch` com dois padrões de
   interceptação: o stage `Request` e o stage `Response`.
3. Cada evento `Fetch.requestPaused` executa as regras que casam naquele stage
   e depois é continuado, atendido (mock), falhado (block) ou retido
   (breakpoint).
4. Toda requisição é gravada no IndexedDB e enviada à interface; a duração
   chega depois pelos eventos de `Network` e é mesclada.
5. **Parar Análise** libera o que ainda estiver pausado e desanexa o
   debugger.

As regras ficam no `chrome.storage.local`; requisições e sessões ficam no
IndexedDB. Tudo permanece no seu perfil do navegador. As únicas requisições
que a extensão faz por conta própria buscam source maps `.map` ao lado dos
scripts da página inspecionada, para simbolizar stack traces.

## Permissões

| Permissão | Por quê |
|---|---|
| `debugger` | Anexar à aba alvo e controlar a rede dela pelo DevTools Protocol. |
| `storage` | Salvar regras, a aba alvo e preferências. |
| `sidePanel` | Oferecer a interface no Side Panel do Chrome. |
| `offscreen` | Hospedar o sandbox que roda transforms avançados (via script), algo que o service worker não consegue fazer. |
| `scripting` | Injetar o probe e o gravador em abas que já estavam abertas antes de a extensão ser instalada ou atualizada. |
| `host_permissions: <all_urls>` | Exigido pela injeção via `scripting`, para ler o título e a URL das abas que você pode escolher como alvo e para funcionar com qualquer aplicação que você depure. |

O manifest também declara três content scripts em todas as URLs com
`document_start`: um probe no mundo `MAIN` da página, uma bridge no mundo
isolado e o gravador rrweb. Eles ficam ociosos até a interceptação ou a
gravação ser ligada para aquela aba. Depois de ativado, o probe envolve
`history.pushState`/`replaceState` e o `XMLHttpRequest` daquela página, e esses
wrappers permanecem até a página ser recarregada.

## Limitações

- Só a aba alvo selecionada é interceptada.
- O Chrome exibe uma barra de aviso enquanto o debugger está anexado à aba.
- Algumas respostas não têm corpo disponível pelo CDP.
- Uma requisição pausada trava a página até ser aprovada, editada, mockada ou
  ignorada.
- Os textos gerados pelo service worker (resumos de recomendações, erros de
  captura e mensagens de erro que ele devolve) e o `viewer.html` exportado
  continuam em português.

## Desenvolvimento

Todos os comandos rodam dentro de `app/`.

```bash
npm run watch             # reconstrói dist/ ao salvar (depois recarregue a extensão)
npm run watch:dev         # idem, com bundle de desenvolvimento para o React DevTools
npm run lint              # Biome
npm run typecheck         # tsc --noEmit
npm test                  # Vitest (jsdom)
npm run e2e               # Playwright contra dist/ (rode npm run build antes)
npm run docs:screenshots  # regenera docs/images/ e os assets da loja em docs/store/
```

Stack: Manifest V3, Chrome Debugger API / DevTools Protocol, React 19,
React Router, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, IndexedDB, rrweb,
Vitest, Playwright, Biome.

### Internacionalização (i18n)

A interface usa [i18next](https://www.i18next.com/) com
[react-i18next](https://react.i18next.com/), só nas páginas da extensão (aba de
opções e Side Panel). Tudo fica em `app/src/i18n/`:

| Caminho | Papel |
|---|---|
| `languages.ts` | Idiomas suportados, nomes nativos e a escolha do idioma: preferência salva → idioma do Chrome → inglês. |
| `locales/pt-BR/<namespace>.ts` | Catálogo fonte. Define todos os namespaces e chaves. |
| `locales/<idioma>/<namespace>.ts` | Traduções, tipadas contra o catálogo pt-BR. |
| `ui.ts` | Inicialização da página: lê a preferência, baixa só o chunk daquele idioma e mantém a aba e o Side Panel sincronizados. |
| `instance.ts` | A instância do i18next e suas opções. |

A escolha fica salva em `chrome.storage.local` (`uiLanguage`).

**Adicionando um texto traduzível**

1. Crie a chave no arquivo pt-BR do namespace certo (`locales/pt-BR/commandCenter.ts`,
   `locales/pt-BR/ruleEditor.ts`, …) e a mesma chave em todos os outros
   idiomas. O `npm run typecheck` falha enquanto um idioma tiver chave faltando
   ou sobrando.
2. No componente, use `const { t } = useTranslation('<namespace>')` e
   `t('secao.chave')`. As chaves são checadas pelo tsc.
3. Interpolação usa `{{nome}}`. Para texto com marcação, coloque tags nomeadas
   na string (`'Clique em <strong>{{label}}</strong>'`) e renderize com
   `<Trans t={t} i18nKey="…" components={{ strong: <strong /> }} />`.
4. Plurais usam os sufixos do i18next e são guiados por `count`: `_one`/`_other`
   no inglês e `_one`/`_many`/`_other` no português. `_zero` é opcional em
   qualquer idioma — por exemplo, para manter "0 abas", já que o português
   trata 0 como singular.
5. Chaves em camelCase, sem `_` (o underscore é reservado para os sufixos de
   plural).
6. Fora de componentes, em código usado só pela UI, chame `i18n.t(...)` de
   `@/i18n/instance`. Nunca importe o i18n em código alcançável pelo service
   worker ou pelos content scripts: service workers MV3 não conseguem carregar
   os catálogos sob demanda. O `npm run lint:ext` falha se o runtime do i18next
   aparecer ali.

Não há idioma de fallback. Uma chave ausente aparece como `namespace:chave` e é
registrada no console; no Vitest ela lança erro. O
`src/i18n/__tests__/catalogParity.test.ts` também confere formas de plural,
variáveis de interpolação, tags de componente e strings vazias.

**Adicionando um idioma** (por exemplo `es`)

1. Copie `app/src/i18n/locales/en/` para `app/src/i18n/locales/es/` e traduza
   os valores.
2. Adicione `'es'` em `SUPPORTED_LANGUAGES` e o nome nativo em
   `LANGUAGE_NATIVE_NAMES` (`languages.ts`).
3. Rode `npm run typecheck`. Ele aponta os demais lugares para registrar o
   catálogo: o carregamento sob demanda em `ui.ts`, o setup de testes em
   `testing.ts` e o teste de paridade.
4. Rode `npm test`; o teste de paridade lista as formas de plural que faltam
   para o novo idioma.

O Vitest começa cada arquivo de teste em pt-BR (os testes existentes verificam
os textos em português). As suítes do Playwright fixam pt-BR via
`chrome.storage.local` antes de abrir a extensão, porque o Playwright emula
`en-US` nas páginas; `launchExtensionContext({ uiLanguage: 'en' })` abre em
inglês.

Notas de arquitetura e convenções ficam em [`CLAUDE.md`](CLAUDE.md). Os
releases são automatizados com semantic-release e enviados à Chrome Web Store
como rascunho — veja [`app/RELEASING.md`](app/RELEASING.md).

## Licença

[GPL-3.0](LICENSE). O catálogo de detecção de tecnologias em
`app/src/lib/insights/catalog/` é derivado do
[webappanalyzer](https://github.com/enthec/webappanalyzer) (GPL-3.0). Veja o
[NOTICE](NOTICE) para detalhes.
