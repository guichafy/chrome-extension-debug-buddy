# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

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
