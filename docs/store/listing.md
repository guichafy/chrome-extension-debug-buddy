# Chrome Web Store listing

Text for the store dashboard. The **summary** is not typed in the dashboard: it
comes from `description` in `app/manifest.json` (max 132 characters). The
manifest has no `_locales` yet, so the summary is English-only; the detailed
description can be set per language in the dashboard.

Claims below were checked against the code: technology detection comes from
the catalog in `app/src/lib/insights/catalog/` (116 technologies), and the
recommendation rules from `app/src/lib/session/recommendations/`.

**Keyword policy:** do not list framework/library names (React, Angular, Vue.js…)
anywhere in the summary or description. A submission was rejected for
"Keyword Spam" (violation *Yellow Argon*, Oct 2026) because of such a list.

## Summary (manifest `description`, 127/132)

Create API mocks and troubleshoot web apps: inspect network calls, simulate failures, replay sessions and reproduce API errors.

## Description — English

Debug Buddy is a developer tool to create API mocks and to analyze and troubleshoot web applications, whatever framework they use, right in Chrome, without adding anything to your project or changing your backend.

When a screen breaks, loads slowly or shows the wrong data, Debug Buddy shows what happened between the browser and your APIs, and lets you reproduce the problem with mocks as many times as you need.

Create mocks without a mock server:
• Mock any API response: status, headers and body, even for endpoints that do not exist yet.
• Simulate failures: HTTP errors (500, 404, 401…), slow responses, connection failures and responses that break the contract.
• Adjust headers and bodies on the fly to test feature flags, tokens and edge cases.
• Pause a call to examine it and edit status, headers and body before it continues.
• Organize your mocks as reusable rules matched by URL, method, header or body.

Analyze and troubleshoot:
• Follow every network call of the tab in real time: method, URL, status, duration and size, with filters by method, status and text.
• Inspect requests and responses: headers, body and timing.
• Replay the session: the screen recording synced with a timeline of network calls, console errors and navigations.
• Discover the page's stack: detection of 100+ technologies (frameworks, libraries, servers and analytics tools).
• Get security recommendations (CSP, HSTS, cookies, CORS, mixed content) and performance recommendations (compression, caching, large payloads, unoptimized images).
• Export and import sessions (.dbsession) to share a problem with your team.

Privacy: your data stays in your browser (Chrome storage and IndexedDB). Debug Buddy does not send it to any Debug Buddy or third-party service. You choose what gets masked — headers, bodies, console output, form inputs — which domains are never recorded, and how long data is kept.

While a tab is being analyzed, Chrome shows a "started debugging this browser" bar on it. This is expected: Debug Buddy uses Chrome's debugging API to see the page's network activity and apply your mocks.

The interface is currently in Portuguese (pt-BR); English is planned.

## Descrição — Português (Brasil)

O Debug Buddy é uma ferramenta para desenvolvedores criarem mocks de API e analisarem e fazerem troubleshooting de aplicações web, qualquer que seja o framework, direto no Chrome, sem adicionar nada ao seu projeto nem mexer no backend.

Quando uma tela quebra, carrega devagar ou mostra dados errados, o Debug Buddy mostra o que aconteceu entre o navegador e as suas APIs e permite reproduzir o problema com mocks quantas vezes for preciso.

Crie mocks sem servidor de mock:
• Simule a resposta de qualquer API: status, headers e corpo, inclusive de endpoints que ainda não existem.
• Simule falhas: erros HTTP (500, 404, 401…), lentidão, falhas de conexão e respostas fora do contrato.
• Ajuste headers e corpos na hora para testar feature flags, tokens e casos de borda.
• Pause uma chamada para examinar e editar status, headers e corpo antes de ela continuar.
• Organize seus mocks em regras reutilizáveis por URL, método, header ou corpo.

Analise e faça troubleshooting:
• Acompanhe todas as chamadas de rede da aba em tempo real: método, URL, status, duração e tamanho, com filtros por método, status e texto.
• Inspecione requisições e respostas: headers, corpo e tempos.
• Reveja a sessão: a gravação da tela sincronizada com a timeline de chamadas de rede, erros de console e navegações.
• Descubra a stack da página: detecção de mais de 100 tecnologias (frameworks, bibliotecas, servidores e ferramentas de analytics).
• Receba recomendações de segurança (CSP, HSTS, cookies, CORS, mixed content) e de performance (compressão, cache, payloads grandes, imagens não otimizadas).
• Exporte e importe sessões (.dbsession) para compartilhar um problema com o time.

Privacidade: seus dados ficam no seu navegador (armazenamento do Chrome e IndexedDB). O Debug Buddy não os envia para nenhum serviço próprio ou de terceiros. Você escolhe o que é mascarado — headers, corpos, saída do console, campos de formulário —, quais domínios nunca são gravados e por quanto tempo os dados ficam guardados.

Enquanto uma aba está sendo analisada, o Chrome exibe nela a barra "começou a depurar este navegador". Isso é esperado: o Debug Buddy usa a API de depuração do Chrome para ver a atividade de rede da página e aplicar seus mocks.
