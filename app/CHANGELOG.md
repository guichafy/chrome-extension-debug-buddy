## [0.13.5](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.13.4...v0.13.5) (2026-11-01)

### Performance

* batch history updates and verify native panel coverage ([f95ebc4](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f95ebc437c93b123a54fa954acd48d1f65c1a876))
* bound response rendering and guard long recordings ([d7a64ce](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d7a64cefe685e0e848375002f90fecf5824af15d))
* retain filtered row identities without pinning cleared history ([ff651af](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ff651afa4888f25db17602064def1df52ff29656))
* reuse unchanged table rows to reduce garbage collection ([5e628df](https://github.com/guichafy/chrome-extension-debug-buddy/commit/5e628df66005b1392a84551ab11e077871f81ab8))

### Documentation

* record approved performance baselines and close tracked work ([8807c84](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8807c84e0727d30936b7bbe8da291524989d1042))

## [0.13.4](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.13.3...v0.13.4) (2026-10-31)

### Bug Fixes

* **store:** remove lista de frameworks da descrição da Chrome Web Store ([9afd7b2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9afd7b2790a59120420960f16054267ec58b5516))

## [0.13.3](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.13.2...v0.13.3) (2026-10-31)

### Bug Fixes

* **manifest:** remove as permissões tabs e webNavigation ([#101](https://github.com/guichafy/chrome-extension-debug-buddy/issues/101)) ([b5b89bf](https://github.com/guichafy/chrome-extension-debug-buddy/commit/b5b89bf456691a48b64bd31c879e7e90c87d54b3))

### Documentation

* adiciona política de privacidade para a Chrome Web Store ([#99](https://github.com/guichafy/chrome-extension-debug-buddy/issues/99)) ([0ea5cb1](https://github.com/guichafy/chrome-extension-debug-buddy/commit/0ea5cb1c56136ee595ce3132de07a67a84f269a5))

## [0.13.2](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.13.1...v0.13.2) (2026-10-31)

### Bug Fixes

* **ui:** troca 'Interceptação' por 'Análise' e atualiza listagem da Chrome Web Store ([#98](https://github.com/guichafy/chrome-extension-debug-buddy/issues/98)) ([68d29a5](https://github.com/guichafy/chrome-extension-debug-buddy/commit/68d29a5443735f2af232a5dd102238cfce6466e9))

## [0.13.1](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.13.0...v0.13.1) (2026-10-31)

### Bug Fixes

* **deps:** corrige alertas do Dependabot (240 de 244) ([3350c68](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3350c6886ffb7ade07f44f82d039f1c547c46f51))

### Documentation

* **readme:** detalha wrappers do probe e corrige data das regras nas screenshots ([184825b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/184825b0e15986f5aa18030992dd0eefba032fb8))
* **readme:** reescreve README (EN + pt-BR) com screenshots atuais ([cc4d6d0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/cc4d6d00f9ccae741760cff2b719445ba9c5a7a3))
* **store:** gera assets da Chrome Web Store ([74c46f7](https://github.com/guichafy/chrome-extension-debug-buddy/commit/74c46f7e01782f514f42593b2c332afb2e52ad2e))

## [0.13.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.12.0...v0.13.0) (2026-05-31)

### Features

* **intercept:** pendingInterceptions unificada + EditRequestSheet (Phase 5) ([bc10e78](https://github.com/guichafy/chrome-extension-debug-buddy/commit/bc10e788f232e03fbabb435ed941fb634d3a8f66))
* **intercept:** requestModified/responseModified + diff no inspector (Phase 7) ([669437d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/669437db112196eded328933a4d02b0dfa92eb51))
* **rules:** coluna Stage com filtro e indicador inalcançável (Phase 6) ([2d8b1b1](https://github.com/guichafy/chrome-extension-debug-buddy/commit/2d8b1b18b7ed6d3fce581625139bafe794b0a57b))
* **rules:** editor de regras stage-aware com chain ordenada (Phase 4) ([ae1be0e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ae1be0e4ae40b7225cd914f4bc63cd9a593510ce))
* **rules:** engine de matching stage-aware + chain ordenada (Phase 2) ([4d9a7cb](https://github.com/guichafy/chrome-extension-debug-buddy/commit/4d9a7cb6ebae884064ce945d9eaccbb6da594249))
* **rules:** pipeline executeChain stage-aware com appliers (Phase 3) ([13847e9](https://github.com/guichafy/chrome-extension-debug-buddy/commit/13847e9171785aed169ba9192d8a201ce7bfd51c))
* **rules:** schema dual-stage Phase 1 (Rule.stage + Rule.actions[]) ([91d39d3](https://github.com/guichafy/chrome-extension-debug-buddy/commit/91d39d32bee85fb8c4385c3f582f3388084fb226))
* **rules:** valida invariantes da chain no import + cap response single-action ([bfcd8c6](https://github.com/guichafy/chrome-extension-debug-buddy/commit/bfcd8c6be1bb732800e9b53b3b93ca6be739abb6))

### Bug Fixes

* **background:** limpa pending dual-stage no start/stop + falha visível ([8b3f5fe](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8b3f5fe79a56f4a02f967cb083af7b823baa9b9a))
* **command-center:** dock alvo errado + stage travado no quick mock ([cb287d6](https://github.com/guichafy/chrome-extension-debug-buddy/commit/cb287d6e882b14f075ece7c2083a180af44348c8))
* **intercept:** libera pending interceptions órfãs ao deletar/desabilitar rule ([ead71e3](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ead71e3497f1c81b4e545fbccd35f598b6589239))
* **manifest:** host_permissions necessário para chrome.scripting injetar ([d6e09e1](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d6e09e10dc084583ccfdb4442c26e0d322911e97))
* **rules:** tabela header-matcher cortando sem indicação de scroll ([93b0548](https://github.com/guichafy/chrome-extension-debug-buddy/commit/93b0548eb9dee0963b3d4bc77785eb7cf1892e4f))
* **session:** injeta content scripts em tabs pré-existentes ([321f112](https://github.com/guichafy/chrome-extension-debug-buddy/commit/321f112cda3e97cefa68b419fdc79a7a2ff8b072))

### Documentation

* **dual-stage:** toast de migração breaking + docs atualizadas (Phase 9) ([3874865](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3874865e880bbef22dd598b2407fb163bb1f0beb))

## [0.12.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.11.0...v0.12.0) (2026-05-04)

### Features

* **background:** requireField helper substitui validacao ad-hoc em 5 sites ([1328d4d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1328d4d3d115990a949a7f9868ee701d010a6b7c))
* **background:** runAsyncHandler para padronizar handlers async ([f7b19a1](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f7b19a18ce8cfa29ed967ad879e6a11d1b9d3f61))

### Bug Fixes

* **background:** preserva session:null no getActiveSession error path ([d44c1a6](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d44c1a65ac2c12abd258b5b8e878d90fcf15979d))
* **ui:** silencia warnings de a11y do Radix Dialog e simplifica NetworkMetricsBar ([79aabf7](https://github.com/guichafy/chrome-extension-debug-buddy/commit/79aabf7b3591ad60ca4318a5934229304f2642c5))

### Refactoring

* **background:** aplica runAsyncHandler nos 13 handlers async de session ([122eb2b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/122eb2b49e78f84da3b516922d3b2fe951bcd12f))
* **background:** aplica runAsyncHandler nos 5 handlers de debugging ([1fadb18](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1fadb182339de2951491b37e7cb47486861f0385))
* **background:** extrai applyPrivacyGate de handleRequestPaused ([71813fb](https://github.com/guichafy/chrome-extension-debug-buddy/commit/71813fb706cb3189d6fb42ddda7ad6757515adee))
* **background:** extrai buildResponseSnapshot pra função pura testável ([3361ebb](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3361ebbe559f58fa1da16fa409408e27952237af))
* **background:** extrai processRequestStage como decisão pura ([82f95c9](https://github.com/guichafy/chrome-extension-debug-buddy/commit/82f95c95b93f2a916ac3d936084d7b8850fbdf2a))
* **background:** extrai runRecommendationsForResponse de handleRequestPaused ([b7852fd](https://github.com/guichafy/chrome-extension-debug-buddy/commit/b7852fdba8a99ef7481660c1f06cf1df63a6a417))
* **background:** remove hot_reload action sem senders ([992f707](https://github.com/guichafy/chrome-extension-debug-buddy/commit/992f707dd67f9fc77a5716ee4364fd9a4b7b0061))
* **background:** substitui dispatcher if/else-if por messageHandlers map ([70af514](https://github.com/guichafy/chrome-extension-debug-buddy/commit/70af514cf3a46d507ec20e238e8ab964955f4016))
* **data-table:** set default visibility for mimeType column ([3df2c5c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3df2c5c11af10a7c16da4a71175feee121caee42))
* dry helpers compartilhados (bloco 2/4) ([dd9235d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/dd9235d11aaf56d85466b31f395b44c5a222ab27))
* remove dead code da branch session-replay (bloco 1/4) ([397dba5](https://github.com/guichafy/chrome-extension-debug-buddy/commit/397dba5ed8d7093e295d315ae7413eff337fc467))

## [0.11.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.10.0...v0.11.0) (2026-05-04)

### Features

* **session:** adiciona session replay com live insights e recommendations ([623dda0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/623dda045a64fd707db57b1afc6aad70c5a4100d))

## [0.10.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.9.0...v0.10.0) (2026-05-02)

### Features

* **e2e:** adiciona servidor de fixture com endpoint /api/users ([b282135](https://github.com/guichafy/chrome-extension-debug-buddy/commit/b282135d3692ed8839ba1a721e88220e9d17e1d4))
* **e2e:** captura screenshots de evidência em 6 checkpoints do Golden Path ([f62bcdd](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f62bcdda29725005483a2fba9c1c9ae1b1ea00ea))
* **e2e:** configura Playwright com globalSetup validando dist/ ([44f52cb](https://github.com/guichafy/chrome-extension-debug-buddy/commit/44f52cbf692bcb37ed5b1bec6a5dfdb470beed82))
* **e2e:** helper seedRules grava chrome.storage.local ([e921b9d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e921b9dbe8000ec652de05911a42a461fda36faf))
* **e2e:** helpers para lançar contexto persistente com extensão ([41a9376](https://github.com/guichafy/chrome-extension-debug-buddy/commit/41a9376830266dc7008577a5955eebc86e09c3fd))

### Refactoring

* **e2e:** aplica review final — lint cobre e2e, cleanup de profile ([795004e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/795004e975fa212ff1f1b72d6350ca69b2ab6e4b))
* **e2e:** aplica revisão do code reviewer no Golden Path ([9a2bcd7](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9a2bcd76a79e8ac51a77c3a2a11e9de6b20921f3))

### Documentation

* **e2e:** documenta como rodar a suite Playwright ([a2c0cd6](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a2c0cd66999072a2c29793a00564e51fc96aa0ff))
* **plans:** adiciona plano de implementação E2E Golden Path ([1449921](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1449921a90b4352ad446d7a98e1db92ad92b06a9))
* **plans:** adiciona plano de implementação screenshots de evidência + Release ([d006217](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d006217268ac9363802568ad96a134b38fe0cd97))
* **specs:** adiciona spec de E2E Golden Path com Playwright ([f07c70c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f07c70c8b21cc7798570157d748cd2cd94e8637a))
* **specs:** adiciona spec de screenshots como evidência + anexo na Release ([942a231](https://github.com/guichafy/chrome-extension-debug-buddy/commit/942a23192bbdcd0a2e8414ec6c2001b87273d07a))

## [0.9.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.8.0...v0.9.0) (2026-05-02)

### Features

* **build:** adiciona build dev compatível com React DevTools standalone ([efb461a](https://github.com/guichafy/chrome-extension-debug-buddy/commit/efb461a34a8289853558ff262eb3e12d417747e4))
* chrome-extension-debug-buddy-wlr.2 - US-002: Banner de pendentes ganha botão 'Ver pausadas' ([cf4559c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/cf4559cdb42c2fb9af17e9fe6a51819e5b831d33))
* chrome-extension-debug-buddy-wlr.5 - US-003: Tabela de /pending oferece ações inline por linha ([93d92ca](https://github.com/guichafy/chrome-extension-debug-buddy/commit/93d92ca394fda1ff3d3471d7b3f42c604389186d))
* **command-center:** coluna Tipo reflete tipos de regra aplicados ([3dc6554](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3dc6554d03ffa8908433cedeb010144f35f2d5a0))
* **command-center:** hidrata ?edit e ?mock para abrir sheets cross-route ([f381025](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f3810256a851ae9564c1972fcf469fe2181f28f2))
* **command-center:** revamp pending requests UX e fixes pós-review ([7823370](https://github.com/guichafy/chrome-extension-debug-buddy/commit/782337019fd33e080b458e89d44fa79a87248bd4))
* **command-center:** substitui QuickMockPanel por RuleEditor pré-preenchido ([41c0214](https://github.com/guichafy/chrome-extension-debug-buddy/commit/41c0214fd4c47c908fd37f93672059d5a1acc4f1))
* **command-center:** tooltip explicativo na coluna Tamanho ([2223b5d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/2223b5df40d678996d28fa38b78d4d36895ca143))
* **inspector:** substitui botão por dropdown de criação de regras ([eaf59ba](https://github.com/guichafy/chrome-extension-debug-buddy/commit/eaf59ba1613926a59da05b25e27825b0639aec69))
* **layout:** promove PendingActionDock + hotkeys para o Layout ([6355f64](https://github.com/guichafy/chrome-extension-debug-buddy/commit/6355f64b4b6da84f5c7870e6ee092491746cb018))
* **routing:** adiciona AppOutletContext para estado compartilhado entre rotas ([be62bde](https://github.com/guichafy/chrome-extension-debug-buddy/commit/be62bde73b57eda200f99b94ccfbe3d7ec2121a9))
* **rules:** aceita skipTypeStep/initialDraft/headerMatcherSource no editor ([e98cec0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e98cec0aa2766099ef385d738dd525d7a5d82f99))
* **rules:** adiciona HeaderMatcherSelector reutilizável ([ba571bc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ba571bceda0b6b7fa09f429bd33e645a95566d45))
* **transform:** aplica regras de Transform em runtime + UX do editor ([9a3df9d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9a3df9dcfd5693abf15c423357b2feabfa510c0f))

### Bug Fixes

* **command-center:** aplica achados do code review (A1-A3, M1-M5, B5-B7) ([d5ca4d2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d5ca4d2bd5f07f63948b1c71968f7a11b293bd3e))
* **command-center:** elimina scroll horizontal e move split button para a linha do status ([bad00fe](https://github.com/guichafy/chrome-extension-debug-buddy/commit/bad00fe858bc48c31b8acfc97b6fe0b30e0bce8f))
* **command-center:** preserva edição one-shot durante polling de pendingResponses ([8010732](https://github.com/guichafy/chrome-extension-debug-buddy/commit/80107320c1d20bd5f7145259fe276a4c06a259bf))
* **inspector:** aplica revisões de qualidade do RequestInspector ([fcdbe06](https://github.com/guichafy/chrome-extension-debug-buddy/commit/fcdbe062818f3cf91afffbae282accf136c2d385))
* **networkTiming:** captura transferSize em hops de redirect ([9bd3e87](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9bd3e876eaf89baf6706f0ee2061950dbb9f4155))
* **rules:** habilita scroll-y no welcome do wizard e enxuga mocks ([75f4625](https://github.com/guichafy/chrome-extension-debug-buddy/commit/75f4625d34b827c8cbaf2e5bef5a3a1250fd84b1))
* **rules:** permite editar nome em skipTypeStep + cobre URL routing ([520823e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/520823e54e5ddef2ff0f9e25e006fc73ad1cab2b))
* **rules:** preserva progresso do wizard e exibe tipo no passo Ação ([a4c6359](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a4c63591129d0a1a97dda90fc8114c15b71ad69e))

### Refactoring

* **command-center:** centraliza decisões de pausadas no Dock e simplifica inspector ([3b96c13](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3b96c13df90ba1bf24d5b6dd6e8bda2e9cd39429))
* **command-center:** consome estado via useAppOutlet ([fbd2447](https://github.com/guichafy/chrome-extension-debug-buddy/commit/fbd2447842af4df440bd95464f3e1001f61921e6))
* **command-center:** remove QuickMockPanel obsoleto ([14aa5d9](https://github.com/guichafy/chrome-extension-debug-buddy/commit/14aa5d9d1bc2891873522a8214fa1f560d9f083d))
* **command-center:** unifica labels do Dock e default target na primeira pausada ([c13a8de](https://github.com/guichafy/chrome-extension-debug-buddy/commit/c13a8de225a28c237f29c91f5bb04f910323ed3b))
* **data-table:** remove botão Live Tail e auto-refresh togglable ([10f5952](https://github.com/guichafy/chrome-extension-debug-buddy/commit/10f5952cdba8eb20dd63005e39790ca40c0792f9))
* **domain:** generaliza buildQuickMockDraft em buildRuleDraftFromRequest ([8d7cf0d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8d7cf0de58594cbb0816b54fc073a059b74a05a7))
* **layout:** instancia hooks consolidados e expõe outlet context ([8221670](https://github.com/guichafy/chrome-extension-debug-buddy/commit/82216703d8a77bd6cff06a546935bc3f182e8957))

### Documentation

* **plan:** plano de implementação do dropdown Criar regra ([7c92ad4](https://github.com/guichafy/chrome-extension-debug-buddy/commit/7c92ad47e9db611933a7560ae5d2472b43de6576))
* **plan:** plano de implementação para PendingActionDock global ([ab5cf3e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ab5cf3ec4ebda6f14d145b5ff85c6ea7e6850113))
* **spec:** design para tornar PendingActionDock global em todas as rotas ([a644e67](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a644e670105325aaac31e6446937d6a21997b4c4))
* **spec:** substituir botão Criar Mock por dropdown de criação de regras ([653b06c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/653b06c4fd15f87116cd67dd9409e0532321c3cb))

## [0.8.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.7.0...v0.8.0) (2026-04-30)

### Features

* Rule Management improvements Feature/improvements rules ([#64](https://github.com/guichafy/chrome-extension-debug-buddy/issues/64)) ([df1536c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/df1536c8683ed120e87be990f9ad2bcf90868c4e))

## [0.7.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.6.0...v0.7.0) (2026-04-30)

### Features

* **target-tab:** rastrear navegação e fechamento da aba alvo ([67b81e2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/67b81e2eaa35931a4a88ee528838a00fe319ffb0))

## [0.6.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.5.1...v0.6.0) (2026-04-30)

### Features

* **networkMetricsBar:** métricas de rede no header com hover popovers ([#62](https://github.com/guichafy/chrome-extension-debug-buddy/issues/62)) ([0f7696d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/0f7696dfbac630120dd19402f22d759d3a3ed3a8))

## [0.5.1](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.5.0...v0.5.1) (2026-04-29)

### Performance

* **build:** reduz dist/ de 6MB para 856KB removendo assets mortos e habilitando code-split ([d9ab9bc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d9ab9bc7cedc439e207c93af03b86deaccd2a379))

## [0.5.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.4.0...v0.5.0) (2026-04-29)

### Features

* **rules-lab:** consolida tela em "Gestão de Regras" ([a34c5f2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a34c5f251985529ca1fcb8c192f9b3fd4435db81))

## [0.4.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.3.0...v0.4.0) (2026-04-29)

### Features

* **command-center:** filtros multi-critério e destaque para pendentes ([e98bc0d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e98bc0d9e1ede19b0623547f19ad574bcf7f4992))

## [0.3.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.2.0...v0.3.0) (2026-04-29)

### Features

* **select-tab:** adicionar container SelectTabDialog com teclado e estados ([151f4fc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/151f4fcc8f4ea225f515f63aee8ced5fc76ef09e))
* **select-tab:** adicionar DomainChipFilter com contagem e estado ativo ([f706775](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f7067751c2b7512388a9afc63363adcadff06aee))
* **select-tab:** adicionar EmptyState com variantes loading/no-tabs/no-results/error ([9224f20](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9224f20c772a17084ca7350be9b3455e55d52c57))
* **select-tab:** adicionar hook useFilteredTabs com filtros e tratamento de erro ([321a1e5](https://github.com/guichafy/chrome-extension-debug-buddy/commit/321a1e564fd4e1a6d39a80869e5ae8ccafa279e3))
* **select-tab:** adicionar TabList como listbox com aria-activedescendant ([08f760a](https://github.com/guichafy/chrome-extension-debug-buddy/commit/08f760ac2b78f21a9365c9ef6f109504832d2b70))
* **select-tab:** adicionar TabRow com favicon, badge Atual e role=option ([d240405](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d24040573f2dd99116d3149e6534c147f52b3f7f))
* **select-tab:** adicionar TabSearchBar com ícone, atalho / e foco via ref ([130813e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/130813ea249dc2ec4d485f3fd3a24b2cb4aaf6fe))

### Bug Fixes

* **select-tab:** ajustar tipagem do useFilteredTabs e tests ([fe2a5b0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/fe2a5b09f8e712135466541a593ed9fb4c72f4a8))
* **select-tab:** mover biome-ignore do useFilteredTabs para a posição correta ([f6b9a73](https://github.com/guichafy/chrome-extension-debug-buddy/commit/f6b9a73569b33578e32ad7a857c610bf2f2ed8e8))
* **select-tab:** ocultar contador de abas durante carregamento ([217d0dc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/217d0dc24c8a92e300c62573279ac5a3e71b35f0))
* **select-tab:** silenciar warning useExhaustiveDependencies em useFilteredTabs ([5a212c2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/5a212c2588bae3d4d51089b4d81a6bb020da6973))

### Refactoring

* **select-tab:** substituir SelectTabDialog antigo pela nova estrutura ([8cc4efc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8cc4efc296b0e650ed0560e5fdd8a64d8e22407b))

### Documentation

* **plan:** adicionar plano de implementação do redesign do SelectTabDialog ([8319448](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8319448b6f7ae473b2e5b7bb1381d52ad15010c8))
* **spec:** adicionar design do redesign do SelectTabDialog ([da814fd](https://github.com/guichafy/chrome-extension-debug-buddy/commit/da814fdc8a15e93d43531e879b5d67493b2dd2ca))

## [0.2.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.1.1...v0.2.0) (2026-04-29)

### Features

* **styles:** update design tokens and dark theme variables for improved UI consistency ([419313b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/419313b265aada81d811d86d6ecadeb438324169))

## [0.1.1](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.1.0...v0.1.1) (2026-04-28)

### Bug Fixes

* **metadata:** align package.json/manifest.json/README naming and description ([#52](https://github.com/guichafy/chrome-extension-debug-buddy/issues/52)) ([3c12c14](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3c12c1477c96440449d749d40b985f454e1e9264))

### Build

* **deps:** resolver 34 alertas Dependabot via bumps e overrides ([#54](https://github.com/guichafy/chrome-extension-debug-buddy/issues/54)) ([282513b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/282513bec3a9412bccc3333e8826bcebd8cd791d)), closes [#1](https://github.com/guichafy/chrome-extension-debug-buddy/issues/1) [20-#25](https://github.com/guichafy/20-/issues/25) [#11](https://github.com/guichafy/chrome-extension-debug-buddy/issues/11) [#12](https://github.com/guichafy/chrome-extension-debug-buddy/issues/12) [#13](https://github.com/guichafy/chrome-extension-debug-buddy/issues/13) [#50](https://github.com/guichafy/chrome-extension-debug-buddy/issues/50) [#55](https://github.com/guichafy/chrome-extension-debug-buddy/issues/55) [46-#47](https://github.com/guichafy/46-/issues/47) [51-#52](https://github.com/guichafy/51-/issues/52) [#59](https://github.com/guichafy/chrome-extension-debug-buddy/issues/59) [#60](https://github.com/guichafy/chrome-extension-debug-buddy/issues/60) [#17](https://github.com/guichafy/chrome-extension-debug-buddy/issues/17) [#57](https://github.com/guichafy/chrome-extension-debug-buddy/issues/57) [#10](https://github.com/guichafy/chrome-extension-debug-buddy/issues/10) [#8](https://github.com/guichafy/chrome-extension-debug-buddy/issues/8) [#26](https://github.com/guichafy/chrome-extension-debug-buddy/issues/26) [#53](https://github.com/guichafy/chrome-extension-debug-buddy/issues/53) [#30](https://github.com/guichafy/chrome-extension-debug-buddy/issues/30) [#35](https://github.com/guichafy/chrome-extension-debug-buddy/issues/35) [#36](https://github.com/guichafy/chrome-extension-debug-buddy/issues/36) [#58](https://github.com/guichafy/chrome-extension-debug-buddy/issues/58) [#34](https://github.com/guichafy/chrome-extension-debug-buddy/issues/34) [#48](https://github.com/guichafy/chrome-extension-debug-buddy/issues/48)

## [0.1.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.0.3...v0.1.0) (2026-04-28)

### Features

* **command-center:** página commandCenter com timeline + inspector lateral ([3990cae](https://github.com/guichafy/chrome-extension-debug-buddy/commit/3990cae676902f5c2bbf89255b551e63182e755b))
* **command-center:** requestInspector lateral com header compacto, abas e estados ([a87f2b8](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a87f2b8565fb04bb02e54d078a20c6c7e553d7a8))
* **command-center:** requestTimeline com seleção externa via DataTable.selectedRowId ([4dfce68](https://github.com/guichafy/chrome-extension-debug-buddy/commit/4dfce68b75e9db5e1ac1748eec90b17d189bb437))
* **domain:** adicionar createPresetRule com presets editáveis ([ab11306](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ab11306a360b70bdd6782ac99a3ba8a1833f228d))
* **domain:** adicionar helpers de headers sensíveis (mask + check) ([48b6603](https://github.com/guichafy/chrome-extension-debug-buddy/commit/48b6603f58cc8b1bb48704b241480f26a32c6f9a))
* **domain:** buildQuickMockDraft com defaults seguros (host+pathname+method) ([bf27f07](https://github.com/guichafy/chrome-extension-debug-buddy/commit/bf27f072163e80d065ed5deab58f11d74819b261))
* **domain:** serializeRules + validateRuleImport com schemaVersion ([5f74c4b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/5f74c4b5a37a1e2537d5b1ececdfa2ca599e05c2))
* **hooks:** useRequestSelection (id + objeto + clear) ([64ec5ff](https://github.com/guichafy/chrome-extension-debug-buddy/commit/64ec5ffb1981db91007bf6f6ca9754073e605d37))
* **inspector:** bodyViewer com preview por tipo (image/json/html/binário) + containment ([c4b28f0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/c4b28f07e1957715468988fc5312405d32e5606e))
* **quick-mock:** callback onCreated + indicação no inspector ([204b35b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/204b35b1b50ef031fbda58e6391f0999177b5ecf))
* **quick-mock:** quickMockPanel com preview + salvamento via useRules ([a42d784](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a42d78497f5d66c4af4d9ffad5b4b4a9f773e376))
* **replay:** replay básico capturado vs mock atual ([e7b52e1](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e7b52e1da06691d7230ffff9fb6237fe027aac40))
* **routes:** substituir Settings/Requests/RequestHistory por command-center + rules-lab (stub) ([31bcb1e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/31bcb1e1c4790389bb37204efab99b657180249f))
* **rules-lab:** export de regras (json com schemaversion) ([97193dc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/97193dc1f8a42bc88febe71fc9dbc7144d3dae34))
* **rules-lab:** página com cards de presets e listagem (substitui Settings) ([340d37e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/340d37e6776234f680789e8b259732887faaa9f3))
* **rules-lab:** rulePresetCard com descrição ([35961e3](https://github.com/guichafy/chrome-extension-debug-buddy/commit/35961e38a71b2bb7fbb9deac5c4a54ddb2bb9a7e))
* **types:** adicionar generatedRuleId em InterceptedResponse ([86ffd13](https://github.com/guichafy/chrome-extension-debug-buddy/commit/86ffd13aa45478441f5d72e6f27f10fa64af79ca))
* **types:** adicionar RuleDraft e RulePresetId ([4f44f84](https://github.com/guichafy/chrome-extension-debug-buddy/commit/4f44f84375621604f5fd7851198dac40fa877ac5))
* **ui:** adicionar wrapper LucideIcon para padronizar ícones shadcn ([539336b](https://github.com/guichafy/chrome-extension-debug-buddy/commit/539336b97ea5273cd34d17e6fcb0b1e75630e72f))

### Bug Fixes

* **command-center:** layout adaptive sem scroll vertical e foco no inspector ([7c53294](https://github.com/guichafy/chrome-extension-debug-buddy/commit/7c53294c83e43bab347bd964bcc0c94ef175110a))
* **inspector:** unificar abas request/response e mover comparação de mock para inline ([0e56a48](https://github.com/guichafy/chrome-extension-debug-buddy/commit/0e56a4837f5b9ab2a0aa2f9c2a3755d78025429f))
* **rules:** retornar regra de addRule + assinar chrome.storage.onChanged ([6c85014](https://github.com/guichafy/chrome-extension-debug-buddy/commit/6c8501401bf9f8278296a7846692f2d9c635f00b))
* **timing:** aplicar mock com latency no request stage para chrome devtools refletir o delay ([967d481](https://github.com/guichafy/chrome-extension-debug-buddy/commit/967d4811f506a5cbfa8619692045de228de483cf))
* **timing:** exibir mockLatencyMs na coluna Tempo e documentar quirk do devtools ([25e6e81](https://github.com/guichafy/chrome-extension-debug-buddy/commit/25e6e815ec714ca993ea721623a230bcffbae283))

### Refactoring

* **layout:** migrar selectTabDialog para lucideIcon ([a0294e2](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a0294e2a79b1d39b6b925d77aa8fdadac9faafdc))
* **layout:** migrar sidebar para LucideIcon e renomear nav para Command Center / Rules Lab ([d582907](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d58290754fe2f6c53dfe84771c846e4e0fc7c222))
* **layout:** migrar SiteHeader para LucideIcon ([a56e2fb](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a56e2fb01f058829921552428e56314858ace637))
* **layout:** remover useSidebar() morto após remoção do dropdown ([214d555](https://github.com/guichafy/chrome-extension-debug-buddy/commit/214d55566a077974c3bdd4cbc895dac739e4c88d))
* **requests:** trocar Material Icons por LucideIcon na data-table ([a3de146](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a3de1462834c2cf3c8423516d03d90c121a42309))
* **rules:** migrar editores e tabela de regras para lucideIcon ([1cc23ab](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1cc23ab1e19ed90e717170cd48815d16d0ea0aa4))

### Documentation

* add debug buddy launch experience spec ([60d66cc](https://github.com/guichafy/chrome-extension-debug-buddy/commit/60d66cc8049ab31e69f20cc56d97727022bb1def))

## [0.0.3](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.0.2...v0.0.3) (2026-04-28)

### Bug Fixes

* **release:** bump app/package.json via @semantic-release/npm plugin ([1e14857](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1e14857dc430e40d6e5c6b8a74f6eb8d966de102))

## [0.0.2](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v0.0.1...v0.0.2) (2026-04-28)

### Bug Fixes

* **manifest:** remove stale styles.css from web_accessible_resources ([cdf0e19](https://github.com/guichafy/chrome-extension-debug-buddy/commit/cdf0e19cc5b8ab118e6750bf1a0492e923eb9cf3)), closes [#48](https://github.com/guichafy/chrome-extension-debug-buddy/issues/48)
* **release:** bypass commitlint for semantic-release bot commit ([8dcdcad](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8dcdcad2775363b4807f823dd2425ae7989bdc55)), closes [#49](https://github.com/guichafy/chrome-extension-debug-buddy/issues/49)
