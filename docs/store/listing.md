# Chrome Web Store listing

Text for the store dashboard. The **summary** is not typed in the dashboard: it
comes from `description` in `app/manifest.json` (max 132 characters). The
manifest has no `_locales` yet, so the summary is English-only; the detailed
description can be set per language in the dashboard.

Claims below were checked against the code: technology detection comes from
the catalog in `app/src/lib/insights/catalog/` (116 technologies), and the
recommendation rules from `app/src/lib/session/recommendations/`.

## Summary (manifest `description`, 127/132)

Debug and troubleshoot React, Angular, Vue and other web apps: inspect network calls, replay sessions and reproduce API errors.

## Description — English

Debug Buddy helps you find and understand problems in web applications — React, Angular, Vue.js, Next.js, Svelte, jQuery or any other framework — right in Chrome, without adding anything to your project.

When a screen breaks, loads slowly or shows the wrong data, Debug Buddy shows what happened between the browser and your APIs, and lets you reproduce the problem as many times as you need.

What you can do:
• Follow every network call of the tab in real time: method, URL, status, duration and size, with filters by method, status and text.
• Inspect requests and responses: headers, body and timing.
• Replay the session: the screen recording synced with a timeline of network calls, console errors and navigations.
• Discover the page's stack: detection of 100+ technologies such as React, Angular, Vue.js, Next.js and jQuery.
• Get security recommendations (CSP, HSTS, cookies, CORS, mixed content) and performance recommendations (compression, caching, large payloads, unoptimized images).
• Reproduce hard-to-get scenarios without touching the backend: HTTP errors (500, 404, 401…), slow responses, connection failures, responses that break the contract and changed headers.
• Pause a call to examine it and edit status, headers and body before it continues.
• Export and import sessions (.dbsession) to share a problem with your team.

Privacy: your data stays in your browser (Chrome storage and IndexedDB). Debug Buddy does not send it to any Debug Buddy or third-party service. You choose what gets masked — headers, bodies, console output, form inputs — which domains are never recorded, and how long data is kept.

While a tab is being analyzed, Chrome shows a "started debugging this browser" bar on it. This is expected: Debug Buddy uses Chrome's debugging API to see the page's network activity.

The interface is currently in Portuguese (pt-BR); English is planned.

## Descrição — Português (Brasil)

O Debug Buddy ajuda a encontrar e entender problemas em aplicações web — React, Angular, Vue.js, Next.js, Svelte, jQuery ou qualquer outro framework — direto no Chrome, sem adicionar nada ao seu projeto.

Quando uma tela quebra, carrega devagar ou mostra dados errados, o Debug Buddy mostra o que aconteceu entre o navegador e as suas APIs e permite reproduzir o problema quantas vezes for preciso.

O que você pode fazer:
• Acompanhar todas as chamadas de rede da aba em tempo real: método, URL, status, duração e tamanho, com filtros por método, status e texto.
• Inspecionar requisições e respostas: headers, corpo e tempos.
• Rever a sessão: a gravação da tela sincronizada com a timeline de chamadas de rede, erros de console e navegações.
• Descobrir a stack da página: detecção de mais de 100 tecnologias, como React, Angular, Vue.js, Next.js e jQuery.
• Receber recomendações de segurança (CSP, HSTS, cookies, CORS, mixed content) e de performance (compressão, cache, payloads grandes, imagens não otimizadas).
• Reproduzir cenários difíceis sem mexer no backend: erros HTTP (500, 404, 401…), lentidão, falhas de conexão, respostas fora do contrato e headers alterados.
• Pausar uma chamada para examinar e editar status, headers e corpo antes de ela continuar.
• Exportar e importar sessões (.dbsession) para compartilhar um problema com o time.

Privacidade: seus dados ficam no seu navegador (armazenamento do Chrome e IndexedDB). O Debug Buddy não os envia para nenhum serviço próprio ou de terceiros. Você escolhe o que é mascarado — headers, corpos, saída do console, campos de formulário —, quais domínios nunca são gravados e por quanto tempo os dados ficam guardados.

Enquanto uma aba está sendo analisada, o Chrome exibe nela a barra "começou a depurar este navegador". Isso é esperado: o Debug Buddy usa a API de depuração do Chrome para ver a atividade de rede da página.
