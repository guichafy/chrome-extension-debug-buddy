# Changelog

## [1.1.0](https://github.com/guichafy/chrome-extension-debug-buddy/compare/v1.0.0...v1.1.0) (2026-04-28)


### Features

* adição de editor de código para mocks com syntax highlighting e toggle para ativar/desativar mocks ([a7be353](https://github.com/guichafy/chrome-extension-debug-buddy/commit/a7be353c45c96c4d4b1c2d04c40840b87283b216))
* adiciona funcionalidades para limpar requisições no background e na interface ([b2716da](https://github.com/guichafy/chrome-extension-debug-buddy/commit/b2716da45f411687e73e84c56c841db571077dd3))
* **css:** add success/warning/info semantic tokens and document [@theme](https://github.com/theme) ([4fb37b4](https://github.com/guichafy/chrome-extension-debug-buddy/commit/4fb37b417ddffa6a20cbb288c056024f0b1e8778))
* implement network timing tracking and duration display for requests ([ccdb1c8](https://github.com/guichafy/chrome-extension-debug-buddy/commit/ccdb1c8607f3589bf367ef7c254c90d62d67a2f7))
* **migration:** add background-side legacy storage migration ([8aa057d](https://github.com/guichafy/chrome-extension-debug-buddy/commit/8aa057d0d216d167dd9f109de0cf30002211bce5))
* **release:** add chrome-webstore-upload publish script + workflow ([d049b3e](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d049b3e7ccf81aad5415cc5603c0d32b764423a2))
* show request body in response dialog ([0bb0778](https://github.com/guichafy/chrome-extension-debug-buddy/commit/0bb07780c09fd8470b133591c7d6e727fa505e4c))
* **sidepanel:** add Side Panel entrypoint as complement to options page ([73c866f](https://github.com/guichafy/chrome-extension-debug-buddy/commit/73c866f9cff0dcc0e964eb0ba467fe954988f66d))
* **ui:** centralize HTTP status badge helper with semantic tokens ([9de6201](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9de6201ecc740787f4f691a0e9e4304770ac3e37))
* update response handling and UI improvements ([e4f2f20](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e4f2f201e989a115efc917326ef52935bbfb9188))


### Bug Fixes

* **background:** update chrome.action.onClicked to open options.html ([9a2ac32](https://github.com/guichafy/chrome-extension-debug-buddy/commit/9a2ac32039df74af27ddab64d4baf9b5a87967bd))
* **css:** repair sidebar overlap and standardize button colors for dark theme ([5306ac0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/5306ac0cd477afbf34ee1614b51ba48ce4975428))
* **history:** persist intercepted requests via background as single writer ([92ff985](https://github.com/guichafy/chrome-extension-debug-buddy/commit/92ff9851eb3a4e298300a0b076c12024ea4c445c))
* **rule-editor:** aggressive pointer-events restore for Radix Dialog leak ([819ce09](https://github.com/guichafy/chrome-extension-debug-buddy/commit/819ce09d5070691b532ea9c991c63e67d056b5f4))
* **rule-editor:** restore body pointer-events when dialog closes ([e0ed134](https://github.com/guichafy/chrome-extension-debug-buddy/commit/e0ed1340525c304c94b3584a9955d6fda37217dd))
* **search:** keep input visible on empty history ([1f8beac](https://github.com/guichafy/chrome-extension-debug-buddy/commit/1f8beac5d90e2488481ad5ec2abd88195f091ce8))
* **shadcn:** point components.json to actual tailwind config and globals.css ([0b352a0](https://github.com/guichafy/chrome-extension-debug-buddy/commit/0b352a06dc89ff464c2744b0558702a064752ffb))
* surface capture failures, unblock pass-through, and time redirect hops ([349a05f](https://github.com/guichafy/chrome-extension-debug-buddy/commit/349a05f6880e4e6edf6db8e74fab454de62e61b9))
* **ts:** resolve strict-mode errors in source and test fixtures ([176a6f5](https://github.com/guichafy/chrome-extension-debug-buddy/commit/176a6f5f905ac2797101e676a4e362cb63dd2025))
* **ui:** repair SidebarMenuButton outline shadow and exhaustive deps warnings ([d2e37ae](https://github.com/guichafy/chrome-extension-debug-buddy/commit/d2e37aefe1dd65e33aa604105e04a1b457cfb1d3))
* **ui:** replace deprecated unescape with safe decodeURIComponent in ResponseDialog ([312d83c](https://github.com/guichafy/chrome-extension-debug-buddy/commit/312d83c54db7631c34b35bcefc5646fbde1f09f3))
