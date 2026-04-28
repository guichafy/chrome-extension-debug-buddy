# Debug Buddy Launch Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a nova experiência de lançamento do Debug Buddy: Command Center com timeline + Inspector lateral persistente, Quick Mock integrado, Rules Lab com presets, export/import de regras, replay básico e fundação visual baseada em `lucide-react` (shadcn).

**Architecture:** As mudanças preservam o contrato atual — `background.ts` continua autoridade de runtime/persistência, `chrome.storage.local.rules` continua fonte de regras, IndexedDB continua histórico durável. A UI ganha duas páginas novas (`/command-center`, `/rules-lab`) que substituem o foco em modal por um inspector lateral persistente. Funções puras (`buildQuickMockDraft`, `createPresetRule`, `validateRuleImport`) ficam em `app/src/domain/` para serem testáveis isoladamente.

**Tech Stack:** React 19, TypeScript strict, Vite 6, shadcn/ui, Tailwind v4, `lucide-react` (substituindo Material Icons), `@tanstack/react-table`, Vitest + React Testing Library, `chrome.storage.local`, IndexedDB.

**Spec source:** [docs/superpowers/specs/2026-04-28-debug-buddy-launch-experience-design.md](../specs/2026-04-28-debug-buddy-launch-experience-design.md)

---

## Convenções deste plano

- Todos os comandos rodam a partir de `app/` (não da raiz). Quando ver `npm run …`, faça `cd app && npm run …`.
- Cada tarefa deve passar pelo gate de verificação:
  ```bash
  cd app && npm run lint && npm run typecheck && npm test -- --run
  ```
  Se a tarefa altera o build (manifest, vite config, entrypoints), rode também `npm run build`.
- Strings de UI, comentários novos e mensagens de log: pt-BR. Indentação: tabs (size 2). Aspas simples em TS, duplas em JSX.
- Commits seguem Conventional Commits — pre-commit hook chama Biome via `lint-staged`. Não use `--no-verify`.
- **Nunca** introduza fallback silencioso (`return ''`, `?? 'Unknown'`, `?? 'ANY'`). Erros precisam ser visíveis. Releia `CLAUDE.md` se em dúvida.
- O worktree atual já está isolado em `.claude/worktrees/distracted-visvesvaraya-ee6856` — todo trabalho roda aqui.

---

## File Structure

### Arquivos novos

| Caminho | Responsabilidade |
| --- | --- |
| `app/src/components/ui/lucide-icon.tsx` | Wrapper fino sobre `lucide-react` exportando um conjunto curado de ícones com tamanho controlado pelo shadcn. Substitui o uso direto de `<Icon name="material-string" />`. |
| `app/src/domain/quickMock.ts` | Função pura `buildQuickMockDraft(request, options)` que converte uma `InterceptedResponse` + escolhas do usuário em `RuleDraft` ou `QuickMockError`. |
| `app/src/domain/sensitiveHeaders.ts` | Helpers `isSensitiveHeader(name)` e `maskHeaderValue(name, value)` reaproveitáveis pelo Quick Mock. |
| `app/src/domain/__tests__/quickMock.test.ts` | Testes unitários de `buildQuickMockDraft` (defaults, headers manuais, headers sensíveis, erros tipados). |
| `app/src/domain/__tests__/sensitiveHeaders.test.ts` | Testes da lista canônica de headers sensíveis. |
| `app/src/domain/rulePresets.ts` | Função pura `createPresetRule(presetId, baseMatcher?)` retornando `Rule` com defaults editáveis para cada preset (HTTP error, latency fixed/range, empty body, broken JSON). |
| `app/src/domain/__tests__/rulePresets.test.ts` | Testes da geração de cada preset. |
| `app/src/domain/rulesIO.ts` | Funções puras `serializeRules(rules)` e `validateRuleImport(value)` — schema check, sem I/O. |
| `app/src/domain/__tests__/rulesIO.test.ts` | Testes de export/import. |
| `app/src/pages/CommandCenter.tsx` | Página principal de investigação. Compõe `RequestTimeline` + `RequestInspector` em layout split. |
| `app/src/pages/__tests__/CommandCenter.test.tsx` | Teste de seleção de request → inspector atualiza sem modal. |
| `app/src/pages/RulesLab.tsx` | Página dedicada para regras: lista, presets, draft summary, import/export. Substitui parcialmente `Settings.tsx`. |
| `app/src/pages/__tests__/RulesLab.test.tsx` | Teste de presets renderizam, import valida, export gera JSON. |
| `app/src/components/command-center/RequestTimeline.tsx` | Lista/tabela de requests dentro do Command Center. Reaproveita `DataTable` mas sem o modal embutido. |
| `app/src/components/command-center/RequestInspector.tsx` | Painel lateral com header compacto, abas (Overview / Request / Response / Body / Timing), Quick Mock no topo e ações (replay, copy, ignore/approve). |
| `app/src/components/command-center/__tests__/RequestInspector.test.tsx` | Testes de cada estado: body indisponível, captureError, request pendente vs histórica. |
| `app/src/components/command-center/QuickMockPanel.tsx` | UI que envolve `buildQuickMockDraft` + seleção manual de header matchers + preview da regra a ser salva. |
| `app/src/components/command-center/__tests__/QuickMockPanel.test.tsx` | Testes do fluxo completo: defaults, seleção de headers, header sensível mascarado, salvamento. |
| `app/src/components/command-center/ReplayPanel.tsx` | Replay básico — reapresenta headers/body/status salvos; oferece "usar como base de mock". |
| `app/src/components/command-center/__tests__/ReplayPanel.test.tsx` | Teste de exibição da resposta salva e botão "usar como base". |
| `app/src/components/rules-lab/RulePresetCard.tsx` | Card individual para um preset — botão "Criar regra" chama `createPresetRule`. |
| `app/src/components/rules-lab/RuleDraftSummary.tsx` | Tela de revisão da regra recém-criada antes de persistir. |
| `app/src/components/rules-lab/RulesImportExport.tsx` | UI de import/export com merge/replace explícito. |
| `app/src/components/rules-lab/__tests__/RulePresetCard.test.tsx` | Teste do clique em preset criando regra editável. |
| `app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx` | Testes de export gerando JSON, import inválido recusado, escolha merge/replace. |
| `app/src/hooks/useRequestSelection.ts` | Hook utilitário que centraliza estado de "request selecionada no inspector" + sincroniza com IndexedDB. |
| `app/src/hooks/__tests__/useRequestSelection.test.ts` | Teste do hook. |
| `app/src/lib/replayHistory.ts` | Helper que monta dados para replay — sem reexecução de rede. Apenas formata response capturada. |
| `app/src/lib/__tests__/replayHistory.test.ts` | Teste de montagem dos dados de replay. |

### Arquivos modificados

| Caminho | Mudança |
| --- | --- |
| `app/src/types/rules.ts` | Adicionar tipos auxiliares `RuleDraft = Omit<Rule, 'id' \| 'createdAt' \| 'updatedAt'>` e `RulePresetId` (`'http_error' \| 'latency_fixed' \| 'latency_range' \| 'empty_response' \| 'broken_json'`). |
| `app/src/types/intercepted.ts` | Adicionar campo opcional `generatedRuleId?: string` em `InterceptedResponse` para vincular request → regra criada via Quick Mock. |
| `app/src/types/messages.ts` | Não vamos adicionar nenhuma message nova nesta entrega — Quick Mock e Rules Lab gravam direto via `useRules` (chrome.storage.local). Ajustar comentário acima da union para deixar isso explícito. |
| `app/src/routes.tsx` | Substituir rotas: `/` agora é redirect para `/command-center`; adicionar `/command-center`, `/rules-lab`. Manter `/request-history` (legado) com aviso de migração? — não, trocamos por `/command-center` direto. Ver Task 3.1 para decisão final. |
| `app/src/pages/Layout.tsx` | Sem mudança estrutural, mas o Layout passa a aceitar `children` que ocupam altura total (necessário para inspector lateral). |
| `app/src/components/layout/AppSidebar.tsx` | Atualizar `navItems`: substituir "Histórico" + "Configurações" por "Command Center" + "Rules Lab". Ícones via `lucide-icon`. |
| `app/src/components/layout/SiteHeader.tsx` | Substituir `Icon name="…"` por `lucide-icon`. Estados visuais permanecem. |
| `app/src/components/layout/NavMain.tsx` | Aceitar componente React como `icon` (não mais string). |
| `app/src/components/RequestTable.tsx` | Mantido como wrapper, mas passa a expor um callback `onSelect` sem auto-abrir modal. |
| `app/src/components/requests/data-table.tsx` | Substituir `Icon name="…"` (paginação, live tail, limpar histórico) por `lucide-icon`. |
| `app/src/components/requests/columns.tsx` | Substituir uso de `Icon` por `lucide-icon`. |
| `app/src/pages/Settings.tsx` | Manter? — não. Renomear conteúdo para a nova `RulesLab.tsx` e excluir `Settings.tsx` quando `RulesLab` estiver pronta. |
| `app/src/pages/RequestHistory.tsx` | Eventualmente substituído por `CommandCenter.tsx`. Excluído na Task 3.7. |
| `app/src/components/ResponseDialog.tsx` | Mantido para casos específicos (edição de payload grande, imagem grande). Inspector NÃO usa o dialog para leitura padrão. |
| `app/src/components/rules/RuleEditor.tsx` | Aproveitado dentro de Rules Lab quando o usuário clica "Editar" num card. Sem mudança de API. |
| `app/src/components/rules/RuleTable.tsx` | Mantido como base do listing dentro de RulesLab. Substituir ícones. |
| `app/src/components/ui/icon.tsx` | Marcar como `@deprecated` no JSDoc, manter para módulos legados. Não importar mais em superfícies novas. |

### Estrutura final (resumo)

```
app/src/
├── components/
│   ├── command-center/
│   │   ├── RequestTimeline.tsx
│   │   ├── RequestInspector.tsx
│   │   ├── QuickMockPanel.tsx
│   │   └── ReplayPanel.tsx
│   ├── rules-lab/
│   │   ├── RulePresetCard.tsx
│   │   ├── RuleDraftSummary.tsx
│   │   └── RulesImportExport.tsx
│   └── ui/
│       └── lucide-icon.tsx       (novo)
├── domain/
│   ├── quickMock.ts              (novo)
│   ├── sensitiveHeaders.ts       (novo)
│   ├── rulePresets.ts            (novo)
│   └── rulesIO.ts                (novo)
├── hooks/
│   └── useRequestSelection.ts    (novo)
├── lib/
│   └── replayHistory.ts          (novo)
└── pages/
    ├── CommandCenter.tsx         (novo)
    └── RulesLab.tsx              (novo)
```

---

# Phase 0 — Fundação visual (lucide-react + ícones)

**Objetivo:** Eliminar o bug do ícone gigante (Material Icons como fonte ausente) substituindo pela biblioteca padrão do shadcn (`lucide-react`, já instalada). Implementar antes de qualquer UI nova porque tudo de Command Center / Rules Lab depende desses ícones.

### Task 0.1: Confirmar `iconLibrary` do shadcn

**Files:**
- Read: `app/components.json`
- Modify: `app/components.json:1-16` (apenas se a chave `iconLibrary` estiver ausente)

- [ ] **Step 1: Inspecionar config atual**

```bash
cd app && cat components.json
```

Esperado: o JSON listado no header do plano. Se já tiver `"iconLibrary": "lucide"`, pular Step 2.

- [ ] **Step 2: Adicionar `iconLibrary` se faltar**

Se `iconLibrary` não estiver presente, editar `app/components.json`:

```json
{
	"$schema": "https://ui.shadcn.com/schema.json",
	"style": "default",
	"rsc": false,
	"tsx": true,
	"iconLibrary": "lucide",
	"tailwind": {
		"config": "",
		"css": "src/styles/globals.css",
		"baseColor": "slate",
		"cssVariables": true
	},
	"aliases": {
		"components": "@/components",
		"utils": "@/lib/utils"
	}
}
```

- [ ] **Step 3: Confirmar que `lucide-react` já é dependência**

```bash
cd app && node -p "require('./package.json').dependencies['lucide-react']"
```

Esperado: `^0.503.0` (ou versão mais recente). Se ausente, abortar e abrir issue.

- [ ] **Step 4: Commit**

```bash
git add app/components.json
git commit -m "chore(ui): declarar lucide como iconLibrary canônica do shadcn"
```

(Pular se Step 2 não fez alterações.)

---

### Task 0.2: Criar wrapper `LucideIcon`

**Files:**
- Create: `app/src/components/ui/lucide-icon.tsx`
- Test: `app/src/components/ui/__tests__/lucide-icon.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

`app/src/components/ui/__tests__/lucide-icon.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LucideIcon } from '../lucide-icon';

describe('LucideIcon', () => {
	it('renderiza um SVG (não texto) para um ícone conhecido', () => {
		render(<LucideIcon name="play" data-testid="icon-play" />);
		const el = screen.getByTestId('icon-play');
		expect(el.tagName.toLowerCase()).toBe('svg');
	});

	it('aceita className adicional', () => {
		render(<LucideIcon name="play" className="text-red-500" data-testid="icon-play" />);
		expect(screen.getByTestId('icon-play')).toHaveClass('text-red-500');
	});

	it('lança erro se o name não estiver mapeado', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() =>
			render(<LucideIcon name={'inexistente' as any} data-testid="icon-x" />),
		).toThrow(/LucideIcon: ícone "inexistente" não está registrado/);
		spy.mockRestore();
	});
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
cd app && npx vitest run src/components/ui/__tests__/lucide-icon.test.tsx
```

Esperado: FAIL (`Cannot find module '../lucide-icon'`).

- [ ] **Step 3: Implementar wrapper**

`app/src/components/ui/lucide-icon.tsx`:

```tsx
import React from 'react';
import {
	Activity,
	AlertTriangle,
	ArrowDownToLine,
	ArrowUpDown,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Circle,
	Copy,
	Download,
	Edit3,
	FileJson,
	FlaskConical,
	History,
	Hourglass,
	Image as ImageIcon,
	ImageOff,
	Info,
	LayoutDashboard,
	Plus,
	RefreshCw,
	RotateCcw,
	Save,
	Settings as SettingsIcon,
	StopCircle,
	Tab as TabIcon,
	Trash2,
	Upload,
	X,
	XCircle,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
	activity: Activity,
	'alert-triangle': AlertTriangle,
	'arrow-down-to-line': ArrowDownToLine,
	'arrow-up-down': ArrowUpDown,
	check: Check,
	'check-circle': CheckCircle2,
	'chevron-left': ChevronLeft,
	'chevron-right': ChevronRight,
	'chevrons-left': ChevronsLeft,
	'chevrons-right': ChevronsRight,
	circle: Circle,
	copy: Copy,
	download: Download,
	edit: Edit3,
	'file-json': FileJson,
	flask: FlaskConical,
	history: History,
	hourglass: Hourglass,
	image: ImageIcon,
	'image-off': ImageOff,
	info: Info,
	layout: LayoutDashboard,
	plus: Plus,
	refresh: RefreshCw,
	'rotate-ccw': RotateCcw,
	save: Save,
	settings: SettingsIcon,
	stop: StopCircle,
	tab: TabIcon,
	trash: Trash2,
	upload: Upload,
	x: X,
	'x-circle': XCircle,
	'zoom-in': ZoomIn,
	'zoom-out': ZoomOut,
} as const;

export type LucideIconName = keyof typeof ICONS;

export interface LucideIconProps extends Omit<LucideProps, 'ref'> {
	name: LucideIconName;
}

export function LucideIcon({ name, className, ...props }: LucideIconProps) {
	const Component = ICONS[name];
	if (!Component) {
		throw new Error(`LucideIcon: ícone "${String(name)}" não está registrado`);
	}
	return <Component className={cn(className)} aria-hidden="true" {...props} />;
}
```

> **Por que não setar `size` aqui:** primitives shadcn (`Button`, `Badge`) controlam o tamanho via CSS através de `[&_svg]:size-4`, conforme o componente sizing inicia. Forçar `size={16}` no wrapper quebra esse contrato. O caller passa `className="h-4 w-4"` apenas se for fora de um primitive shadcn.

- [ ] **Step 4: Rodar teste para confirmar passagem**

```bash
cd app && npx vitest run src/components/ui/__tests__/lucide-icon.test.tsx
```

Esperado: 3 tests pass.

- [ ] **Step 5: Lint + typecheck**

```bash
cd app && npm run lint && npm run typecheck
```

Esperado: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/ui/lucide-icon.tsx app/src/components/ui/__tests__/lucide-icon.test.tsx
git commit -m "feat(ui): adicionar wrapper LucideIcon para padronizar ícones shadcn"
```

---

### Task 0.3: Migrar `SiteHeader` para `LucideIcon`

**Files:**
- Modify: `app/src/components/layout/SiteHeader.tsx`
- Test: `app/src/components/__tests__/SiteHeader.test.tsx`

- [ ] **Step 1: Atualizar teste para garantir SVG ao invés de texto Material Icons**

Editar `app/src/components/__tests__/SiteHeader.test.tsx` para incluir:

```tsx
it('renderiza o ícone de aba como SVG (não texto Material Icons)', () => {
	render(
		<MemoryRouter>
			<SiteHeader
				targetTab={{ id: 1, title: 'Tab', url: 'https://example.com' }}
				isDebugging={false}
				pendingResponsesCount={0}
				onSelectTabClick={vi.fn()}
				onStartDebugging={vi.fn()}
				onStopDebugging={vi.fn()}
			/>
		</MemoryRouter>,
	);
	const tabButton = screen.getByRole('button', { name: /Tab/i });
	expect(tabButton.querySelector('svg')).not.toBeNull();
	expect(tabButton.textContent).not.toContain('tab');
});
```

(Adapte o teste existente — o arquivo já importa `MemoryRouter` e `vi`. Se ainda não tiver, importe.)

- [ ] **Step 2: Rodar teste para falhar**

```bash
cd app && npx vitest run src/components/__tests__/SiteHeader.test.tsx
```

Esperado: FAIL — `expected svg, got null`.

- [ ] **Step 3: Substituir `Icon` por `LucideIcon` em `SiteHeader.tsx`**

Em `app/src/components/layout/SiteHeader.tsx`:

- Trocar `import { Icon } from '@/components/ui/icon';` por `import { LucideIcon } from '@/components/ui/lucide-icon';`
- Substituir `<Icon name="tab" className="flex-shrink-0" />` por `<LucideIcon name="tab" className="h-4 w-4 flex-shrink-0" />`
- Substituir `<Icon name="play_arrow" />` por `<LucideIcon name="activity" className="h-4 w-4" />` (botão "Iniciar")
- Substituir `<Icon name="stop" />` por `<LucideIcon name="stop" className="h-4 w-4" />` (botão "Parar")

- [ ] **Step 4: Rodar teste para confirmar passagem**

```bash
cd app && npx vitest run src/components/__tests__/SiteHeader.test.tsx
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/SiteHeader.tsx app/src/components/__tests__/SiteHeader.test.tsx
git commit -m "refactor(layout): migrar SiteHeader para LucideIcon"
```

---

### Task 0.4: Migrar `AppSidebar` + `NavMain` para `LucideIcon`

**Files:**
- Modify: `app/src/components/layout/AppSidebar.tsx`
- Modify: `app/src/components/layout/NavMain.tsx`
- Test: `app/src/components/__tests__/AppSidebar.test.tsx`

- [ ] **Step 1: Atualizar tipo de `NavMain` para aceitar componente React**

`app/src/components/layout/NavMain.tsx` — mudar:

```tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIconName } from '@/components/ui/lucide-icon';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import {
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuBadge,
} from '@/components/ui/sidebar';

interface NavItem {
	title: string;
	path: string;
	icon: LucideIconName;
	count?: number;
}

interface NavMainProps {
	items: NavItem[];
	className?: string;
}

export function NavMain({ items, className }: NavMainProps) {
	return (
		<div className={cn('py-2', className)}>
			<div className="px-3 py-2">
				<h2 className="mb-2 px-2 text-xs font-semibold tracking-tight">Principal</h2>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.path}>
							<SidebarMenuButton asChild>
								<NavLink
									to={item.path}
									className={({ isActive }) =>
										cn(
											'transition-colors',
											isActive ? 'text-primary font-medium' : 'text-foreground',
										)
									}
									end={item.path === '/'}
								>
									<LucideIcon name={item.icon} className="mr-2 h-4 w-4" />
									<span>{item.title}</span>
									{item.count !== undefined && item.count > 0 && (
										<SidebarMenuBadge>{item.count}</SidebarMenuBadge>
									)}
								</NavLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Atualizar `AppSidebar` para passar nomes Lucide**

`app/src/components/layout/AppSidebar.tsx` — substituir o `navItems`:

```tsx
import type { LucideIconName } from '@/components/ui/lucide-icon';
// …
const navItems: Array<{ title: string; path: string; icon: LucideIconName; count: number }> = [
	{ title: 'Command Center', path: '/command-center', icon: 'layout', count: 0 },
	{ title: 'Rules Lab', path: '/rules-lab', icon: 'flask', count: 0 },
];
```

Remover o import `import { Icon } from '@/components/ui/icon';` se ele estiver no arquivo. (Se não estiver, pular.)

- [ ] **Step 3: Atualizar teste `AppSidebar.test.tsx`**

Atualizar expectativas para os novos labels:

```tsx
expect(screen.getByText('Command Center')).toBeInTheDocument();
expect(screen.getByText('Rules Lab')).toBeInTheDocument();
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/components/__tests__/AppSidebar.test.tsx src/components/__tests__/SiteHeader.test.tsx
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/AppSidebar.tsx app/src/components/layout/NavMain.tsx app/src/components/__tests__/AppSidebar.test.tsx
git commit -m "refactor(layout): migrar sidebar para LucideIcon e renomear nav para Command Center / Rules Lab"
```

---

### Task 0.5: Migrar `data-table.tsx` e `columns.tsx`

**Files:**
- Modify: `app/src/components/requests/data-table.tsx`
- Modify: `app/src/components/requests/columns.tsx`

- [ ] **Step 1: Substituir todos os `<Icon name="…" />` em `data-table.tsx`**

Mapeamento (aplicar `replace_all` no Edit tool quando a string aparecer só uma vez; senão case a case):

| Antes | Depois |
| --- | --- |
| `<Icon name="fiber_manual_record" className="h-4 w-4 mr-1 text-green-500 animate-pulse" />` | `<LucideIcon name="circle" className="h-4 w-4 mr-1 text-green-500 animate-pulse fill-current" />` |
| `<Icon name="refresh" className="h-4 w-4 mr-1" />` | `<LucideIcon name="refresh" className="h-4 w-4 mr-1" />` |
| `<Icon name="delete" className="h-4 w-4 mr-1" />` | `<LucideIcon name="trash" className="h-4 w-4 mr-1" />` |
| `<Icon name="first_page" className="h-4 w-4" />` | `<LucideIcon name="chevrons-left" className="h-4 w-4" />` |
| `<Icon name="navigate_before" className="h-4 w-4" />` | `<LucideIcon name="chevron-left" className="h-4 w-4" />` |
| `<Icon name="navigate_next" className="h-4 w-4" />` | `<LucideIcon name="chevron-right" className="h-4 w-4" />` |
| `<Icon name="last_page" className="h-4 w-4" />` | `<LucideIcon name="chevrons-right" className="h-4 w-4" />` |

Trocar `import { Icon } from '@/components/ui/icon';` por `import { LucideIcon } from '@/components/ui/lucide-icon';`.

- [ ] **Step 2: Substituir em `columns.tsx`**

O arquivo importa `Icon` mas o uso atual é só simbólico (variável `icon` nos status). Atualizar para passar nome Lucide e renderizar via `LucideIcon`:

```tsx
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
// …
let iconName: LucideIconName = 'check-circle';
if (hasCaptureError) {
	variant = 'destructive';
	label = 'Falha';
	iconName = 'alert-triangle';
} else if (isIntercepted) {
	variant = 'destructive';
	label = 'Aguardando';
	iconName = 'hourglass';
} else if (wasIntercepted) {
	variant = 'default';
	label = 'Modificado';
	iconName = 'edit';
} else if (isMocked) {
	variant = 'secondary';
	label = 'Mockado';
	iconName = 'copy';
}

return (
	<Badge variant={variant} className="text-xs whitespace-nowrap inline-flex items-center gap-1">
		<LucideIcon name={iconName} className="h-3 w-3" />
		{label}
	</Badge>
);
```

Remover o import `Icon` legado.

- [ ] **Step 3: Rodar lint + typecheck + suíte**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

Esperado: tudo verde. Se falhar em outro arquivo por causa do `Icon` removido daqui, anotar e corrigir antes de commitar (não deve acontecer — esses arquivos só importam `Icon` localmente).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/requests/data-table.tsx app/src/components/requests/columns.tsx
git commit -m "refactor(requests): trocar Material Icons por LucideIcon na data-table"
```

---

### Task 0.6: Marcar `Icon` legado como `@deprecated`

**Files:**
- Modify: `app/src/components/ui/icon.tsx`

- [ ] **Step 1: Adicionar JSDoc**

Editar o arquivo:

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
	name: string;
}

/**
 * @deprecated Use `LucideIcon` de `@/components/ui/lucide-icon`. Este wrapper
 * depende da fonte Material Icons e renderiza o nome como texto se a fonte
 * estiver ausente — bug visível no botão "fechar" do dialog antigo.
 *
 * Mantido apenas para superfícies legadas ainda não migradas (ResponseDialog,
 * RuleEditor). Não use em novas superfícies.
 */
export function Icon({ name, className, ...props }: IconProps) {
	return (
		<span className={cn('material-icons', className)} {...props}>
			{name}
		</span>
	);
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/icon.tsx
git commit -m "chore(ui): marcar Icon legado como deprecated em favor de LucideIcon"
```

---

# Phase 1 — Funções puras de domínio

**Objetivo:** Implementar e testar as três funções puras (`buildQuickMockDraft`, `createPresetRule`, `validateRuleImport`) antes de qualquer UI consumir. TDD strict.

### Task 1.1: Definir tipos `RuleDraft` e `RulePresetId`

**Files:**
- Modify: `app/src/types/rules.ts`
- Test: `app/src/domain/__tests__/quickMock.test.ts` (criado vazio na próxima task)

- [ ] **Step 1: Adicionar exports no fim de `rules.ts`**

```ts
// Forma serializada de uma regra antes de receber id/timestamps do storage.
export type RuleDraft = Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>;

// Identificadores estáveis para presets de Rules Lab.
export type RulePresetId =
	| 'http_error_500'
	| 'http_error_404'
	| 'http_error_401'
	| 'http_error_403'
	| 'latency_fixed'
	| 'latency_range'
	| 'empty_response'
	| 'broken_json';
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/rules.ts
git commit -m "feat(types): adicionar RuleDraft e RulePresetId"
```

---

### Task 1.2: Helpers de headers sensíveis

**Files:**
- Create: `app/src/domain/sensitiveHeaders.ts`
- Test: `app/src/domain/__tests__/sensitiveHeaders.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`app/src/domain/__tests__/sensitiveHeaders.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { isSensitiveHeader, maskHeaderValue } from '../sensitiveHeaders';

describe('isSensitiveHeader', () => {
	test.each([
		['authorization', true],
		['Authorization', true],
		['cookie', true],
		['Set-Cookie', true],
		['x-api-key', true],
		['proxy-authorization', true],
		['content-type', false],
		['accept', false],
		['user-agent', false],
	])('%s -> %s', (name, expected) => {
		expect(isSensitiveHeader(name)).toBe(expected);
	});
});

describe('maskHeaderValue', () => {
	test('mascara valor de header sensível mantendo comprimento aproximado', () => {
		expect(maskHeaderValue('authorization', 'Bearer abc123def456')).toBe('•••••• (mascarado)');
	});
	test('retorna valor original quando o header não é sensível', () => {
		expect(maskHeaderValue('content-type', 'application/json')).toBe('application/json');
	});
	test('mascara mesmo se o valor for vazio (não fabrica conteúdo)', () => {
		expect(maskHeaderValue('cookie', '')).toBe('•••••• (mascarado)');
	});
});
```

- [ ] **Step 2: Rodar para falhar**

```bash
cd app && npx vitest run src/domain/__tests__/sensitiveHeaders.test.ts
```

Esperado: FAIL (`Cannot find module '../sensitiveHeaders'`).

- [ ] **Step 3: Implementar**

`app/src/domain/sensitiveHeaders.ts`:

```ts
const SENSITIVE_HEADERS = new Set([
	'authorization',
	'proxy-authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-auth-token',
	'x-csrf-token',
	'x-xsrf-token',
]);

export function isSensitiveHeader(name: string): boolean {
	return SENSITIVE_HEADERS.has(name.toLowerCase());
}

export function maskHeaderValue(name: string, value: string): string {
	if (!isSensitiveHeader(name)) return value;
	return '•••••• (mascarado)';
}
```

- [ ] **Step 4: Rodar para passar**

```bash
cd app && npx vitest run src/domain/__tests__/sensitiveHeaders.test.ts
```

Esperado: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/sensitiveHeaders.ts app/src/domain/__tests__/sensitiveHeaders.test.ts
git commit -m "feat(domain): adicionar helpers de headers sensíveis (mask + check)"
```

---

### Task 1.3: `buildQuickMockDraft` — defaults seguros

**Files:**
- Create: `app/src/domain/quickMock.ts`
- Test: `app/src/domain/__tests__/quickMock.test.ts`

- [ ] **Step 1: Escrever teste de defaults falhando**

`app/src/domain/__tests__/quickMock.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { buildQuickMockDraft, type QuickMockOptions } from '../quickMock';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users?page=1',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1_700_000_000_000,
	mimeType: 'application/json',
	body: '{"ok":true}',
	response: {
		headers: { 'content-type': 'application/json' },
		body: '{"ok":true}',
	},
	request: {
		headers: { authorization: 'Bearer secret', accept: 'application/json' },
	},
	...overrides,
});

const baseOptions = (overrides: Partial<QuickMockOptions> = {}): QuickMockOptions => ({
	headerMatchers: [],
	includeQueryString: false,
	...overrides,
});

describe('buildQuickMockDraft — defaults', () => {
	test('gera matchers de URL (host+pathname) e método obrigatório', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const draft = result.draft;
		expect(draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'url',
					pattern: 'api.example.com/users',
					isRegex: false,
					enabled: true,
				}),
				expect.objectContaining({ type: 'method', method: 'GET', enabled: true }),
			]),
		);
	});

	test('ignora query string por padrão', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		const url = result.draft.matchers.find((m) => m.type === 'url');
		expect(url && 'pattern' in url ? url.pattern : '').not.toContain('page=1');
	});

	test('action mock reusa status, headers, body e mimeType reais', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 200,
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			contentType: 'application/json',
			statusPhrase: 'OK',
		});
	});

	test('nome da regra é derivado de host+pathname', () => {
		const result = buildQuickMockDraft(baseRequest(), baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.name).toBe('Mock para api.example.com/users');
	});
});
```

- [ ] **Step 2: Rodar para falhar**

```bash
cd app && npx vitest run src/domain/__tests__/quickMock.test.ts
```

Esperado: FAIL (`Cannot find module '../quickMock'`).

- [ ] **Step 3: Implementar versão mínima**

`app/src/domain/quickMock.ts`:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import type {
	HeaderMatcher,
	Matcher,
	MockAction,
	RuleDraft,
} from '@/types/rules';

export interface QuickMockHeaderSelection {
	headerType: 'request' | 'response';
	name: string;
	value: string;
}

export interface QuickMockOptions {
	headerMatchers: QuickMockHeaderSelection[];
	includeQueryString: boolean;
}

export type QuickMockErrorCode =
	| 'method_missing'
	| 'body_unavailable'
	| 'capture_error'
	| 'header_value_missing';

export interface QuickMockError {
	code: QuickMockErrorCode;
	message: string;
}

export type QuickMockResult =
	| { ok: true; draft: RuleDraft }
	| { ok: false; error: QuickMockError };

function urlPattern(rawUrl: string, includeQueryString: boolean): string {
	const url = new URL(rawUrl);
	const base = url.host + url.pathname;
	return includeQueryString && url.search ? base + url.search : base;
}

function getResponseHeaders(req: InterceptedResponse): Record<string, string> {
	return req.response?.headers ?? req.headers;
}

function getResponseBody(req: InterceptedResponse): string | undefined {
	if (req.response && 'body' in req.response) return req.response.body;
	return req.body;
}

export function buildQuickMockDraft(
	request: InterceptedResponse,
	options: QuickMockOptions,
): QuickMockResult {
	if (request.captureError) {
		return {
			ok: false,
			error: { code: 'capture_error', message: request.captureError },
		};
	}
	if (!request.method) {
		return {
			ok: false,
			error: {
				code: 'method_missing',
				message: 'Não é possível criar mock sem o método HTTP original.',
			},
		};
	}

	const pattern = urlPattern(request.url, options.includeQueryString);

	const matchers: Matcher[] = [
		{ type: 'url', enabled: true, pattern, isRegex: false },
		{ type: 'method', enabled: true, method: request.method },
	];

	for (const selection of options.headerMatchers) {
		if (!selection.value) {
			return {
				ok: false,
				error: {
					code: 'header_value_missing',
					message: `Header "${selection.name}" foi marcado mas não tem valor capturado.`,
				},
			};
		}
		const headerMatcher: HeaderMatcher = {
			type: 'header',
			enabled: true,
			headerType: selection.headerType,
			name: selection.name,
			value: selection.value,
		};
		matchers.push(headerMatcher);
	}

	const responseHeaders = getResponseHeaders(request);
	const responseBody = getResponseBody(request);

	const action: MockAction = {
		type: 'mock',
		enabled: true,
		status: request.status,
		headers: responseHeaders,
		...(request.statusText ? { statusPhrase: request.statusText } : {}),
		...(responseBody !== undefined ? { body: responseBody } : {}),
		...(request.mimeType !== undefined ? { contentType: request.mimeType } : {}),
	};

	const draft: RuleDraft = {
		name: `Mock para ${pattern}`,
		enabled: true,
		matchers,
		action,
	};

	return { ok: true, draft };
}
```

- [ ] **Step 4: Rodar para passar**

```bash
cd app && npx vitest run src/domain/__tests__/quickMock.test.ts
```

Esperado: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/quickMock.ts app/src/domain/__tests__/quickMock.test.ts
git commit -m "feat(domain): buildQuickMockDraft com defaults seguros (host+pathname+method)"
```

---

### Task 1.4: `buildQuickMockDraft` — header matchers manuais

**Files:**
- Modify: `app/src/domain/__tests__/quickMock.test.ts`

- [ ] **Step 1: Adicionar testes de header matchers**

Adicionar ao arquivo `quickMock.test.ts`:

```ts
describe('buildQuickMockDraft — header matchers', () => {
	test('inclui header matcher selecionado manualmente', () => {
		const result = buildQuickMockDraft(
			baseRequest(),
			baseOptions({
				headerMatchers: [
					{ headerType: 'request', name: 'accept', value: 'application/json' },
				],
			}),
		);
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'header',
					headerType: 'request',
					name: 'accept',
					value: 'application/json',
					enabled: true,
				}),
			]),
		);
	});

	test('falha tipada quando header selecionado não tem valor', () => {
		const result = buildQuickMockDraft(
			baseRequest(),
			baseOptions({
				headerMatchers: [{ headerType: 'request', name: 'accept', value: '' }],
			}),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('header_value_missing');
	});

	test('aceita matcher de response header', () => {
		const result = buildQuickMockDraft(
			baseRequest(),
			baseOptions({
				headerMatchers: [
					{ headerType: 'response', name: 'content-type', value: 'application/json' },
				],
			}),
		);
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'header',
					headerType: 'response',
					name: 'content-type',
				}),
			]),
		);
	});
});
```

- [ ] **Step 2: Rodar (já deve passar — implementação cobre estes casos)**

```bash
cd app && npx vitest run src/domain/__tests__/quickMock.test.ts
```

Esperado: 7 tests pass.

Se falhar, é bug — corrigir `quickMock.ts` antes de commitar.

- [ ] **Step 3: Commit**

```bash
git add app/src/domain/__tests__/quickMock.test.ts
git commit -m "test(domain): cobrir header matchers manuais em buildQuickMockDraft"
```

---

### Task 1.5: `buildQuickMockDraft` — erros de captura e body

**Files:**
- Modify: `app/src/domain/__tests__/quickMock.test.ts`

- [ ] **Step 1: Adicionar testes de erro**

```ts
describe('buildQuickMockDraft — erros', () => {
	test('falha quando captureError presente', () => {
		const result = buildQuickMockDraft(
			baseRequest({ captureError: 'Net::ERR_FAILED' }),
			baseOptions(),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('capture_error');
		expect(result.error.message).toContain('Net::ERR_FAILED');
	});

	test('falha quando método ausente (não fabrica ANY)', () => {
		const req = baseRequest();
		delete (req as { method?: string }).method;
		const result = buildQuickMockDraft(req, baseOptions());
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('method_missing');
	});

	test('aceita body undefined quando body realmente não foi capturado mas response existe vazio', () => {
		const req = baseRequest({
			body: undefined,
			response: { headers: { 'content-type': 'text/plain' } },
		});
		const result = buildQuickMockDraft(req, baseOptions());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect('body' in result.draft.action).toBe(false);
	});

	test('preserva body vazio capturado (resposta realmente vazia)', () => {
		const req = baseRequest({
			body: '',
			response: { headers: {}, body: '' },
		});
		const result = buildQuickMockDraft(req, baseOptions());
		if (!result.ok) throw new Error('esperava ok');
		expect(result.draft.action).toMatchObject({ type: 'mock', body: '' });
	});
});
```

- [ ] **Step 2: Rodar — testes podem falhar**

```bash
cd app && npx vitest run src/domain/__tests__/quickMock.test.ts
```

O teste de "preserva body vazio capturado" deve passar (a impl atual já só omite quando `responseBody` é `undefined`, não `''`). Se algum falhar, corrigir `quickMock.ts`.

- [ ] **Step 3: Confirmar passagem total**

```bash
cd app && npx vitest run src/domain/__tests__/quickMock.test.ts
```

Esperado: 11 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/domain/__tests__/quickMock.test.ts
git commit -m "test(domain): cobrir erros tipados de buildQuickMockDraft (captureError, método ausente, body vazio)"
```

---

### Task 1.6: `createPresetRule`

**Files:**
- Create: `app/src/domain/rulePresets.ts`
- Test: `app/src/domain/__tests__/rulePresets.test.ts`

- [ ] **Step 1: Escrever testes falhando**

`app/src/domain/__tests__/rulePresets.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { UrlMatcher } from '@/types/rules';
import { createPresetRule } from '../rulePresets';

const baseUrlMatcher: UrlMatcher = {
	type: 'url',
	enabled: true,
	pattern: 'api.example.com/data',
	isRegex: false,
};

describe('createPresetRule', () => {
	test('http_error_500 cria mock com status 500 e statusPhrase real', () => {
		const draft = createPresetRule('http_error_500');
		expect(draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
		});
	});

	test.each([
		['http_error_404', 404, 'Not Found'],
		['http_error_401', 401, 'Unauthorized'],
		['http_error_403', 403, 'Forbidden'],
	] as const)('%s gera status %d / phrase %s', (id, status, phrase) => {
		const draft = createPresetRule(id);
		expect(draft.action).toMatchObject({ type: 'mock', status, statusPhrase: phrase });
	});

	test('latency_fixed cria mock com latency mode=fixed', () => {
		const draft = createPresetRule('latency_fixed');
		expect(draft.action).toMatchObject({
			type: 'mock',
			latency: { mode: 'fixed', delayMs: 1000 },
		});
	});

	test('latency_range cria mock com latency mode=range', () => {
		const draft = createPresetRule('latency_range');
		expect(draft.action).toMatchObject({
			type: 'mock',
			latency: { mode: 'range', minMs: 500, maxMs: 2000 },
		});
	});

	test('empty_response cria mock com body vazio (não undefined)', () => {
		const draft = createPresetRule('empty_response');
		expect(draft.action).toMatchObject({ type: 'mock', body: '', status: 200 });
	});

	test('broken_json cria mock com body inválido sintaticamente e content-type json', () => {
		const draft = createPresetRule('broken_json');
		const action = draft.action;
		expect(action.type).toBe('mock');
		if (action.type !== 'mock') return;
		expect(action.contentType).toBe('application/json');
		expect(() => JSON.parse(action.body ?? '')).toThrow();
	});

	test('aceita baseMatcher e o coloca antes dos defaults', () => {
		const draft = createPresetRule('http_error_500', baseUrlMatcher);
		expect(draft.matchers[0]).toEqual(baseUrlMatcher);
	});

	test('sem baseMatcher gera matcher de URL vazio para o usuário preencher (mas marcado disabled para não dar match amplo)', () => {
		const draft = createPresetRule('http_error_500');
		const url = draft.matchers.find((m) => m.type === 'url');
		expect(url).toEqual({ type: 'url', enabled: false, pattern: '', isRegex: false });
	});
});
```

- [ ] **Step 2: Rodar — falha por módulo ausente**

```bash
cd app && npx vitest run src/domain/__tests__/rulePresets.test.ts
```

- [ ] **Step 3: Implementar**

`app/src/domain/rulePresets.ts`:

```ts
import type {
	Matcher,
	MockAction,
	RuleDraft,
	RulePresetId,
	UrlMatcher,
} from '@/types/rules';

interface PresetSpec {
	name: string;
	action: MockAction;
}

const PRESETS: Record<RulePresetId, PresetSpec> = {
	http_error_500: {
		name: 'Erro 500 (Internal Server Error)',
		action: {
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"internal_server_error"}',
		},
	},
	http_error_404: {
		name: 'Erro 404 (Not Found)',
		action: {
			type: 'mock',
			enabled: true,
			status: 404,
			statusPhrase: 'Not Found',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"not_found"}',
		},
	},
	http_error_401: {
		name: 'Erro 401 (Unauthorized)',
		action: {
			type: 'mock',
			enabled: true,
			status: 401,
			statusPhrase: 'Unauthorized',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"unauthorized"}',
		},
	},
	http_error_403: {
		name: 'Erro 403 (Forbidden)',
		action: {
			type: 'mock',
			enabled: true,
			status: 403,
			statusPhrase: 'Forbidden',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"forbidden"}',
		},
	},
	latency_fixed: {
		name: 'Latência fixa (1s)',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			latency: { mode: 'fixed', delayMs: 1000 },
		},
	},
	latency_range: {
		name: 'Latência variável (0.5s–2s)',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			latency: { mode: 'range', minMs: 500, maxMs: 2000 },
		},
	},
	empty_response: {
		name: 'Resposta vazia (200)',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: {},
			body: '',
		},
	},
	broken_json: {
		name: 'JSON quebrado (200 com payload inválido)',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			contentType: 'application/json',
			body: '{"unterminated":',
		},
	},
};

export function createPresetRule(presetId: RulePresetId, baseMatcher?: UrlMatcher): RuleDraft {
	const spec = PRESETS[presetId];
	const matchers: Matcher[] = [];
	if (baseMatcher) {
		matchers.push(baseMatcher);
	} else {
		matchers.push({ type: 'url', enabled: false, pattern: '', isRegex: false });
	}
	matchers.push({ type: 'method', enabled: true, method: 'ANY' });

	return {
		name: spec.name,
		enabled: true,
		matchers,
		action: { ...spec.action },
	};
}
```

> Nota: `broken_json` propositadamente tem `contentType` no top-level (campo opcional do `MockAction`) **e** content-type via `headers` para garantir que tanto rotas que usam `MockAction.contentType` quanto headers nuas peguem o tipo certo. Não é fallback — é dado canônico em dois lugares pela forma do tipo.

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/domain/__tests__/rulePresets.test.ts
```

Esperado: 9 tests pass (`test.each` conta como 3).

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/rulePresets.ts app/src/domain/__tests__/rulePresets.test.ts
git commit -m "feat(domain): adicionar createPresetRule com presets editáveis"
```

---

### Task 1.7: `serializeRules` + `validateRuleImport`

**Files:**
- Create: `app/src/domain/rulesIO.ts`
- Test: `app/src/domain/__tests__/rulesIO.test.ts`

- [ ] **Step 1: Escrever testes**

`app/src/domain/__tests__/rulesIO.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { Rule } from '@/types/rules';
import { serializeRules, validateRuleImport } from '../rulesIO';

const sampleRule: Rule = {
	id: 'r1',
	name: 'Mock A',
	enabled: true,
	matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
	action: { type: 'mock', enabled: true, status: 200, headers: {} },
	createdAt: 1,
	updatedAt: 1,
};

describe('serializeRules', () => {
	test('exporta envelope com schemaVersion e rules', () => {
		const json = serializeRules([sampleRule]);
		const parsed = JSON.parse(json);
		expect(parsed).toMatchObject({
			schemaVersion: 1,
			rules: [sampleRule],
		});
	});
});

describe('validateRuleImport', () => {
	test('aceita JSON válido', () => {
		const result = validateRuleImport({ schemaVersion: 1, rules: [sampleRule] });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rules).toHaveLength(1);
	});

	test('rejeita objeto sem schemaVersion', () => {
		const result = validateRuleImport({ rules: [sampleRule] });
		expect(result.ok).toBe(false);
	});

	test('rejeita schemaVersion desconhecido', () => {
		const result = validateRuleImport({ schemaVersion: 99, rules: [sampleRule] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/schemaVersion/);
	});

	test('rejeita rules não-array', () => {
		const result = validateRuleImport({ schemaVersion: 1, rules: 'foo' });
		expect(result.ok).toBe(false);
	});

	test('rejeita regra sem matchers', () => {
		const broken = { ...sampleRule, matchers: undefined };
		const result = validateRuleImport({ schemaVersion: 1, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/matchers/);
	});

	test('rejeita action.type fora do conjunto', () => {
		const broken = {
			...sampleRule,
			action: { ...sampleRule.action, type: 'desconhecida' },
		};
		const result = validateRuleImport({ schemaVersion: 1, rules: [broken] });
		expect(result.ok).toBe(false);
	});

	test('rejeita string crua', () => {
		expect(validateRuleImport('not an object').ok).toBe(false);
	});
});
```

- [ ] **Step 2: Rodar para falhar**

```bash
cd app && npx vitest run src/domain/__tests__/rulesIO.test.ts
```

- [ ] **Step 3: Implementar**

`app/src/domain/rulesIO.ts`:

```ts
import type { Action, ActionType, Matcher, MatcherType, Rule } from '@/types/rules';

const CURRENT_SCHEMA_VERSION = 1;

const ACTION_TYPES: ReadonlySet<ActionType> = new Set([
	'mock',
	'delay',
	'modify',
	'breakpoint',
]);

const MATCHER_TYPES: ReadonlySet<MatcherType> = new Set(['url', 'method', 'header', 'body']);

export interface RulesExportEnvelope {
	schemaVersion: number;
	rules: Rule[];
}

export type RulesImportResult =
	| { ok: true; rules: Rule[] }
	| { ok: false; error: string };

export function serializeRules(rules: Rule[]): string {
	const envelope: RulesExportEnvelope = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		rules,
	};
	return JSON.stringify(envelope, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMatcher(value: unknown): value is Matcher {
	if (!isPlainObject(value)) return false;
	const type = value.type;
	if (typeof type !== 'string' || !MATCHER_TYPES.has(type as MatcherType)) return false;
	if (typeof value.enabled !== 'boolean') return false;
	return true;
}

function validateAction(value: unknown): value is Action {
	if (!isPlainObject(value)) return false;
	if (typeof value.type !== 'string' || !ACTION_TYPES.has(value.type as ActionType)) return false;
	if (typeof value.enabled !== 'boolean') return false;
	return true;
}

function validateRule(value: unknown): { ok: true; rule: Rule } | { ok: false; error: string } {
	if (!isPlainObject(value)) return { ok: false, error: 'regra não é objeto' };
	if (typeof value.id !== 'string') return { ok: false, error: 'regra sem id válido' };
	if (typeof value.name !== 'string') return { ok: false, error: 'regra sem name' };
	if (typeof value.enabled !== 'boolean') return { ok: false, error: 'regra sem enabled' };
	if (!Array.isArray(value.matchers))
		return { ok: false, error: 'regra sem matchers (deve ser array)' };
	if (!value.matchers.every(validateMatcher))
		return { ok: false, error: 'matcher inválido na regra' };
	if (!validateAction(value.action)) return { ok: false, error: 'action inválida' };
	if (typeof value.createdAt !== 'number') return { ok: false, error: 'createdAt ausente' };
	if (typeof value.updatedAt !== 'number') return { ok: false, error: 'updatedAt ausente' };
	return { ok: true, rule: value as unknown as Rule };
}

export function validateRuleImport(value: unknown): RulesImportResult {
	if (!isPlainObject(value)) return { ok: false, error: 'arquivo não é objeto JSON' };
	if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		return { ok: false, error: `schemaVersion ${value.schemaVersion} não suportado` };
	}
	if (!Array.isArray(value.rules)) {
		return { ok: false, error: 'rules deve ser um array' };
	}

	const rules: Rule[] = [];
	for (const raw of value.rules) {
		const validated = validateRule(raw);
		if (!validated.ok) return { ok: false, error: validated.error };
		rules.push(validated.rule);
	}
	return { ok: true, rules };
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/domain/__tests__/rulesIO.test.ts
```

Esperado: 8 tests pass.

- [ ] **Step 5: Lint + typecheck completos**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

Esperado: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add app/src/domain/rulesIO.ts app/src/domain/__tests__/rulesIO.test.ts
git commit -m "feat(domain): serializeRules + validateRuleImport com schemaVersion"
```

---

# Phase 2 — Command Center + Request Inspector

**Objetivo:** Substituir o uso de modal padrão para leitura de request por um inspector lateral persistente. Manter o modal existente apenas para edição de payload grande/imagem.

### Task 2.1: Adicionar campo `generatedRuleId` em `InterceptedResponse`

**Files:**
- Modify: `app/src/types/intercepted.ts`
- Modify: `app/src/domain/__tests__/intercepted.test.ts` (se afetar normalização)

- [ ] **Step 1: Adicionar campo opcional**

Em `app/src/types/intercepted.ts`, adicionar dentro de `InterceptedResponse`:

```ts
	/** ID da regra gerada via Quick Mock a partir desta request, quando aplicável. */
	generatedRuleId?: string;
```

- [ ] **Step 2: Confirmar typecheck**

```bash
cd app && npm run typecheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/intercepted.ts
git commit -m "feat(types): adicionar generatedRuleId em InterceptedResponse"
```

---

### Task 2.2: Hook `useRequestSelection`

**Files:**
- Create: `app/src/hooks/useRequestSelection.ts`
- Test: `app/src/hooks/__tests__/useRequestSelection.test.ts`

- [ ] **Step 1: Escrever teste**

`app/src/hooks/__tests__/useRequestSelection.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { useRequestSelection } from '../useRequestSelection';

const sample = {
	abc: {
		url: 'https://api.example.com/x',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1,
	},
	def: {
		url: 'https://api.example.com/y',
		method: 'POST',
		status: 500,
		statusText: 'Server Error',
		headers: {},
		type: 'XHR',
		timestamp: 2,
	},
} as const;

describe('useRequestSelection', () => {
	test('seleciona uma request por id', () => {
		const { result } = renderHook(() => useRequestSelection(sample));
		expect(result.current.selectedId).toBeNull();

		act(() => {
			result.current.select('abc');
		});

		expect(result.current.selectedId).toBe('abc');
		expect(result.current.selected).toMatchObject({ url: 'https://api.example.com/x' });
	});

	test('clearSelection volta ao estado inicial', () => {
		const { result } = renderHook(() => useRequestSelection(sample));
		act(() => result.current.select('def'));
		act(() => result.current.clear());
		expect(result.current.selectedId).toBeNull();
		expect(result.current.selected).toBeNull();
	});

	test('quando id selecionado some do conjunto, selected vira null', () => {
		const { result, rerender } = renderHook(
			({ data }) => useRequestSelection(data),
			{ initialProps: { data: sample as Record<string, any> } },
		);
		act(() => result.current.select('abc'));
		expect(result.current.selected).not.toBeNull();
		rerender({ data: { def: sample.def } });
		expect(result.current.selected).toBeNull();
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/hooks/__tests__/useRequestSelection.test.ts
```

- [ ] **Step 3: Implementar**

`app/src/hooks/useRequestSelection.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';

export interface RequestSelectionState {
	selectedId: string | null;
	selected: InterceptedResponse | null;
	select: (id: string) => void;
	clear: () => void;
}

export function useRequestSelection(
	requests: Record<string, InterceptedResponse>,
): RequestSelectionState {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const selected = useMemo<InterceptedResponse | null>(() => {
		if (!selectedId) return null;
		return requests[selectedId] ?? null;
	}, [requests, selectedId]);

	const select = useCallback((id: string) => setSelectedId(id), []);
	const clear = useCallback(() => setSelectedId(null), []);

	return { selectedId, selected, select, clear };
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/hooks/__tests__/useRequestSelection.test.ts
```

Esperado: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useRequestSelection.ts app/src/hooks/__tests__/useRequestSelection.test.ts
git commit -m "feat(hooks): useRequestSelection (id + objeto + clear)"
```

---

### Task 2.3: `RequestTimeline` (extraído de `RequestTable`)

**Files:**
- Create: `app/src/components/command-center/RequestTimeline.tsx`
- Test: `app/src/components/command-center/__tests__/RequestTimeline.test.tsx`

- [ ] **Step 1: Escrever teste**

`app/src/components/command-center/__tests__/RequestTimeline.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RequestTimeline } from '../RequestTimeline';

describe('RequestTimeline', () => {
	const requests = {
		r1: {
			url: 'https://api.example.com/users',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'XHR',
			timestamp: 1,
		},
	};

	test('chama onSelect ao clicar em uma linha', () => {
		const onSelect = vi.fn();
		render(
			<RequestTimeline
				requests={requests as any}
				selectedId={null}
				onSelect={onSelect}
				searchValue=""
				onSearchChange={vi.fn()}
				onClearHistory={vi.fn()}
				autoRefreshEnabled
				pauseAutoRefresh={vi.fn()}
				enableAutoRefresh={vi.fn()}
			/>,
		);
		const row = screen.getByText(/users/);
		fireEvent.click(row);
		expect(onSelect).toHaveBeenCalledWith('r1');
	});

	test('marca a linha selecionada com data-state="selected"', () => {
		const { container } = render(
			<RequestTimeline
				requests={requests as any}
				selectedId="r1"
				onSelect={vi.fn()}
				searchValue=""
				onSearchChange={vi.fn()}
				onClearHistory={vi.fn()}
				autoRefreshEnabled
				pauseAutoRefresh={vi.fn()}
				enableAutoRefresh={vi.fn()}
			/>,
		);
		const selected = container.querySelector('[data-state="selected"]');
		expect(selected).not.toBeNull();
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/components/command-center/__tests__/RequestTimeline.test.tsx
```

- [ ] **Step 3: Implementar como wrapper sobre `DataTable`**

`app/src/components/command-center/RequestTimeline.tsx`:

```tsx
import React, { useMemo } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import { DataTable } from '@/components/requests/data-table';
import { columns } from '@/components/requests/columns';

interface RequestTimelineProps {
	requests: Record<string, InterceptedResponse>;
	selectedId: string | null;
	onSelect: (id: string) => void;
	searchValue: string;
	onSearchChange: (v: string) => void;
	onClearHistory: () => void;
	autoRefreshEnabled: boolean;
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
}

export function RequestTimeline({
	requests,
	selectedId,
	onSelect,
	searchValue,
	onSearchChange,
	onClearHistory,
	autoRefreshEnabled,
	pauseAutoRefresh,
	enableAutoRefresh,
}: RequestTimelineProps) {
	const rows = useMemo(
		() =>
			Object.entries(requests).map(([id, request]) => ({
				id,
				request,
				isSelected: id === selectedId,
			})),
		[requests, selectedId],
	);

	return (
		<DataTable
			columns={columns}
			data={rows}
			onSelect={onSelect}
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			pauseAutoRefresh={pauseAutoRefresh}
			enableAutoRefresh={enableAutoRefresh}
			autoRefreshEnabled={autoRefreshEnabled}
			onClearHistory={onClearHistory}
		/>
	);
}
```

> **Adaptação no `DataTable`:** o `DataTable` atual marca seleção via `row.getIsSelected()`. Para refletir `selectedId` externo, precisaremos em Task 2.3a estender `DataTable` para aceitar `selectedRowId?: string`. Fazer isso na próxima sub-task.

- [ ] **Step 4: Rodar — teste de "data-state=selected" deve falhar**

```bash
cd app && npx vitest run src/components/command-center/__tests__/RequestTimeline.test.tsx
```

Esperado: 1 PASS, 1 FAIL (selecionado).

---

### Task 2.3a: Estender `DataTable` para aceitar `selectedRowId`

**Files:**
- Modify: `app/src/components/requests/data-table.tsx`
- Modify: `app/src/components/command-center/RequestTimeline.tsx`

- [ ] **Step 1: Adicionar prop `selectedRowId` no `DataTable`**

Adicionar à interface `DataTableProps`:

```tsx
selectedRowId?: string;
```

E na renderização do row:

```tsx
<TableRow
	key={row.id}
	data-state={
		// @ts-expect-error - acessar id via original
		row.original.id === selectedRowId ? 'selected' : row.getIsSelected() ? 'selected' : undefined
	}
	className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-accent"
	onClick={() => {
		// @ts-expect-error
		const requestId = row.original.id;
		onSelect(requestId);
	}}
>
```

E aceitar o prop na função `DataTable<...>({…, selectedRowId, …})`.

- [ ] **Step 2: Passar `selectedRowId` em `RequestTimeline`**

```tsx
return (
	<DataTable
		columns={columns}
		data={rows}
		selectedRowId={selectedId ?? undefined}
		onSelect={onSelect}
		// …
	/>
);
```

- [ ] **Step 3: Rodar testes**

```bash
cd app && npx vitest run src/components/command-center/__tests__/RequestTimeline.test.tsx src/pages/__tests__/RequestHistory.test.tsx
```

Esperado: PASS em ambos.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/command-center/RequestTimeline.tsx app/src/components/command-center/__tests__/RequestTimeline.test.tsx app/src/components/requests/data-table.tsx
git commit -m "feat(command-center): RequestTimeline com seleção externa via DataTable.selectedRowId"
```

---

### Task 2.4: `RequestInspector` — header compacto + estados básicos

**Files:**
- Create: `app/src/components/command-center/RequestInspector.tsx`
- Test: `app/src/components/command-center/__tests__/RequestInspector.test.tsx`

- [ ] **Step 1: Escrever testes (5 estados)**

`app/src/components/command-center/__tests__/RequestInspector.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { RequestInspector } from '../RequestInspector';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users/42?token=abc',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"id":42}',
	response: { headers: { 'content-type': 'application/json' }, body: '{"id":42}' },
	request: { headers: { authorization: 'Bearer secret' } },
	...overrides,
});

const noopHandlers = {
	onApprove: vi.fn(),
	onIgnore: vi.fn(),
	onCreateMock: vi.fn(),
	onOpenInRulesLab: vi.fn(),
	onReplay: vi.fn(),
	onClose: vi.fn(),
};

describe('RequestInspector', () => {
	test('mostra estado vazio quando nenhuma request está selecionada', () => {
		render(<RequestInspector request={null} requestId={null} {...noopHandlers} />);
		expect(screen.getByText(/Selecione uma requisição/)).toBeInTheDocument();
	});

	test('renderiza header com método, URL truncada, status e duração', () => {
		render(
			<RequestInspector
				request={baseRequest({ duration: 123 })}
				requestId="r1"
				{...noopHandlers}
			/>,
		);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.getByText(/api.example.com/)).toBeInTheDocument();
		expect(screen.getByText('200')).toBeInTheDocument();
		expect(screen.getByText(/123/)).toBeInTheDocument();
	});

	test('mostra captureError quando presente', () => {
		render(
			<RequestInspector
				request={baseRequest({ captureError: 'Net::ERR_FAILED' })}
				requestId="r1"
				{...noopHandlers}
			/>,
		);
		expect(screen.getByText(/Net::ERR_FAILED/)).toBeInTheDocument();
	});

	test('mostra body indisponível quando bodyUnavailableReason presente', () => {
		const req = baseRequest({ bodyUnavailableReason: 'Body too large to capture' });
		delete (req as any).body;
		render(<RequestInspector request={req} requestId="r1" {...noopHandlers} />);
		expect(screen.getByText(/Body too large to capture/)).toBeInTheDocument();
	});

	test('mostra ações de pendente quando isWaiting=true', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				{...noopHandlers}
			/>,
		);
		expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Ignorar/i })).toBeInTheDocument();
	});

	test('esconde ações de pendente quando isWaiting!=true', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: false })}
				requestId="r1"
				{...noopHandlers}
			/>,
		);
		expect(screen.queryByRole('button', { name: /Aprovar/i })).toBeNull();
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/components/command-center/__tests__/RequestInspector.test.tsx
```

- [ ] **Step 3: Implementar inspector base**

`app/src/components/command-center/RequestInspector.tsx`:

```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from '@/components/ui/lucide-icon';
import type { InterceptedResponse, ResponseModifications } from '@/types/intercepted';
import { formatDuration } from '@/components/requests/duration';

interface RequestInspectorProps {
	request: InterceptedResponse | null;
	requestId: string | null;
	onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
	onIgnore: (requestId: string) => Promise<boolean>;
	onCreateMock: (request: InterceptedResponse, requestId: string) => void;
	onOpenInRulesLab: (ruleId: string) => void;
	onReplay: (request: InterceptedResponse) => void;
	onClose: () => void;
}

function truncateMiddle(value: string, maxLength = 80): string {
	if (value.length <= maxLength) return value;
	const half = Math.floor((maxLength - 1) / 2);
	return `${value.slice(0, half)}…${value.slice(-half)}`;
}

export function RequestInspector({
	request,
	requestId,
	onApprove,
	onIgnore,
	onCreateMock,
	onOpenInRulesLab,
	onReplay,
	onClose,
}: RequestInspectorProps) {
	if (!request || !requestId) {
		return (
			<aside className="flex h-full items-center justify-center border-l p-6 text-sm text-muted-foreground">
				Selecione uma requisição na timeline para inspecionar.
			</aside>
		);
	}

	const responseHeaders = request.response?.headers ?? request.headers;
	const requestHeaders = request.request?.headers ?? {};
	const responseBody = request.response?.body ?? request.body;
	const isPending = request.isWaiting === true;

	const handleApprove = async () => {
		await onApprove(requestId, {});
	};
	const handleIgnore = async () => {
		await onIgnore(requestId);
	};

	return (
		<aside className="flex h-full min-h-0 flex-col border-l bg-background">
			<header
				className="grid items-center gap-2 border-b px-4 py-3"
				style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto' }}
			>
				<Badge variant="outline" className="font-mono text-xs">
					{request.method ?? 'Método ausente'}
				</Badge>
				<span
					className="truncate font-mono text-xs"
					title={request.url}
				>
					{truncateMiddle(request.url)}
				</span>
				<Badge variant="outline" className="text-xs">
					{request.status}
				</Badge>
				<span className="text-xs text-muted-foreground">{formatDuration(request.duration)}</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					aria-label="Fechar inspector"
					className="h-8 w-8"
				>
					<LucideIcon name="x" className="h-4 w-4" />
				</Button>
			</header>

			{request.captureError && (
				<div className="m-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
					<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
					<span className="break-words">Falha na captura: {request.captureError}</span>
				</div>
			)}

			{!request.captureError && request.bodyUnavailableReason && (
				<div className="m-4 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
					<LucideIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
					<span className="break-words">{request.bodyUnavailableReason}</span>
				</div>
			)}

			<div className="flex flex-wrap gap-2 px-4 pb-3">
				<Button
					size="sm"
					variant="default"
					onClick={() => onCreateMock(request, requestId)}
					disabled={Boolean(request.captureError)}
					className="gap-2"
				>
					<LucideIcon name="copy" className="h-4 w-4" />
					Criar Mock
				</Button>
				{request.generatedRuleId && (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onOpenInRulesLab(request.generatedRuleId!)}
						className="gap-2"
					>
						<LucideIcon name="flask" className="h-4 w-4" />
						Abrir no Rules Lab
					</Button>
				)}
				<Button
					size="sm"
					variant="outline"
					onClick={() => onReplay(request)}
					className="gap-2"
				>
					<LucideIcon name="rotate-ccw" className="h-4 w-4" />
					Replay
				</Button>
				{isPending && (
					<>
						<Button size="sm" variant="default" onClick={handleApprove} className="gap-2">
							<LucideIcon name="check" className="h-4 w-4" />
							Aprovar
						</Button>
						<Button size="sm" variant="outline" onClick={handleIgnore} className="gap-2">
							<LucideIcon name="x" className="h-4 w-4" />
							Ignorar
						</Button>
					</>
				)}
			</div>

			<Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
				<TabsList className="mx-4 grid grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="request">Request</TabsTrigger>
					<TabsTrigger value="response">Response</TabsTrigger>
					<TabsTrigger value="body">Body</TabsTrigger>
				</TabsList>

				<ScrollArea className="flex-1 px-4 py-3">
					<TabsContent value="overview" className="space-y-2 text-sm">
						<div>
							<span className="font-medium">Tipo: </span>
							{request.type}
						</div>
						<div>
							<span className="font-medium">MIME: </span>
							{request.mimeType ?? 'Sem Content-Type'}
						</div>
						<div>
							<span className="font-medium">Duração: </span>
							{formatDuration(request.duration)}
						</div>
					</TabsContent>

					<TabsContent value="request">
						<HeaderTable headers={requestHeaders} emptyMessage="Sem request headers capturados." />
						{request.request?.postData && (
							<pre className="mt-3 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
								{request.request.postData}
							</pre>
						)}
					</TabsContent>

					<TabsContent value="response">
						<HeaderTable headers={responseHeaders} emptyMessage="Sem response headers capturados." />
					</TabsContent>

					<TabsContent value="body">
						{responseBody === undefined ? (
							<div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
								{request.bodyUnavailableReason ?? 'Corpo da resposta indisponível.'}
							</div>
						) : (
							<pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-xs">
								{responseBody}
							</pre>
						)}
					</TabsContent>
				</ScrollArea>
			</Tabs>
		</aside>
	);
}

function HeaderTable({
	headers,
	emptyMessage,
}: {
	headers: Record<string, string>;
	emptyMessage: string;
}) {
	const entries = Object.entries(headers);
	if (entries.length === 0) {
		return <div className="text-sm text-muted-foreground">{emptyMessage}</div>;
	}
	return (
		<div className="rounded-md border">
			{entries.map(([k, v]) => (
				<div
					key={k}
					className="grid gap-2 border-b px-3 py-2 last:border-b-0"
					style={{ gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr)' }}
				>
					<div className="font-mono text-xs font-semibold text-muted-foreground break-all">
						{k}
					</div>
					<div className="font-mono text-xs break-all">{v}</div>
				</div>
			))}
		</div>
	);
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/components/command-center/__tests__/RequestInspector.test.tsx
```

Esperado: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/command-center/RequestInspector.tsx app/src/components/command-center/__tests__/RequestInspector.test.tsx
git commit -m "feat(command-center): RequestInspector lateral com header compacto, abas e estados"
```

---

### Task 2.5: Página `CommandCenter` compondo Timeline + Inspector

**Files:**
- Create: `app/src/pages/CommandCenter.tsx`
- Test: `app/src/pages/__tests__/CommandCenter.test.tsx`

- [ ] **Step 1: Escrever teste**

`app/src/pages/__tests__/CommandCenter.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CommandCenter from '../CommandCenter';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useAllRequests');
vi.mock('@/hooks/useResponses');
vi.mock('@/hooks/useRules');
vi.mock('@/lib/indexedDB', () => ({
	indexedDBService: { init: vi.fn().mockResolvedValue(undefined) },
}));

describe('CommandCenter', () => {
	beforeEach(() => {
		vi.mocked(useAllRequests).mockReturnValue({
			allRequests: {
				r1: {
					url: 'https://api.example.com/u',
					method: 'GET',
					status: 200,
					statusText: 'OK',
					headers: {},
					type: 'XHR',
					timestamp: 1,
				},
			},
			filteredRequests: {
				r1: {
					url: 'https://api.example.com/u',
					method: 'GET',
					status: 200,
					statusText: 'OK',
					headers: {},
					type: 'XHR',
					timestamp: 1,
				},
			},
			filter: '',
			setFilter: vi.fn(),
			pauseAutoRefresh: vi.fn(),
			enableAutoRefresh: vi.fn(),
			autoRefreshEnabled: true,
			clearAllRequests: vi.fn(),
			getRequestDetails: vi.fn(),
			currentRequest: null,
			currentRequestId: null,
			loading: false,
			loadAllRequests: vi.fn(),
			clearCurrentRequest: vi.fn(),
			dbInitialized: true,
		} as any);

		vi.mocked(useResponses).mockReturnValue({
			pendingResponses: {},
			approveResponse: vi.fn().mockResolvedValue(true),
			ignoreResponse: vi.fn().mockResolvedValue(true),
			clearCurrentResponse: vi.fn(),
		} as any);

		vi.mocked(useRules).mockReturnValue({ rules: [], addRule: vi.fn() } as any);
	});

	test('seleção de request atualiza inspector sem abrir modal', () => {
		render(
			<MemoryRouter>
				<CommandCenter />
			</MemoryRouter>,
		);

		expect(screen.getByText(/Selecione uma requisição/)).toBeInTheDocument();

		const row = screen.getByText('https://api.example.com/u');
		fireEvent.click(row);

		// inspector exibe header compacto agora
		expect(screen.queryByText(/Selecione uma requisição/)).toBeNull();
		expect(screen.getAllByText(/api.example.com/).length).toBeGreaterThan(0);
		// nenhum dialog do shadcn deve estar aberto
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/pages/__tests__/CommandCenter.test.tsx
```

- [ ] **Step 3: Implementar página**

`app/src/pages/CommandCenter.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRequestSelection } from '@/hooks/useRequestSelection';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CommandCenter: React.FC = () => {
	const navigate = useNavigate();
	const {
		filteredRequests,
		filter,
		setFilter,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		clearAllRequests,
	} = useAllRequests();
	const { approveResponse, ignoreResponse } = useResponses();
	const { selectedId, selected, select, clear } = useRequestSelection(filteredRequests);

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [quickMockOpen, setQuickMockOpen] = useState(false);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = () => {
		if (!selected) return;
		setQuickMockOpen(true);
	};

	return (
		<div className="grid h-[calc(100vh-3.5rem)] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,38%)]">
			<section className="min-h-0 overflow-auto p-4">
				<RequestTimeline
					requests={filteredRequests}
					selectedId={selectedId}
					onSelect={select}
					searchValue={filter}
					onSearchChange={setFilter}
					onClearHistory={() => setClearDialogOpen(true)}
					autoRefreshEnabled={autoRefreshEnabled}
					pauseAutoRefresh={pauseAutoRefresh}
					enableAutoRefresh={enableAutoRefresh}
				/>
			</section>

			<section className="min-h-0 overflow-hidden border-t lg:border-l lg:border-t-0">
				<RequestInspector
					request={selected}
					requestId={selectedId}
					onApprove={approveResponse}
					onIgnore={ignoreResponse}
					onCreateMock={handleCreateMock}
					onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
					onReplay={() => {
						/* Tratado dentro da aba Replay do inspector — Phase 5 */
					}}
					onClose={clear}
				/>
			</section>

			{quickMockOpen && selected && selectedId && (
				<QuickMockPanel
					open={quickMockOpen}
					onOpenChange={setQuickMockOpen}
					request={selected}
					requestId={selectedId}
				/>
			)}

			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove todas as requisições. Não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleClearHistory}
							className="bg-red-500 hover:bg-red-600"
						>
							Limpar histórico
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default CommandCenter;
```

> **Sobre `QuickMockPanel`**: o componente é criado na Phase 3. Por agora, deixe um stub local em `app/src/components/command-center/QuickMockPanel.tsx`:
> ```tsx
> export function QuickMockPanel(_: any) { return null; }
> ```
> Isso permite o teste passar e a Task 3.x substituir o stub.

- [ ] **Step 4: Criar stub `QuickMockPanel`**

`app/src/components/command-center/QuickMockPanel.tsx`:

```tsx
import React from 'react';
import type { InterceptedResponse } from '@/types/intercepted';

interface QuickMockPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
}

// Stub — substituído pela implementação real na Phase 3.
export function QuickMockPanel(_: QuickMockPanelProps) {
	return null;
}
```

- [ ] **Step 5: Rodar teste**

```bash
cd app && npx vitest run src/pages/__tests__/CommandCenter.test.tsx
```

Esperado: 1 PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/CommandCenter.tsx app/src/pages/__tests__/CommandCenter.test.tsx app/src/components/command-center/QuickMockPanel.tsx
git commit -m "feat(command-center): página CommandCenter com timeline + inspector lateral"
```

---

### Task 2.6: Atualizar rotas e remover páginas antigas

**Files:**
- Modify: `app/src/routes.tsx`
- Delete: `app/src/pages/RequestHistory.tsx`
- Delete: `app/src/pages/__tests__/RequestHistory.test.tsx`
- Delete: `app/src/pages/Requests.tsx` (se existir como ativo)
- Delete: `app/src/pages/__tests__/Requests.test.tsx`

- [ ] **Step 1: Substituir rotas**

`app/src/routes.tsx`:

```tsx
import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import CommandCenter from './pages/CommandCenter';
import RulesLab from './pages/RulesLab';

const router = createHashRouter([
	{
		path: '/',
		element: <Layout />,
		children: [
			{ index: true, element: <Navigate to="/command-center" replace /> },
			{ path: 'command-center', element: <CommandCenter /> },
			{ path: 'rules-lab', element: <RulesLab /> },
			{ path: 'request-history', element: <Navigate to="/command-center" replace /> },
			{ path: 'requests', element: <Navigate to="/command-center" replace /> },
		],
	},
]);

export default router;
```

> `RulesLab` é criado na Phase 4. Para esta task, criar **stub** primeiro (próxima sub-task).

- [ ] **Step 2: Criar stub `RulesLab`**

`app/src/pages/RulesLab.tsx`:

```tsx
import React from 'react';

const RulesLab: React.FC = () => {
	return (
		<div className="p-6">
			<h1 className="text-xl font-semibold">Rules Lab</h1>
			<p className="text-sm text-muted-foreground">
				Em construção — esta página é finalizada na Fase 4 do plano.
			</p>
		</div>
	);
};

export default RulesLab;
```

- [ ] **Step 3: Apagar páginas antigas**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/distracted-visvesvaraya-ee6856
rm app/src/pages/RequestHistory.tsx
rm app/src/pages/Requests.tsx 2>/dev/null || true
rm app/src/pages/__tests__/RequestHistory.test.tsx
rm app/src/pages/__tests__/Requests.test.tsx 2>/dev/null || true
```

- [ ] **Step 4: Apagar `Settings.tsx` antigo (vai ser substituído por RulesLab na Phase 4)**

Na verdade NÃO apagar agora — `Settings.tsx` ainda contém o fluxo de criação de regra que `RulesLab` vai herdar. Manter por enquanto e remover na Phase 4 quando `RulesLab` substituir.

- [ ] **Step 5: Rodar lint + typecheck + suite**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

Esperado: tudo verde. Se algum import quebrar (ex.: arquivo morto referenciando RequestHistory), corrigir antes de commitar.

- [ ] **Step 6: Commit**

```bash
git add -A app/src/routes.tsx app/src/pages/RulesLab.tsx app/src/pages
git commit -m "feat(routes): substituir Settings/Requests/RequestHistory por command-center + rules-lab (stub)"
```

---

# Phase 3 — Quick Mock integrado

**Objetivo:** Implementar `QuickMockPanel` real, com seleção manual de header matchers, mascaramento de headers sensíveis, preview da regra e salvamento via `useRules`.

### Task 3.1: `QuickMockPanel` — preview + salvar default

**Files:**
- Modify: `app/src/components/command-center/QuickMockPanel.tsx`
- Test: `app/src/components/command-center/__tests__/QuickMockPanel.test.tsx`

- [ ] **Step 1: Escrever teste do happy path**

`app/src/components/command-center/__tests__/QuickMockPanel.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { QuickMockPanel } from '../QuickMockPanel';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

const baseRequest = {
	url: 'https://api.example.com/users?page=1',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	response: { headers: { 'content-type': 'application/json' }, body: '{"ok":true}' },
	request: { headers: { authorization: 'Bearer secret', accept: 'application/json' } },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"ok":true}',
};

describe('QuickMockPanel', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [],
			addRule: vi.fn().mockResolvedValue(true),
		} as any);
	});

	test('preview mostra pattern host+pathname (sem query)', () => {
		render(
			<QuickMockPanel
				open
				onOpenChange={vi.fn()}
				request={baseRequest as any}
				requestId="r1"
			/>,
		);
		expect(screen.getByText('api.example.com/users')).toBeInTheDocument();
		expect(screen.queryByText(/page=1/)).toBeNull();
	});

	test('clica salvar chama addRule com matchers default', async () => {
		const addRule = vi.fn().mockResolvedValue(true);
		vi.mocked(useRules).mockReturnValue({ rules: [], addRule } as any);
		render(
			<QuickMockPanel
				open
				onOpenChange={vi.fn()}
				request={baseRequest as any}
				requestId="r1"
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Salvar mock/i }));

		await waitFor(() => expect(addRule).toHaveBeenCalledTimes(1));
		const [name, matchers, action] = addRule.mock.calls[0];
		expect(name).toBe('Mock para api.example.com/users');
		expect(matchers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'url', pattern: 'api.example.com/users' }),
				expect.objectContaining({ type: 'method', method: 'GET' }),
			]),
		);
		expect(action.type).toBe('mock');
	});
});
```

- [ ] **Step 2: Rodar — falha por stub**

```bash
cd app && npx vitest run src/components/command-center/__tests__/QuickMockPanel.test.tsx
```

- [ ] **Step 3: Implementar real**

`app/src/components/command-center/QuickMockPanel.tsx` (sobrescrever stub):

```tsx
import React, { useMemo, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Badge } from '@/components/ui/badge';
import type { InterceptedResponse } from '@/types/intercepted';
import {
	buildQuickMockDraft,
	type QuickMockHeaderSelection,
	type QuickMockOptions,
} from '@/domain/quickMock';
import { isSensitiveHeader, maskHeaderValue } from '@/domain/sensitiveHeaders';
import { useRules } from '@/hooks/useRules';

interface QuickMockPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
}

interface HeaderRow {
	headerType: 'request' | 'response';
	name: string;
	value: string;
	sensitive: boolean;
	checked: boolean;
}

function buildInitialHeaderRows(request: InterceptedResponse): HeaderRow[] {
	const rows: HeaderRow[] = [];
	const reqHeaders = request.request?.headers ?? {};
	const resHeaders = request.response?.headers ?? request.headers;
	for (const [name, value] of Object.entries(reqHeaders)) {
		rows.push({
			headerType: 'request',
			name,
			value,
			sensitive: isSensitiveHeader(name),
			checked: false,
		});
	}
	for (const [name, value] of Object.entries(resHeaders)) {
		rows.push({
			headerType: 'response',
			name,
			value,
			sensitive: isSensitiveHeader(name),
			checked: false,
		});
	}
	return rows;
}

export function QuickMockPanel({
	open,
	onOpenChange,
	request,
	requestId: _requestId,
}: QuickMockPanelProps) {
	const { addRule } = useRules();
	const [includeQueryString, setIncludeQueryString] = useState(false);
	const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() =>
		buildInitialHeaderRows(request),
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const selections: QuickMockHeaderSelection[] = useMemo(
		() =>
			headerRows
				.filter((row) => row.checked)
				.map((row) => ({ headerType: row.headerType, name: row.name, value: row.value })),
		[headerRows],
	);

	const draftResult = useMemo(() => {
		const options: QuickMockOptions = {
			headerMatchers: selections,
			includeQueryString,
		};
		return buildQuickMockDraft(request, options);
	}, [request, selections, includeQueryString]);

	const handleSave = async () => {
		if (!draftResult.ok) {
			setErrorMessage(draftResult.error.message);
			return;
		}
		setSaving(true);
		setErrorMessage(null);
		try {
			const success = await addRule(
				draftResult.draft.name,
				draftResult.draft.matchers,
				draftResult.draft.action,
			);
			if (!success) {
				setErrorMessage('Falha ao gravar a regra em chrome.storage.local.');
				return;
			}
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	};

	const toggleRow = (index: number) => {
		setHeaderRows((rows) =>
			rows.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row)),
		);
	};

	const draftPattern =
		draftResult.ok && draftResult.draft.matchers.find((m) => m.type === 'url');
	const draftPatternText =
		draftPattern && 'pattern' in draftPattern ? draftPattern.pattern : '—';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Quick Mock</DialogTitle>
					<DialogDescription>
						Crie uma regra a partir da requisição capturada. Headers sensíveis ficam mascarados e
						desmarcados por padrão.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 text-sm">
					<div>
						<span className="font-medium">URL: </span>
						<code className="font-mono">{draftPatternText}</code>
					</div>
					<label className="flex items-center gap-2">
						<Checkbox
							checked={includeQueryString}
							onCheckedChange={(c) => setIncludeQueryString(c === true)}
						/>
						<span>Incluir query string no matcher</span>
					</label>
					<div>
						<span className="font-medium">Método: </span>
						<Badge variant="outline" className="font-mono text-xs">
							{request.method ?? 'Método ausente'}
						</Badge>
					</div>
				</div>

				<div className="mt-4 flex min-h-0 flex-1 flex-col">
					<h3 className="mb-2 text-sm font-medium">Header matchers (opcional)</h3>
					<ScrollArea className="max-h-72 rounded-md border">
						<table className="w-full text-sm">
							<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
								<tr>
									<th className="px-3 py-2 text-left">Inc.</th>
									<th className="px-3 py-2 text-left">Tipo</th>
									<th className="px-3 py-2 text-left">Nome</th>
									<th className="px-3 py-2 text-left">Valor</th>
								</tr>
							</thead>
							<tbody>
								{headerRows.map((row, index) => (
									<tr
										key={`${row.headerType}-${row.name}`}
										className="border-t"
									>
										<td className="px-3 py-2">
											<Checkbox
												checked={row.checked}
												onCheckedChange={() => toggleRow(index)}
												disabled={row.sensitive && row.value.length === 0}
											/>
										</td>
										<td className="px-3 py-2 text-xs uppercase">{row.headerType}</td>
										<td className="px-3 py-2 font-mono text-xs">{row.name}</td>
										<td className="px-3 py-2 font-mono text-xs break-all">
											{row.sensitive ? maskHeaderValue(row.name, row.value) : row.value}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</ScrollArea>
				</div>

				{!draftResult.ok && (
					<div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{draftResult.error.message}</span>
					</div>
				)}

				{errorMessage && (
					<div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				)}

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
						Cancelar
					</Button>
					<Button onClick={handleSave} disabled={!draftResult.ok || saving} className="gap-2">
						<LucideIcon name="save" className="h-4 w-4" />
						{saving ? 'Salvando…' : 'Salvar mock'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/components/command-center/__tests__/QuickMockPanel.test.tsx
```

Esperado: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/command-center/QuickMockPanel.tsx app/src/components/command-center/__tests__/QuickMockPanel.test.tsx
git commit -m "feat(quick-mock): QuickMockPanel com preview + salvamento via useRules"
```

---

### Task 3.2: Header sensível mascarado e desmarcado por padrão

**Files:**
- Modify: `app/src/components/command-center/__tests__/QuickMockPanel.test.tsx`

- [ ] **Step 1: Adicionar teste**

```tsx
test('header sensível (authorization) aparece mascarado e desmarcado', () => {
	render(
		<QuickMockPanel
			open
			onOpenChange={vi.fn()}
			request={baseRequest as any}
			requestId="r1"
		/>,
	);
	const row = screen.getByText('authorization').closest('tr');
	expect(row).not.toBeNull();
	expect(row!.textContent).toContain('•••••• (mascarado)');
	const checkbox = row!.querySelector('button[role="checkbox"]');
	expect(checkbox).not.toBeNull();
	expect(checkbox!.getAttribute('data-state')).toBe('unchecked');
});
```

- [ ] **Step 2: Rodar — deve passar (mascaramento já implementado)**

```bash
cd app && npx vitest run src/components/command-center/__tests__/QuickMockPanel.test.tsx
```

Esperado: 3 tests pass. Se falhar, ajustar implementação.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/command-center/__tests__/QuickMockPanel.test.tsx
git commit -m "test(quick-mock): cobrir mascaramento de header sensível"
```

---

### Task 3.3: Indicar request que gerou mock + abrir no Rules Lab

**Files:**
- Modify: `app/src/components/command-center/QuickMockPanel.tsx`
- Modify: `app/src/components/command-center/RequestInspector.tsx` (botão "Abrir no Rules Lab" — já existe; testar)
- Modify: `app/src/components/command-center/__tests__/QuickMockPanel.test.tsx`

> **Decisão**: persistir `generatedRuleId` na request requer chamada ao background (`patchRequest`). Para evitar adicionar uma message nova nesta entrega (objetivo "menor caminho compatível"), guardamos apenas em estado local de `CommandCenter` — `generatedRuleId` no tipo é opcional e só é populado se uma persistência futura preencher (issue follow-up). Para o pacote inicial, o botão "Abrir no Rules Lab" usa o id retornado pelo `addRule` apenas no fluxo do panel (callback `onCreated`).

- [ ] **Step 1: Adicionar callback `onCreated` em `QuickMockPanel`**

Modificar interface e fluxo:

```tsx
interface QuickMockPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
	onCreated?: (ruleName: string) => void;
}
```

E após sucesso de `addRule`:

```tsx
if (success) {
	onCreated?.(draftResult.draft.name);
	onOpenChange(false);
}
```

> Nota: `useRules.addRule` atual retorna `boolean`, não o id. Para evitar refatoração ampla agora, expor apenas o nome no callback. Issue follow-up pode estender `addRule` para retornar o `Rule` criado.

- [ ] **Step 2: Modificar teste para cobrir callback**

```tsx
test('chama onCreated após salvar com o nome da regra', async () => {
	const onCreated = vi.fn();
	render(
		<QuickMockPanel
			open
			onOpenChange={vi.fn()}
			request={baseRequest as any}
			requestId="r1"
			onCreated={onCreated}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: /Salvar mock/i }));
	await waitFor(() => expect(onCreated).toHaveBeenCalledWith('Mock para api.example.com/users'));
});
```

- [ ] **Step 3: Rodar**

```bash
cd app && npx vitest run src/components/command-center/__tests__/QuickMockPanel.test.tsx
```

Esperado: 4 tests pass.

- [ ] **Step 4: Wire `onCreated` em `CommandCenter`**

Em `app/src/pages/CommandCenter.tsx`, manter um estado local opcional de "regra recém criada":

```tsx
const [recentRuleName, setRecentRuleName] = useState<string | null>(null);
// …
{quickMockOpen && selected && selectedId && (
	<QuickMockPanel
		open={quickMockOpen}
		onOpenChange={setQuickMockOpen}
		request={selected}
		requestId={selectedId}
		onCreated={(name) => setRecentRuleName(name)}
	/>
)}
```

E passar `recentRuleName` para um toast inline acima do inspector (opcional). Mínimo: armazenar e ignorar visualmente nesta phase — o requisito da spec é "request que gerou mock ganha indicação visual". Para isso:

```tsx
<RequestInspector
	request={selected ? { ...selected, generatedRuleId: recentRuleName ? 'pending-link' : selected.generatedRuleId } : null}
	// …
/>
```

> Nota: usamos a string sentinela `'pending-link'` apenas para que o botão "Abrir no Rules Lab" apareça. O Rules Lab vai listar a regra recém criada por nome — link real virá quando `addRule` retornar o id (issue follow-up).

- [ ] **Step 5: Rodar suíte completa**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/command-center/QuickMockPanel.tsx app/src/components/command-center/__tests__/QuickMockPanel.test.tsx app/src/pages/CommandCenter.tsx
git commit -m "feat(quick-mock): callback onCreated + indicação no inspector"
```

---

# Phase 4 — Rules Lab + presets

**Objetivo:** Página dedicada com listagem de regras, cards de presets, área de revisão de regras (incluindo a recém criada), reaproveitando `RuleEditor` e `RuleTable` existentes.

### Task 4.1: `RulesLab` — layout principal

**Files:**
- Modify: `app/src/pages/RulesLab.tsx`
- Test: `app/src/pages/__tests__/RulesLab.test.tsx`

- [ ] **Step 1: Escrever teste**

`app/src/pages/__tests__/RulesLab.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RulesLab from '../RulesLab';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

describe('RulesLab', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [
				{
					id: 'r1',
					name: 'Existing rule',
					enabled: true,
					matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
					createdAt: 1,
					updatedAt: 1,
				},
			],
			addRule: vi.fn().mockResolvedValue(true),
			updateRule: vi.fn().mockResolvedValue(true),
			removeRule: vi.fn().mockResolvedValue(true),
			toggleRuleEnabled: vi.fn().mockResolvedValue(true),
		} as any);
	});

	test('renderiza cards de presets e listagem de regras', () => {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByText(/Erro 500/)).toBeInTheDocument();
		expect(screen.getByText(/Latência fixa/)).toBeInTheDocument();
		expect(screen.getByText('Existing rule')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Falhar (stub atual não tem presets)**

```bash
cd app && npx vitest run src/pages/__tests__/RulesLab.test.tsx
```

- [ ] **Step 3: Implementar Layout**

`app/src/pages/RulesLab.tsx`:

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import RuleTable from '@/components/rules/RuleTable';
import RuleEditor from '@/components/rules/RuleEditor';
import { RulePresetCard } from '@/components/rules-lab/RulePresetCard';
import { RulesImportExport } from '@/components/rules-lab/RulesImportExport';
import { useRules } from '@/hooks/useRules';
import type { Rule, RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

const PRESET_IDS: RulePresetId[] = [
	'http_error_500',
	'http_error_404',
	'http_error_401',
	'http_error_403',
	'latency_fixed',
	'latency_range',
	'empty_response',
	'broken_json',
];

const RulesLab: React.FC = () => {
	const { rules, addRule, updateRule, removeRule, toggleRuleEnabled } = useRules();
	const [editingRule, setEditingRule] = useState<Rule | null>(null);
	const [creatingFromPreset, setCreatingFromPreset] = useState<RulePresetId | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const presetDraft = creatingFromPreset ? createPresetRule(creatingFromPreset) : undefined;

	return (
		<div className="space-y-6 p-4">
			<Card className="panel">
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Rules Lab</CardTitle>
						<CardDescription>
							Crie regras a partir de presets, gerencie regras existentes e exporte/importe pacotes.
						</CardDescription>
					</div>
					<Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
						<LucideIcon name="plus" className="h-4 w-4" />
						Nova regra
					</Button>
				</CardHeader>
				<CardContent>
					<h3 className="mb-3 text-sm font-medium">Presets</h3>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{PRESET_IDS.map((id) => (
							<RulePresetCard
								key={id}
								presetId={id}
								onCreate={() => setCreatingFromPreset(id)}
							/>
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="panel">
				<CardHeader>
					<CardTitle>Regras configuradas</CardTitle>
					<CardDescription>{rules.length} regra(s) ativas, pausadas ou rascunho.</CardDescription>
				</CardHeader>
				<CardContent>
					<RuleTable
						rules={rules}
						onRemove={removeRule}
						onToggle={toggleRuleEnabled}
						onEdit={(rule) => setEditingRule(rule)}
					/>
				</CardContent>
			</Card>

			<RulesImportExport />

			<RuleEditor
				open={isCreating || creatingFromPreset !== null}
				mode="create"
				rule={
					presetDraft
						? {
								id: 'draft',
								createdAt: 0,
								updatedAt: 0,
								...presetDraft,
							}
						: undefined
				}
				onOpenChange={(open) => {
					if (!open) {
						setIsCreating(false);
						setCreatingFromPreset(null);
					}
				}}
				onSave={async (newRule) => {
					const ok = await addRule(newRule.name, newRule.matchers, newRule.action);
					if (ok) {
						setIsCreating(false);
						setCreatingFromPreset(null);
					}
					return ok;
				}}
			/>

			{editingRule && (
				<RuleEditor
					open={!!editingRule}
					mode="edit"
					rule={editingRule}
					onOpenChange={(open) => {
						if (!open) setEditingRule(null);
					}}
					onSave={async (updated) => {
						const ok = await updateRule(editingRule.id, updated);
						if (ok) setEditingRule(null);
						return ok;
					}}
				/>
			)}
		</div>
	);
};

export default RulesLab;
```

> `RulePresetCard` e `RulesImportExport` ainda não existem — criar stubs nas próximas sub-tasks. Para o teste atual, o que importa é o título do preset aparecer; o card final virá em Task 4.2.

- [ ] **Step 4: Criar stubs `RulePresetCard` e `RulesImportExport`**

`app/src/components/rules-lab/RulePresetCard.tsx`:

```tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

interface RulePresetCardProps {
	presetId: RulePresetId;
	onCreate: () => void;
}

export function RulePresetCard({ presetId, onCreate }: RulePresetCardProps) {
	const draft = createPresetRule(presetId);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{draft.name}</CardTitle>
			</CardHeader>
			<CardContent>
				<Button size="sm" variant="outline" onClick={onCreate} className="w-full">
					Criar a partir deste preset
				</Button>
			</CardContent>
		</Card>
	);
}
```

`app/src/components/rules-lab/RulesImportExport.tsx`:

```tsx
import React from 'react';

export function RulesImportExport() {
	// Implementação real na Task 5.1/5.2.
	return null;
}
```

- [ ] **Step 5: Rodar teste**

```bash
cd app && npx vitest run src/pages/__tests__/RulesLab.test.tsx
```

Esperado: 1 PASS (cards aparecem).

- [ ] **Step 6: Apagar `Settings.tsx` (substituído)**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/distracted-visvesvaraya-ee6856
rm app/src/pages/Settings.tsx
```

Verificar que nada mais importa `Settings.tsx`:

```bash
cd app && grep -rn "from.*Settings" src/ || true
```

Esperado: nenhum match (ou só lucide `Settings as SettingsIcon`, que é OK).

- [ ] **Step 7: Lint + typecheck + suite**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

- [ ] **Step 8: Commit**

```bash
git add -A app/src/pages/RulesLab.tsx app/src/pages/__tests__/RulesLab.test.tsx app/src/components/rules-lab/ app/src/pages/Settings.tsx
git commit -m "feat(rules-lab): página com cards de presets e listagem (substitui Settings)"
```

---

### Task 4.2: `RulePresetCard` — descrição rica

**Files:**
- Modify: `app/src/components/rules-lab/RulePresetCard.tsx`
- Test: `app/src/components/rules-lab/__tests__/RulePresetCard.test.tsx`

- [ ] **Step 1: Escrever teste**

`app/src/components/rules-lab/__tests__/RulePresetCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RulePresetCard } from '../RulePresetCard';

describe('RulePresetCard', () => {
	test('chama onCreate ao clicar', () => {
		const onCreate = vi.fn();
		render(<RulePresetCard presetId="latency_fixed" onCreate={onCreate} />);
		fireEvent.click(screen.getByRole('button', { name: /Criar a partir/i }));
		expect(onCreate).toHaveBeenCalled();
	});

	test('mostra descrição que inclui o status ou latência do preset', () => {
		render(<RulePresetCard presetId="http_error_500" onCreate={vi.fn()} />);
		expect(screen.getByText(/500/)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Rodar — pode passar dependendo do conteúdo. Garantir que falha com a versão atual:**

```bash
cd app && npx vitest run src/components/rules-lab/__tests__/RulePresetCard.test.tsx
```

- [ ] **Step 3: Aprimorar o card com descrição rica**

```tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

interface RulePresetCardProps {
	presetId: RulePresetId;
	onCreate: () => void;
}

const PRESET_DESCRIPTIONS: Record<RulePresetId, string> = {
	http_error_500: 'Retorna 500 Internal Server Error com payload JSON.',
	http_error_404: 'Retorna 404 Not Found com payload JSON.',
	http_error_401: 'Retorna 401 Unauthorized com payload JSON.',
	http_error_403: 'Retorna 403 Forbidden com payload JSON.',
	latency_fixed: 'Atrasa a resposta em 1s e devolve 200 OK.',
	latency_range: 'Atrasa a resposta entre 0.5s e 2s e devolve 200 OK.',
	empty_response: 'Devolve 200 OK com body vazio.',
	broken_json: 'Devolve 200 OK com JSON inválido sintaticamente.',
};

export function RulePresetCard({ presetId, onCreate }: RulePresetCardProps) {
	const draft = createPresetRule(presetId);
	return (
		<Card className="flex h-full flex-col">
			<CardHeader>
				<CardTitle className="text-sm">{draft.name}</CardTitle>
				<CardDescription className="text-xs">{PRESET_DESCRIPTIONS[presetId]}</CardDescription>
			</CardHeader>
			<CardContent className="mt-auto">
				<Button size="sm" variant="outline" onClick={onCreate} className="w-full">
					Criar a partir deste preset
				</Button>
			</CardContent>
		</Card>
	);
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/components/rules-lab/__tests__/RulePresetCard.test.tsx
```

Esperado: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/rules-lab/RulePresetCard.tsx app/src/components/rules-lab/__tests__/RulePresetCard.test.tsx
git commit -m "feat(rules-lab): RulePresetCard com descrição"
```

---

# Phase 5 — Export/import e replay básico

### Task 5.1: `RulesImportExport` — Export

**Files:**
- Modify: `app/src/components/rules-lab/RulesImportExport.tsx`
- Test: `app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx`

- [ ] **Step 1: Escrever teste**

`app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { RulesImportExport } from '../RulesImportExport';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

describe('RulesImportExport — export', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [
				{
					id: 'r1',
					name: 'Existing',
					enabled: true,
					matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
					createdAt: 1,
					updatedAt: 1,
				},
			],
			addRule: vi.fn(),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);
	});

	test('clicar Exportar dispara download com envelope schemaVersion + rules', () => {
		const createObjectURL = vi.fn().mockReturnValue('blob:fake');
		const revokeObjectURL = vi.fn();
		(globalThis as any).URL.createObjectURL = createObjectURL;
		(globalThis as any).URL.revokeObjectURL = revokeObjectURL;

		render(<RulesImportExport />);
		fireEvent.click(screen.getByRole('button', { name: /Exportar/i }));

		expect(createObjectURL).toHaveBeenCalled();
		const blobArg = createObjectURL.mock.calls[0][0] as Blob;
		expect(blobArg.type).toBe('application/json');
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/components/rules-lab/__tests__/RulesImportExport.test.tsx
```

- [ ] **Step 3: Implementar export**

`app/src/components/rules-lab/RulesImportExport.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { useRules } from '@/hooks/useRules';
import { serializeRules, validateRuleImport } from '@/domain/rulesIO';
import type { Rule } from '@/types/rules';

export function RulesImportExport() {
	const { rules, addRule } = useRules();
	const [importPreview, setImportPreview] = useState<Rule[] | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');
	const fileInput = useRef<HTMLInputElement>(null);

	const handleExport = () => {
		const json = serializeRules(rules);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `debug-buddy-rules-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleFile = async (file: File) => {
		setImportError(null);
		setImportPreview(null);
		try {
			const text = await file.text();
			const parsed: unknown = JSON.parse(text);
			const result = validateRuleImport(parsed);
			if (!result.ok) {
				setImportError(result.error);
				return;
			}
			setImportPreview(result.rules);
		} catch (err) {
			setImportError(err instanceof Error ? err.message : 'JSON inválido');
		}
	};

	const handleConfirmImport = async () => {
		if (!importPreview) return;
		if (strategy === 'replace') {
			await chrome.storage.local.set({ rules: importPreview });
		} else {
			for (const rule of importPreview) {
				await addRule(rule.name, rule.matchers, rule.action);
			}
		}
		setImportPreview(null);
		if (fileInput.current) fileInput.current.value = '';
	};

	return (
		<Card className="panel">
			<CardHeader>
				<CardTitle>Exportar / Importar</CardTitle>
				<CardDescription>
					Exporte o conjunto de regras como JSON ou importe um arquivo previamente exportado.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={handleExport} className="gap-2">
						<LucideIcon name="download" className="h-4 w-4" />
						Exportar
					</Button>
					<Button
						variant="outline"
						onClick={() => fileInput.current?.click()}
						className="gap-2"
					>
						<LucideIcon name="upload" className="h-4 w-4" />
						Importar
					</Button>
					<input
						ref={fileInput}
						type="file"
						accept="application/json"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handleFile(f);
						}}
					/>
				</div>

				{importError && (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<LucideIcon name="alert-triangle" className="mr-2 inline h-4 w-4" />
						{importError}
					</div>
				)}

				{importPreview && (
					<div className="space-y-3 rounded-md border p-3">
						<h4 className="text-sm font-medium">
							{importPreview.length} regra(s) prontas para importar
						</h4>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<label className="flex items-center gap-2">
								<input
									type="radio"
									checked={strategy === 'merge'}
									onChange={() => setStrategy('merge')}
								/>
								Adicionar às regras existentes
							</label>
							<label className="flex items-center gap-2">
								<input
									type="radio"
									checked={strategy === 'replace'}
									onChange={() => setStrategy('replace')}
								/>
								Substituir todas as regras
							</label>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleConfirmImport}>Confirmar import</Button>
							<Button variant="outline" onClick={() => setImportPreview(null)}>
								Cancelar
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd app && npx vitest run src/components/rules-lab/__tests__/RulesImportExport.test.tsx
```

Esperado: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/rules-lab/RulesImportExport.tsx app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx
git commit -m "feat(rules-lab): export de regras (JSON com schemaVersion)"
```

---

### Task 5.2: Import com validação + escolha merge/replace

**Files:**
- Modify: `app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx`

- [ ] **Step 1: Adicionar testes de import**

```tsx
import { waitFor } from '@testing-library/react';
// …

describe('RulesImportExport — import', () => {
	beforeEach(() => {
		vi.mocked(useRules).mockReturnValue({
			rules: [],
			addRule: vi.fn().mockResolvedValue(true),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);
		(chrome.storage.local.set as any).mockResolvedValue(undefined);
	});

	test('mostra erro quando JSON é inválido', async () => {
		render(<RulesImportExport />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['nao eh json'], 'bad.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file] });
		fireEvent.change(input);
		await waitFor(() => {
			expect(screen.getByText(/JSON inválido|JSON|Unexpected/i)).toBeInTheDocument();
		});
	});

	test('mostra preview e permite escolher merge ou replace', async () => {
		const valid = {
			schemaVersion: 1,
			rules: [
				{
					id: 'r1',
					name: 'Imported',
					enabled: true,
					matchers: [{ type: 'url', enabled: true, pattern: 'a', isRegex: false }],
					action: { type: 'mock', enabled: true, status: 200, headers: {} },
					createdAt: 1,
					updatedAt: 1,
				},
			],
		};
		render(<RulesImportExport />);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File([JSON.stringify(valid)], 'good.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file] });
		fireEvent.change(input);

		await waitFor(() => {
			expect(screen.getByText(/regra\(s\) prontas/i)).toBeInTheDocument();
		});
		expect(screen.getByLabelText(/Adicionar às regras existentes/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Substituir todas as regras/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Rodar — devem passar (implementação já cobre)**

```bash
cd app && npx vitest run src/components/rules-lab/__tests__/RulesImportExport.test.tsx
```

Esperado: 3 tests pass total.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/rules-lab/__tests__/RulesImportExport.test.tsx
git commit -m "test(rules-lab): cobrir import com merge/replace e validação"
```

---

### Task 5.3: Replay básico — `replayHistory.ts` + `ReplayPanel`

**Files:**
- Create: `app/src/lib/replayHistory.ts`
- Test: `app/src/lib/__tests__/replayHistory.test.ts`
- Create: `app/src/components/command-center/ReplayPanel.tsx`
- Test: `app/src/components/command-center/__tests__/ReplayPanel.test.tsx`

- [ ] **Step 1: Escrever teste de `buildReplayView`**

`app/src/lib/__tests__/replayHistory.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { buildReplayView } from '../replayHistory';

const captured: InterceptedResponse = {
	url: 'https://api.example.com/x',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"ok":true}',
	response: { headers: { 'content-type': 'application/json' }, body: '{"ok":true}' },
};

const rule: Rule = {
	id: 'r1',
	name: 'Mock para api.example.com/x',
	enabled: true,
	matchers: [
		{ type: 'url', enabled: true, pattern: 'api.example.com/x', isRegex: false },
		{ type: 'method', enabled: true, method: 'GET' },
	],
	action: {
		type: 'mock',
		enabled: true,
		status: 500,
		statusPhrase: 'Internal Server Error',
		headers: {},
		body: '{"error":"boom"}',
	},
	createdAt: 1,
	updatedAt: 1,
};

describe('buildReplayView', () => {
	test('sem regra associada retorna apenas captured', () => {
		const view = buildReplayView(captured, []);
		expect(view.captured.status).toBe(200);
		expect(view.currentMock).toBeNull();
	});

	test('com regra mock match retorna currentMock', () => {
		const view = buildReplayView(captured, [rule]);
		expect(view.currentMock).not.toBeNull();
		expect(view.currentMock?.status).toBe(500);
		expect(view.currentMock?.body).toBe('{"error":"boom"}');
	});

	test('regra desabilitada não vira currentMock', () => {
		const view = buildReplayView(captured, [{ ...rule, enabled: false }]);
		expect(view.currentMock).toBeNull();
	});
});
```

- [ ] **Step 2: Falhar**

```bash
cd app && npx vitest run src/lib/__tests__/replayHistory.test.ts
```

- [ ] **Step 3: Implementar**

`app/src/lib/replayHistory.ts`:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { findMatchingRuleAction } from '@/domain/ruleMatching';

export interface ReplayCaptured {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body?: string;
}

export interface ReplayMock {
	status: number;
	statusPhrase?: string;
	headers: Record<string, string>;
	body?: string;
	ruleId: string;
	ruleName: string;
}

export interface ReplayView {
	captured: ReplayCaptured;
	currentMock: ReplayMock | null;
}

export function buildReplayView(
	request: InterceptedResponse,
	rules: Rule[],
): ReplayView {
	const captured: ReplayCaptured = {
		status: request.status,
		statusText: request.statusText,
		headers: request.response?.headers ?? request.headers,
		body: request.response?.body ?? request.body,
	};

	if (!request.method) {
		return { captured, currentMock: null };
	}

	const match = findMatchingRuleAction(rules, {
		url: request.url,
		method: request.method,
		headers: request.request?.headers ?? {},
		body: request.request?.postData,
	});

	if (!match || match.type !== 'mock') {
		return { captured, currentMock: null };
	}

	return {
		captured,
		currentMock: {
			status: match.action.status,
			statusPhrase: match.action.statusPhrase,
			headers: match.action.headers,
			body: match.action.body,
			ruleId: match.rule.id,
			ruleName: match.rule.name,
		},
	};
}
```

- [ ] **Step 4: Rodar e passar**

```bash
cd app && npx vitest run src/lib/__tests__/replayHistory.test.ts
```

Esperado: 3 PASS.

- [ ] **Step 5: Implementar `ReplayPanel`**

`app/src/components/command-center/ReplayPanel.tsx`:

```tsx
import React from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { buildReplayView } from '@/lib/replayHistory';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReplayPanelProps {
	request: InterceptedResponse;
	rules: Rule[];
}

export function ReplayPanel({ request, rules }: ReplayPanelProps) {
	const view = buildReplayView(request, rules);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<section className="space-y-2">
				<h3 className="text-sm font-medium">Capturado</h3>
				<Badge variant="outline">
					{view.captured.status} {view.captured.statusText}
				</Badge>
				<ScrollArea className="max-h-72 rounded-md border">
					<pre className="p-3 font-mono text-xs">
						{view.captured.body ?? '(sem body capturado)'}
					</pre>
				</ScrollArea>
			</section>

			<section className="space-y-2">
				<h3 className="text-sm font-medium">Mock atual</h3>
				{view.currentMock ? (
					<>
						<Badge variant="outline">
							{view.currentMock.status} {view.currentMock.statusPhrase ?? ''}
						</Badge>
						<div className="text-xs text-muted-foreground">
							Regra: <code>{view.currentMock.ruleName}</code>
						</div>
						<ScrollArea className="max-h-72 rounded-md border">
							<pre className="p-3 font-mono text-xs">
								{view.currentMock.body ?? '(sem body no mock)'}
							</pre>
						</ScrollArea>
					</>
				) : (
					<div className="text-sm text-muted-foreground">
						Esta requisição ainda não tem regra ativa correspondente.
					</div>
				)}
			</section>
		</div>
	);
}
```

- [ ] **Step 6: Adicionar aba "Replay" no `RequestInspector`**

Em `RequestInspector.tsx`, ampliar `TabsList` para 5 colunas e adicionar:

```tsx
<TabsList className="mx-4 grid grid-cols-5">
	<TabsTrigger value="overview">Overview</TabsTrigger>
	<TabsTrigger value="request">Request</TabsTrigger>
	<TabsTrigger value="response">Response</TabsTrigger>
	<TabsTrigger value="body">Body</TabsTrigger>
	<TabsTrigger value="replay">Replay</TabsTrigger>
</TabsList>
```

E `TabsContent value="replay"`:

```tsx
<TabsContent value="replay">
	<ReplayPanel request={request} rules={rules} />
</TabsContent>
```

Para isso, `RequestInspector` precisa receber `rules` como prop. Atualizar interface e callsite (`CommandCenter`):

```tsx
// Em RequestInspector.tsx
interface RequestInspectorProps {
	// …existentes
	rules: Rule[];
}

// Em CommandCenter.tsx
const { rules } = useRules();
// …
<RequestInspector
	request={selected ? { ... } : null}
	requestId={selectedId}
	rules={rules}
	// …
/>
```

- [ ] **Step 7: Atualizar testes de `RequestInspector` para passar `rules={[]}`**

Editar `RequestInspector.test.tsx` adicionando `rules={[]}` em todos os `render()`. (3-5 lugares.)

- [ ] **Step 8: Rodar suíte**

```bash
cd app && npm run lint && npm run typecheck && npm test -- --run
```

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/replayHistory.ts app/src/lib/__tests__/replayHistory.test.ts app/src/components/command-center/ReplayPanel.tsx app/src/components/command-center/RequestInspector.tsx app/src/components/command-center/__tests__/RequestInspector.test.tsx app/src/pages/CommandCenter.tsx
git commit -m "feat(replay): replay básico capturado vs mock atual"
```

---

# Phase 6 — Verificação visual e hardening

### Task 6.1: Migrar ícones residuais em `RuleEditor`, `MatcherEditor`, `ActionEditor`, `RuleTable`

**Files:**
- Modify: `app/src/components/rules/RuleEditor.tsx`
- Modify: `app/src/components/rules/MatcherEditor.tsx`
- Modify: `app/src/components/rules/ActionEditor.tsx`
- Modify: `app/src/components/rules/RuleTable.tsx`

> Esses arquivos ainda usam o `Icon` legado. Como o Quick Mock e Rules Lab abrem `RuleEditor`, qualquer renderização incorreta de ícones será visível. Trocar por `LucideIcon`.

- [ ] **Step 1: Mapear `Icon name="…"` em cada arquivo**

```bash
cd app && grep -n 'Icon name=' src/components/rules/*.tsx
```

Esperado: lista de usos. Mapear cada um para o equivalente Lucide:

| Material | Lucide |
| --- | --- |
| `add` | `plus` |
| `save` | `save` |
| `refresh` | `refresh` |
| `delete` | `trash` |
| `edit` | `edit` |
| `close` / `cancel` | `x` |
| `check` | `check` |
| `content_copy` | `copy` |

- [ ] **Step 2: Aplicar substituições**

Em cada arquivo, substituir `import { Icon } from '@/components/ui/icon';` por `import { LucideIcon } from '@/components/ui/lucide-icon';` e cada uso `<Icon name="X" className="..." />` por `<LucideIcon name="<lucide>" className="h-4 w-4 ..." />`.

- [ ] **Step 3: Rodar testes existentes**

```bash
cd app && npx vitest run src/components/rules/__tests__/ActionEditor.test.tsx
```

Se algum teste verifica texto literal "add" via Material Icons, atualizar para `screen.getByRole('button', { name: /Adicionar/i })`.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/rules/
git commit -m "refactor(rules): migrar editores e tabela de regras para LucideIcon"
```

---

### Task 6.2: Build + load no Chrome (manual checklist)

**Files:** N/A (apenas verificação)

- [ ] **Step 1: Build**

```bash
cd app && npm run build
```

Esperado: `app/dist/` contém `background.js`, `options.html`, `sidepanel.html`, `manifest.json`, `images/`, `lib/`. Sem erros.

- [ ] **Step 2: Carregar no Chrome**

Em `chrome://extensions`:

1. Ativar "Developer mode".
2. "Load unpacked" → selecionar `/Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/distracted-visvesvaraya-ee6856/app/dist/`.
3. Clicar no ícone na toolbar → confirmar que abre o Command Center direto (rota `/command-center`).
4. Selecionar uma aba alvo qualquer e clicar "Iniciar Interceptação".
5. Navegar na aba alvo, gerar tráfego.
6. Validar visualmente:
   - [ ] Ícones do header, sidebar, timeline, paginação são SVGs (não texto).
   - [ ] Clicar numa request abre o inspector lateral SEM modal sobreposto.
   - [ ] Botão "Criar Mock" no inspector abre o `QuickMockPanel`.
   - [ ] Header `authorization` aparece mascarado e desmarcado.
   - [ ] Salvar mock cria a regra na rota `/rules-lab`.
   - [ ] Rules Lab mostra cards de presets; clicar num preset abre o editor preenchido.
   - [ ] Export gera arquivo `debug-buddy-rules-YYYY-MM-DD.json` com `schemaVersion: 1`.
   - [ ] Importar arquivo inválido mostra erro inline.
   - [ ] Importar arquivo válido pede merge/replace antes de aplicar.

- [ ] **Step 3: Side panel**

Abrir o side panel via toolbar → confirmar que o app aparece dentro dele (largura estreita) e:

- [ ] Inspector vira layout em coluna abaixo da timeline (responsividade).
- [ ] Botões de ação não estouram a largura.
- [ ] URL longa trunca com `…` no meio.

- [ ] **Step 4: Documentar achados**

Se algo quebrar, criar tarefas extras OU registrar issues. Nenhum problema bloqueador detectado significa OK.

- [ ] **Step 5: Commit (apenas se algum ajuste foi feito durante a verificação)**

Sem commit obrigatório aqui — apenas se mudanças foram necessárias.

---

### Task 6.3: CI gates finais

**Files:** N/A

- [ ] **Step 1: Rodar todos os comandos de CI**

```bash
cd app && npm run lint && npm run typecheck && npm run build && npm test -- --run
```

Esperado: tudo verde.

- [ ] **Step 2: Confirmar git status limpo**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/distracted-visvesvaraya-ee6856 && git status
```

Esperado: working tree clean.

- [ ] **Step 3: Push branch**

> Aguardar pedido explícito do usuário antes de `git push`. Conforme a regra de ações reversíveis, push é compartilhado e precisa de confirmação.

---

## Critérios de aceite (mapeamento spec ↔ tarefas)

| Critério da spec | Tarefa(s) |
| --- | --- |
| 1. Iniciar interceptação + selecionar request + ver detalhes sem modal | Task 2.5 (CommandCenter), Task 2.4 (Inspector) |
| 2. Criar mock a partir de request real | Task 3.1 (QuickMockPanel) |
| 3. Regra criada usa método + host + pathname por padrão | Task 1.3 (buildQuickMockDraft) |
| 4. Adicionar matcher por headers manualmente | Task 1.4 + Task 3.1 |
| 5. Headers sensíveis não entram automaticamente nem expostos | Task 1.2 (sensitiveHeaders), Task 3.2 |
| 6. Rules Lab permite revisar/editar regra criada | Task 4.1 (RulesLab + RuleEditor) |
| 7. Presets de falha/latência criam regras editáveis | Task 1.6 (createPresetRule), Task 4.2 (RulePresetCard) |
| 8. Export/import valida e pede merge/substituição | Task 5.1 + Task 5.2 (RulesImportExport) |
| 9. Replay básico permite reabrir/usar resposta salva | Task 5.3 (replayHistory + ReplayPanel) |
| 10. Ícones seguem padrão shadcn (Lucide) | Phase 0 inteira |
| 11. Layout passa por verificação visual | Task 6.2 |
| 12. Lint, typecheck, build e testes verdes | Task 6.3 |

---

## Pendências fora do escopo (issues follow-up)

Conforme spec, os itens abaixo NÃO entram nesta entrega:

- **i18n (issue #3)** — não tocado. UI continua pt-BR.
- **Versão no sidebar (issue #6)** — fora do plano; pode ser polish separado se desejado.
- **Captura separada de request headers (issue #19)** — não resolvido nesta entrega.
- **`addRule` retornar a `Rule` criada** — necessário para vincular `generatedRuleId` real (atualmente usamos sentinela `'pending-link'`). Issue follow-up.
- **Sessões nomeadas, snapshots, replay com reexecução real** — explicitamente fora do escopo.

---

## Nota sobre execução

Esta entrega é grande. Cada Phase produz software funcional e testado. Recomenda-se:

- Phase 0 antes de qualquer outra (ícones quebrariam UI nova).
- Phase 1 antes de Phase 3 (funções puras antes de UI consumidora).
- Phase 2 e 4 podem ser independentes em sub-agents paralelos depois de Phase 1.
- Phase 5 e Phase 6 ao final.
