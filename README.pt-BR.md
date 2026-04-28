# Debug Buddy

[English version](README.md)

Debug Buddy é uma Chrome Extension Manifest V3 para desenvolvedores que precisam
inspecionar requests/responses, interceptar respostas HTTP e alterar o
comportamento do tráfego direto no navegador.

Usando a Chrome Debugger API e o domínio `Fetch` do Chrome DevTools Protocol, a
extensão pausa respostas de rede, exibe o conteúdo capturado e permite modificar
o que a aplicação recebe para simular cenários de falha sem alterar o backend, o
frontend ou a infraestrutura do ambiente.

## Para que serve

Debug Buddy ajuda a testar como uma aplicação se comporta quando uma API:

- retorna erro `500`, `404`, `401` ou qualquer outro status HTTP;
- demora mais do que o esperado para responder;
- devolve um body diferente do contrato esperado;
- muda headers ou content-type;
- fica indisponível em um fluxo crítico;
- precisa ser mockada durante o desenvolvimento.

Em vez de editar código de servidor, criar proxies locais ou depender de estados
difíceis de reproduzir, você escolhe uma aba do Chrome, inicia a interceptação e
controla as respostas que chegam à aplicação.

## Funcionalidades

- Seleção da aba alvo que será depurada pela extensão.
- Interceptação de respostas via `chrome.debugger` e Chrome DevTools Protocol.
- Regras com match por URL, método HTTP, headers e body.
- Ações de mock para responder com status, headers, body, content-type e latência
  definidos manualmente.
- Pausa de respostas para inspeção antes de continuar a navegação.
- Edição de status, headers e body antes de liberar uma resposta interceptada.
- Histórico de requisições capturadas, incluindo respostas observadas,
  interceptadas, mockadas, pendentes e com falha de captura.
- Criação de mocks a partir de respostas reais capturadas.
- Interface em aba dedicada ou no Chrome Side Panel.
- Persistência local de regras e histórico usando `chrome.storage.local` e
  IndexedDB.

## Como funciona

1. A interface do Debug Buddy abre em uma aba própria ou no Side Panel.
2. Você escolhe a aba alvo, que é a aplicação web a ser depurada.
3. Ao iniciar a interceptação, a extensão anexa o debugger à aba alvo.
4. O background service worker habilita os domínios `Network` e `Fetch`.
5. Cada resposta pode ser observada, pausada, mockada ou modificada conforme as
   regras configuradas.
6. O histórico fica disponível na interface para análise e criação de novos mocks.

O aviso de depuração exibido pelo Chrome na aba alvo é esperado: ele aparece
porque a extensão usa a permissão `debugger`.

## Como usar

1. Instale e carregue a extensão em modo desenvolvedor.
2. Clique no ícone do Debug Buddy na barra do Chrome.
3. Selecione a aba da aplicação que você quer depurar.
4. Crie regras de interceptação em **Configurações**.
5. Clique em **Iniciar Interceptação**.
6. Navegue pela aplicação alvo e acompanhe as requisições em **Histórico**.
7. Quando uma resposta ficar aguardando ação, inspecione, edite, aprove, ignore
   ou transforme em mock.
8. Clique em **Parar Interceptação** ao finalizar.

## Desenvolvimento local

Os comandos do projeto rodam dentro da pasta `app/`.

```bash
cd app
npm install
npm run build
```

Depois do build:

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `app/dist/`.

Durante o desenvolvimento, use o modo watch para reconstruir a extensão ao salvar:

```bash
cd app
npm run watch
```

## Scripts úteis

```bash
cd app
npm run dev
npm run build
npm run watch
npm run lint
npm run lint:fix
npm run format
npm run typecheck
npm test
npm run test:coverage
```

## Stack

- Chrome Extension Manifest V3
- Chrome Debugger API
- Chrome DevTools Protocol (`Fetch` e `Network`)
- React 19
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- IndexedDB
- Vitest
- Biome

## Permissões

A extensão solicita permissões necessárias para atuar como ferramenta de debug:

- `debugger`: anexar o Chrome Debugger à aba alvo e controlar o fluxo de rede.
- `tabs`: listar e selecionar a aba que será depurada.
- `storage`: salvar regras, aba alvo e preferências locais.
- `sidePanel`: disponibilizar a UI no Chrome Side Panel.
- `<all_urls>`: permitir interceptação em aplicações e APIs acessadas pela aba alvo.

## Limitações

- A interceptação só acontece na aba alvo selecionada.
- O Chrome exibe um aviso enquanto o debugger está anexado à aba.
- Algumas respostas podem não ter corpo disponível para captura pelo CDP.
- Requisições pendentes precisam ser liberadas, mockadas ou continuadas para que a
  página não fique aguardando indefinidamente.

## Licença

MIT
