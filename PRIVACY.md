---
title: Debug Buddy — Privacy Policy
permalink: /privacy/
---

# Debug Buddy — Privacy Policy

[Português (Brasil)](#política-de-privacidade--português-brasil)

_Last updated: October 31, 2026_

Debug Buddy is a Chrome extension for developers that creates API mocks and helps analyze and troubleshoot web applications. This policy explains what data the extension handles and where it goes.

## Summary

- Debug Buddy has **no server**. It does not send your data to the developer or to any third party.
- There is **no analytics, telemetry, advertising or tracking** inside the extension.
- Everything the extension records stays **in your browser**, and you can delete it at any time.

## What the extension handles, and why

Debug Buddy only handles data from a tab **after you choose that tab and click "Start Analysis"**. While analysis is active, it can handle:

| Data | Why |
|---|---|
| Network requests and responses of the analyzed tab (URL, method, status, headers, body, timing) | Show the traffic, apply your mock rules, and let you inspect and replay calls. |
| Console messages and errors of the analyzed tab | Show errors in the session timeline. |
| A recording of the page (DOM changes, clicks, scrolls, navigations) | Replay the session to reproduce a problem. |
| Technologies detected on the page (e.g. React, Vue.js) and security/performance hints | Show insights about the analyzed page. |
| Your mock rules and settings | Make the extension work the way you configured it. |

## Where data is stored

All data is stored locally in your browser profile, using `chrome.storage.local` and IndexedDB. It never leaves your device, unless you **explicitly export** a session to a `.dbsession` file and decide to share it yourself.

## Network requests made by the extension

The extension does not contact any Debug Buddy or third-party service. The only request it makes by itself is to download **source map files** (`.map`) from the **same server that delivered the analyzed page's scripts**, to turn minified stack traces into readable ones. That server is the site you chose to analyze.

## Privacy controls

- Sensitive values are **masked by default** before being stored: headers such as `Authorization`, `Cookie`, `Set-Cookie` and API keys; JWTs, card numbers, passwords and tokens in bodies and console output; and password and card fields in the page recording.
- You can add your own masking rules, mask all form inputs, block domains so they are never recorded, and turn on automatic deletion after a number of days.
- You can clear the history and sessions in the extension at any time. Uninstalling the extension deletes all of its local data.

## Permissions

Debug Buddy uses the Chrome debugging API (`debugger`) on the tab you select to see its network activity and apply your mocks. While it is attached, Chrome shows a "started debugging this browser" bar on that tab. Other permissions (`tabs`, `storage`, `sidePanel`, `offscreen`, `scripting`, `webNavigation` and access to all sites) are used only to provide the features above on the sites you choose to analyze.

## Data sharing and sale

Debug Buddy does not sell, transfer or share user data with third parties, does not use it for purposes unrelated to its single purpose, and does not use it to determine creditworthiness or for lending.

## Chrome Web Store

The Chrome Web Store listing page may be measured by Google Analytics, run by Google, under Google's own policies. That covers visits to the store page only, not your use of the extension.

## Changes and contact

Changes to this policy are published in this file, with the date updated at the top. For questions, open an issue at <https://github.com/guichafy/chrome-extension-debug-buddy/issues>.

---

# Política de Privacidade — Português (Brasil)

_Última atualização: 31 de outubro de 2026_

O Debug Buddy é uma extensão do Chrome para desenvolvedores que cria mocks de API e ajuda a analisar e fazer troubleshooting de aplicações web. Esta política explica quais dados a extensão manipula e para onde eles vão.

## Resumo

- O Debug Buddy **não tem servidor**. Ele não envia seus dados para o desenvolvedor nem para terceiros.
- **Não há analytics, telemetria, publicidade nem rastreamento** dentro da extensão.
- Tudo o que a extensão grava fica **no seu navegador**, e você pode apagar a qualquer momento.

## O que a extensão manipula e por quê

O Debug Buddy só manipula dados de uma aba **depois que você escolhe essa aba e clica em "Iniciar Análise"**. Com a análise ativa, ele pode manipular:

| Dado | Motivo |
|---|---|
| Requisições e respostas de rede da aba analisada (URL, método, status, headers, corpo, tempos) | Mostrar o tráfego, aplicar suas regras de mock e permitir inspecionar e reproduzir chamadas. |
| Mensagens e erros de console da aba analisada | Mostrar os erros na timeline da sessão. |
| Uma gravação da página (mudanças no DOM, cliques, rolagens, navegações) | Rever a sessão para reproduzir um problema. |
| Tecnologias detectadas na página (ex.: React, Vue.js) e dicas de segurança/performance | Mostrar insights sobre a página analisada. |
| Suas regras de mock e configurações | Fazer a extensão funcionar do jeito que você configurou. |

## Onde os dados ficam

Todos os dados ficam no perfil do seu navegador, em `chrome.storage.local` e IndexedDB. Eles não saem do seu dispositivo, a não ser que você **exporte** uma sessão para um arquivo `.dbsession` e decida compartilhá-lo por conta própria.

## Requisições feitas pela extensão

A extensão não acessa nenhum serviço do Debug Buddy ou de terceiros. A única requisição que ela faz por conta própria é baixar **arquivos de source map** (`.map`) do **mesmo servidor que entregou os scripts da página analisada**, para transformar stack traces minificados em legíveis. Esse servidor é o site que você escolheu analisar.

## Controles de privacidade

- Valores sensíveis são **mascarados por padrão** antes de serem gravados: headers como `Authorization`, `Cookie`, `Set-Cookie` e chaves de API; JWTs, números de cartão, senhas e tokens em corpos e no console; e campos de senha e cartão na gravação da página.
- Você pode criar regras próprias de mascaramento, mascarar todos os campos de formulário, bloquear domínios para que nunca sejam gravados e ativar a exclusão automática após um número de dias.
- Você pode limpar o histórico e as sessões na extensão a qualquer momento. Desinstalar a extensão apaga todos os dados locais dela.

## Permissões

O Debug Buddy usa a API de depuração do Chrome (`debugger`) na aba que você escolhe para ver a atividade de rede e aplicar seus mocks. Enquanto está anexado, o Chrome exibe nessa aba a barra "começou a depurar este navegador". As demais permissões (`tabs`, `storage`, `sidePanel`, `offscreen`, `scripting`, `webNavigation` e acesso a todos os sites) são usadas só para oferecer os recursos acima nos sites que você escolhe analisar.

## Compartilhamento e venda de dados

O Debug Buddy não vende, transfere nem compartilha dados de usuários com terceiros, não os usa para fins alheios à sua finalidade única e não os usa para avaliar crédito ou conceder empréstimos.

## Chrome Web Store

A página da extensão na Chrome Web Store pode ser medida pelo Google Analytics, operado pelo Google, sob as políticas do próprio Google. Isso cobre só as visitas à página da loja, não o uso da extensão.

## Alterações e contato

Alterações nesta política são publicadas neste arquivo, com a data atualizada no topo. Para dúvidas, abra uma issue em <https://github.com/guichafy/chrome-extension-debug-buddy/issues>.
