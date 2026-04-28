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
