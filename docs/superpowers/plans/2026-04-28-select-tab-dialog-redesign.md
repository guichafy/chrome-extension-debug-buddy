# SelectTabDialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o modal `SelectTabDialog` substituindo o arquivo único atual por um diretório `app/src/components/select-tab/` com busca por título/URL, chips de filtro por domínio, modal maior, navegação por teclado completa e estados explícitos de erro/vazio (sem fallbacks silenciosos).

**Architecture:** Container `SelectTabDialog` orquestra estado (`query`, `activeDomain`, `focusedIndex`) e teclado; lista é `role="listbox"` controlado por `aria-activedescendant`. Hook puro `useFilteredTabs` faz `chrome.tabs.query` na abertura, filtra páginas inelegíveis e deriva domínios + lista filtrada. Sub-componentes presentational (`TabSearchBar`, `DomainChipFilter`, `TabList`, `TabRow`, `EmptyState`) cada um com responsabilidade única e testes co-locados.

**Tech Stack:** React 19, TypeScript strict, shadcn/ui (`Dialog`, `Input`, `Button`, `Badge`, `ScrollArea`), `lucide-react` via `@/components/ui/lucide-icon`, Tailwind v4, Vitest + jsdom + React Testing Library, mocks de `chrome.tabs.query` / `chrome.storage.local.get` em `app/vitest.setup.ts`.

**Spec source:** [docs/superpowers/specs/2026-04-28-select-tab-dialog-redesign-design.md](../specs/2026-04-28-select-tab-dialog-redesign-design.md)

---

## Convenções deste plano

- Todos os comandos rodam a partir de `app/` (não da raiz). Quando ver `npm run …`, faça `cd app && npm run …`. Comandos `git` rodam da raiz da worktree.
- Cada task termina em commit. Conventional Commits — pre-commit hook chama Biome via `lint-staged`. **Nunca** use `--no-verify`.
- Strings de UI, comentários e mensagens de erro: pt-BR. Indentação: tabs (size 2). Aspas simples em TS, duplas em JSX.
- **Sem fallbacks silenciosos** (`return ''`, `?? 'Unknown'`). Erros do `chrome.tabs.query` devem chegar à UI como mensagem real. Releia `CLAUDE.md` em caso de dúvida.
- Gate de verificação por task (após qualquer alteração de código de produção):
  ```bash
  cd app && npx vitest run <arquivos-de-teste-tocados>
  ```
  Tasks finais (9 e 10) rodam o pacote completo: `npm run lint && npm test -- --run && npm run build`.
- O worktree atual está em `.claude/worktrees/xenodochial-diffie-6a2288`. Todo trabalho roda aqui.

---

## File Structure

### Arquivos novos

| Caminho | Responsabilidade |
| --- | --- |
| `app/src/components/select-tab/types.ts` | Tipo `Tab` (id, title, url, hostname, favIconUrl?, index) compartilhado entre hook e componentes. |
| `app/src/components/select-tab/hooks/useFilteredTabs.ts` | Hook que dispara `chrome.tabs.query`, filtra abas inelegíveis, deriva `domains` agrupados e aplica filtro por busca + domínio. Retorna `{ state, error, allTabs, filteredTabs, domains }`. |
| `app/src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts` | Testes do hook — caminhos felizes e cada caminho de erro listado no spec. |
| `app/src/components/select-tab/TabSearchBar.tsx` | Input de busca com ícone de lupa e badge `/`. `forwardRef` expõe foco programático. |
| `app/src/components/select-tab/__tests__/TabSearchBar.test.tsx` | Testes do search bar. |
| `app/src/components/select-tab/DomainChipFilter.tsx` | Linha de chips com contagem; chip "Todos" sempre primeiro. |
| `app/src/components/select-tab/__tests__/DomainChipFilter.test.tsx` | Testes dos chips. |
| `app/src/components/select-tab/TabRow.tsx` | Linha de aba: favicon (com placeholder), título, URL truncada, chip de domínio, badge "Atual" condicional, seta. `role="option"`. |
| `app/src/components/select-tab/__tests__/TabRow.test.tsx` | Testes da linha. |
| `app/src/components/select-tab/TabList.tsx` | Container `role="listbox"` com `aria-activedescendant`. Aplica scroll-into-view ao `focusedIndex`. |
| `app/src/components/select-tab/__tests__/TabList.test.tsx` | Testes da lista. |
| `app/src/components/select-tab/EmptyState.tsx` | Mensagens para `loading`, `no-tabs`, `no-results`, `error`. |
| `app/src/components/select-tab/__tests__/EmptyState.test.tsx` | Testes do empty state. |
| `app/src/components/select-tab/SelectTabDialog.tsx` | Container — estado, atalhos globais, render condicional dos sub-componentes. Mesma API pública do componente antigo (`open`, `onOpenChange`, `onSelectTab`). |
| `app/src/components/select-tab/__tests__/SelectTabDialog.test.tsx` | Testes de integração: spinner → lista, badge "Atual", teclado (`↑/↓/Enter/Esc//`), busca filtra, "Limpar busca" reseta. |

### Arquivos modificados

| Caminho | Mudança |
| --- | --- |
| `app/src/pages/Layout.tsx:3` | Trocar `import SelectTabDialog from '../components/SelectTabDialog'` por `import { SelectTabDialog } from '../components/select-tab/SelectTabDialog'`. |
| `app/vitest.setup.ts` | Estender o stub do `chrome` global com `chrome.runtime.lastError` (campo opcional acessado pelo hook quando `chrome.tabs.query` falha). |

### Arquivos removidos

| Caminho | Motivo |
| --- | --- |
| `app/src/components/SelectTabDialog.tsx` | Substituído pela nova estrutura em `app/src/components/select-tab/`. |

### Estrutura final

```
app/src/components/select-tab/
├── SelectTabDialog.tsx
├── TabSearchBar.tsx
├── DomainChipFilter.tsx
├── TabList.tsx
├── TabRow.tsx
├── EmptyState.tsx
├── types.ts
├── hooks/
│   ├── useFilteredTabs.ts
│   └── __tests__/
│       └── useFilteredTabs.test.ts
└── __tests__/
    ├── SelectTabDialog.test.tsx
    ├── TabSearchBar.test.tsx
    ├── DomainChipFilter.test.tsx
    ├── TabRow.test.tsx
    ├── TabList.test.tsx
    └── EmptyState.test.tsx
```

---

## Task 1: Setup — diretório e mocks de teste

**Files:**
- Create: `app/src/components/select-tab/types.ts`
- Modify: `app/vitest.setup.ts`

- [ ] **Step 1: Criar tipo `Tab` compartilhado**

`app/src/components/select-tab/types.ts`:

```ts
export interface Tab {
	id: number;
	title: string;
	url: string;
	hostname: string;
	favIconUrl?: string;
	index: number;
}

export const INVALID_HOSTNAME = '(URL inválida)';
```

- [ ] **Step 2: Estender mock do `chrome` global no vitest setup**

`app/vitest.setup.ts` — substituir o bloco `(globalThis as any).chrome = { ... }` por:

```ts
// Mock para o objeto chrome
(globalThis as any).chrome = {
	runtime: {
		sendMessage: vi.fn(),
		lastError: undefined as { message: string } | undefined,
		onMessage: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
		connect: vi.fn().mockReturnValue({
			onMessage: {
				addListener: vi.fn(),
			},
		}),
	},
	storage: {
		local: {
			get: vi.fn(),
			set: vi.fn(),
		},
		onChanged: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
	},
	tabs: {
		query: vi.fn(),
	},
};
```

(A única mudança real é incluir `lastError` no `runtime` para o hook poder ler quando `chrome.tabs.query` falha.)

- [ ] **Step 3: Garantir que a suíte ainda passa**

```bash
cd app && npm test -- --run
```

Esperado: todos os testes existentes passam (a mudança no setup é aditiva).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/select-tab/types.ts app/vitest.setup.ts
git commit -m "chore(select-tab): adicionar tipo Tab compartilhado e estender mock do chrome"
```

---

## Task 2: Hook `useFilteredTabs` (TDD completo)

**Files:**
- Create: `app/src/components/select-tab/hooks/useFilteredTabs.ts`
- Test: `app/src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts`:

```ts
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFilteredTabs } from '../useFilteredTabs';
import { INVALID_HOSTNAME } from '../../types';

const mockQuery = (tabs: Partial<chrome.tabs.Tab>[]) => {
	(chrome.tabs.query as any).mockImplementation((_q: any, cb?: any) => {
		if (cb) {
			cb(tabs);
			return undefined;
		}
		return Promise.resolve(tabs);
	});
};

const mockQueryReject = (message: string) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.reject(new Error(message)));
};

describe('useFilteredTabs', () => {
	beforeEach(() => {
		(chrome.tabs.query as any).mockReset();
		(chrome.runtime as any).lastError = undefined;
	});

	it('retorna state="loading" enquanto a query não resolveu', () => {
		(chrome.tabs.query as any).mockImplementation(() => new Promise(() => {}));
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		expect(result.current.state).toBe('loading');
		expect(result.current.allTabs).toEqual([]);
	});

	it('expõe state="error" com a mensagem real quando chrome.tabs.query rejeita', async () => {
		mockQueryReject('Tab access denied');
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('error'));
		expect(result.current.error?.message).toBe('Tab access denied');
		expect(result.current.allTabs).toEqual([]);
	});

	it('filtra abas inelegíveis (chrome://, chrome-extension://, about:, view-source:, devtools://, sem id/title/url)', async () => {
		mockQuery([
			{ id: 1, title: 'OK', url: 'https://example.com/', index: 0 },
			{ id: 2, title: 'Internal', url: 'chrome://settings', index: 1 },
			{ id: 3, title: 'Ext', url: 'chrome-extension://abc/options.html', index: 2 },
			{ id: 4, title: 'About', url: 'about:blank', index: 3 },
			{ id: 5, title: 'View', url: 'view-source:https://example.com/', index: 4 },
			{ id: 6, title: 'DevTools', url: 'devtools://devtools/bundled/inspector.html', index: 5 },
			{ id: undefined, title: 'No ID', url: 'https://noid.example/', index: 6 },
			{ id: 8, title: '', url: 'https://empty-title.example/', index: 7 },
			{ id: 9, title: 'No URL', url: undefined, index: 8 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.allTabs.map((t) => t.id)).toEqual([1]);
	});

	it('agrupa domínios e ordena por contagem decrescente', async () => {
		mockQuery([
			{ id: 1, title: 'Issue 1', url: 'https://github.com/a', index: 0 },
			{ id: 2, title: 'Issue 2', url: 'https://github.com/b', index: 1 },
			{ id: 3, title: 'Issue 3', url: 'https://github.com/c', index: 2 },
			{ id: 4, title: 'SO', url: 'https://stackoverflow.com/q/1', index: 3 },
			{ id: 5, title: 'Local', url: 'http://localhost:3000/', index: 4 },
			{ id: 6, title: 'Local 2', url: 'http://localhost:5173/', index: 5 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.domains).toEqual([
			{ name: 'github.com', count: 3 },
			{ name: 'localhost', count: 2 },
			{ name: 'stackoverflow.com', count: 1 },
		]);
	});

	it('classifica URLs inválidas no domínio "(URL inválida)"', async () => {
		mockQuery([
			{ id: 1, title: 'OK', url: 'https://example.com/', index: 0 },
			{ id: 2, title: 'Quebrada', url: 'not-a-url', index: 1 },
		]);
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('ready'));
		const broken = result.current.allTabs.find((t) => t.id === 2);
		expect(broken?.hostname).toBe(INVALID_HOSTNAME);
		expect(result.current.domains.find((d) => d.name === INVALID_HOSTNAME)?.count).toBe(1);
	});

	it('busca é case-insensitive em título E URL', async () => {
		mockQuery([
			{ id: 1, title: 'Debug Buddy', url: 'http://localhost:5173/', index: 0 },
			{ id: 2, title: 'Outra coisa', url: 'https://example.com/debug', index: 1 },
			{ id: 3, title: 'Sem match', url: 'https://example.com/', index: 2 },
		]);
		const { result, rerender } = renderHook(
			({ q }: { q: string }) => useFilteredTabs(true, q, null),
			{ initialProps: { q: '' } },
		);
		await waitFor(() => expect(result.current.state).toBe('ready'));
		rerender({ q: 'DEBUG' });
		expect(result.current.filteredTabs.map((t) => t.id).sort()).toEqual([1, 2]);
	});

	it('activeDomain filtra apenas abas daquele hostname; null retorna todas', async () => {
		mockQuery([
			{ id: 1, title: 'A', url: 'https://github.com/a', index: 0 },
			{ id: 2, title: 'B', url: 'http://localhost:3000/', index: 1 },
		]);
		const { result, rerender } = renderHook(
			({ d }: { d: string | null }) => useFilteredTabs(true, '', d),
			{ initialProps: { d: null } },
		);
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.filteredTabs).toHaveLength(2);
		rerender({ d: 'github.com' });
		expect(result.current.filteredTabs.map((t) => t.id)).toEqual([1]);
	});

	it('não dispara query quando open=false', () => {
		mockQuery([{ id: 1, title: 'X', url: 'https://x.example/', index: 0 }]);
		renderHook(() => useFilteredTabs(false, '', null));
		expect(chrome.tabs.query).not.toHaveBeenCalled();
	});

	it('reload() força nova query (transita error → ready se a próxima resolver)', async () => {
		mockQueryReject('first failure');
		const { result } = renderHook(() => useFilteredTabs(true, '', null));
		await waitFor(() => expect(result.current.state).toBe('error'));
		mockQuery([{ id: 1, title: 'X', url: 'https://x.example/', index: 0 }]);
		act(() => result.current.reload());
		await waitFor(() => expect(result.current.state).toBe('ready'));
		expect(result.current.allTabs).toHaveLength(1);
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts
```

Esperado: FAIL com `Cannot find module '../useFilteredTabs'`.

### Step 3: Implementar o hook

`app/src/components/select-tab/hooks/useFilteredTabs.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { INVALID_HOSTNAME, type Tab } from '../types';

const INELIGIBLE_PREFIXES = [
	'chrome://',
	'chrome-extension://',
	'about:',
	'view-source:',
	'devtools://',
];

interface RawTab extends chrome.tabs.Tab {}

interface UseFilteredTabsResult {
	state: 'loading' | 'ready' | 'error';
	error: Error | null;
	allTabs: Tab[];
	filteredTabs: Tab[];
	domains: { name: string; count: number }[];
	reload: () => void;
}

const isEligible = (t: RawTab): t is RawTab & { id: number; title: string; url: string } => {
	if (typeof t.id !== 'number') return false;
	if (!t.title || t.title.length === 0) return false;
	if (!t.url || t.url.length === 0) return false;
	return !INELIGIBLE_PREFIXES.some((prefix) => t.url!.startsWith(prefix));
};

const computeHostname = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return INVALID_HOSTNAME;
	}
};

const queryTabs = (): Promise<RawTab[]> =>
	new Promise((resolve, reject) => {
		try {
			const maybe = chrome.tabs.query({ currentWindow: true }, (tabs) => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message ?? 'Erro desconhecido em chrome.tabs.query'));
					return;
				}
				resolve(tabs);
			});
			// Em MV3 o método também retorna Promise — se for o caso, encadeie
			if (maybe && typeof (maybe as any).then === 'function') {
				(maybe as Promise<RawTab[]>).then(resolve, reject);
			}
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});

export function useFilteredTabs(
	open: boolean,
	query: string,
	activeDomain: string | null,
): UseFilteredTabsResult {
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [error, setError] = useState<Error | null>(null);
	const [allTabs, setAllTabs] = useState<Tab[]>([]);
	const [version, setVersion] = useState(0);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setState('loading');
		setError(null);
		queryTabs()
			.then((raw) => {
				if (cancelled) return;
				const eligible = raw.filter(isEligible).map<Tab>((t) => ({
					id: t.id,
					title: t.title,
					url: t.url,
					favIconUrl: t.favIconUrl,
					index: t.index,
					hostname: computeHostname(t.url),
				}));
				setAllTabs(eligible);
				setState('ready');
			})
			.catch((err: Error) => {
				if (cancelled) return;
				setError(err);
				setAllTabs([]);
				setState('error');
			});
		return () => {
			cancelled = true;
		};
	}, [open, version]);

	const reload = useCallback(() => setVersion((v) => v + 1), []);

	const domains = useMemo(() => {
		const counts = new Map<string, number>();
		for (const t of allTabs) {
			counts.set(t.hostname, (counts.get(t.hostname) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
	}, [allTabs]);

	const filteredTabs = useMemo(() => {
		const q = query.trim().toLocaleLowerCase();
		return allTabs.filter((t) => {
			if (q.length > 0) {
				const matchTitle = t.title.toLocaleLowerCase().includes(q);
				const matchUrl = t.url.toLocaleLowerCase().includes(q);
				if (!matchTitle && !matchUrl) return false;
			}
			if (activeDomain !== null && t.hostname !== activeDomain) return false;
			return true;
		});
	}, [allTabs, query, activeDomain]);

	return { state, error, allTabs, filteredTabs, domains, reload };
}
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts
```

Esperado: 9 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/hooks/useFilteredTabs.ts app/src/components/select-tab/hooks/__tests__/useFilteredTabs.test.ts
git commit -m "feat(select-tab): adicionar hook useFilteredTabs com filtros e tratamento de erro"
```

---

## Task 3: Componente `TabSearchBar`

**Files:**
- Create: `app/src/components/select-tab/TabSearchBar.tsx`
- Test: `app/src/components/select-tab/__tests__/TabSearchBar.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/TabSearchBar.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabSearchBar } from '../TabSearchBar';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

describe('TabSearchBar', () => {
	it('renderiza ícone de busca e badge "/"', () => {
		render(<TabSearchBar value="" onChange={vi.fn()} />);
		expect(screen.getByTestId('lucide-icon')).toHaveAttribute('data-name', 'search');
		expect(screen.getByText('/')).toBeInTheDocument();
	});

	it('dispara onChange com o novo valor ao digitar', () => {
		const onChange = vi.fn();
		render(<TabSearchBar value="" onChange={onChange} />);
		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'github' } });
		expect(onChange).toHaveBeenCalledWith('github');
	});

	it('expõe foco programático via ref', () => {
		const ref = React.createRef<HTMLInputElement>();
		render(<TabSearchBar value="" onChange={vi.fn()} inputRef={ref} />);
		expect(ref.current).toBeInstanceOf(HTMLInputElement);
		ref.current?.focus();
		expect(document.activeElement).toBe(ref.current);
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabSearchBar.test.tsx
```

Esperado: FAIL com `Cannot find module '../TabSearchBar'`.

### Step 3: Implementar o componente

`app/src/components/select-tab/TabSearchBar.tsx`:

```tsx
import React from 'react';
import { LucideIcon } from '../ui/lucide-icon';
import { cn } from '@/lib/utils';

interface TabSearchBarProps {
	value: string;
	onChange: (value: string) => void;
	inputRef?: React.Ref<HTMLInputElement>;
	className?: string;
}

export const TabSearchBar: React.FC<TabSearchBarProps> = ({
	value,
	onChange,
	inputRef,
	className,
}) => {
	return (
		<div className={cn('relative flex-1', className)}>
			<LucideIcon
				name="search"
				className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				ref={inputRef}
				type="search"
				role="searchbox"
				aria-label="Buscar abas por título ou URL"
				aria-controls="tab-listbox"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Buscar por título ou URL..."
				className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-12 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<kbd
				aria-hidden="true"
				className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-input bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
			>
				/
			</kbd>
		</div>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabSearchBar.test.tsx
```

Esperado: 3 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/TabSearchBar.tsx app/src/components/select-tab/__tests__/TabSearchBar.test.tsx
git commit -m "feat(select-tab): adicionar TabSearchBar com ícone, atalho / e foco via ref"
```

---

## Task 4: Componente `DomainChipFilter`

**Files:**
- Create: `app/src/components/select-tab/DomainChipFilter.tsx`
- Test: `app/src/components/select-tab/__tests__/DomainChipFilter.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/DomainChipFilter.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DomainChipFilter } from '../DomainChipFilter';

const domains = [
	{ name: 'github.com', count: 3 },
	{ name: 'localhost', count: 2 },
];

describe('DomainChipFilter', () => {
	it('renderiza chip "Todos" como primeiro e ativo quando active=null', () => {
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={vi.fn()} />);
		const buttons = screen.getAllByRole('button');
		expect(buttons[0]).toHaveTextContent('Todos');
		expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('5')).toBeInTheDocument();
	});

	it('renderiza um chip por domínio com a contagem', () => {
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={vi.fn()} />);
		expect(screen.getByText('github.com')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('localhost')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('chip clicado emite onChange(domain)', () => {
		const onChange = vi.fn();
		render(<DomainChipFilter domains={domains} total={5} active={null} onChange={onChange} />);
		fireEvent.click(screen.getByRole('button', { name: /github\.com/ }));
		expect(onChange).toHaveBeenCalledWith('github.com');
	});

	it('chip "Todos" clicado emite onChange(null)', () => {
		const onChange = vi.fn();
		render(
			<DomainChipFilter domains={domains} total={5} active="github.com" onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
		expect(onChange).toHaveBeenCalledWith(null);
	});

	it('chip ativo recebe aria-pressed="true"', () => {
		render(
			<DomainChipFilter domains={domains} total={5} active="github.com" onChange={vi.fn()} />,
		);
		expect(screen.getByRole('button', { name: /github\.com/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'false');
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/DomainChipFilter.test.tsx
```

Esperado: FAIL com `Cannot find module '../DomainChipFilter'`.

### Step 3: Implementar o componente

`app/src/components/select-tab/DomainChipFilter.tsx`:

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface DomainChipFilterProps {
	domains: { name: string; count: number }[];
	total: number;
	active: string | null;
	onChange: (domain: string | null) => void;
}

const Chip: React.FC<{
	label: string;
	count: number;
	pressed: boolean;
	onClick: () => void;
	ariaLabel?: string;
}> = ({ label, count, pressed, onClick, ariaLabel }) => (
	<button
		type="button"
		aria-pressed={pressed}
		aria-label={ariaLabel}
		onClick={onClick}
		className={cn(
			'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
			pressed
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-input bg-background text-foreground hover:bg-accent',
		)}
	>
		<span>{label}</span>
		<span
			className={cn(
				'text-[10px] tabular-nums',
				pressed ? 'opacity-80' : 'text-muted-foreground',
			)}
		>
			{count}
		</span>
	</button>
);

export const DomainChipFilter: React.FC<DomainChipFilterProps> = ({
	domains,
	total,
	active,
	onChange,
}) => {
	return (
		<div className="flex flex-wrap gap-1.5">
			<Chip
				label="Todos"
				count={total}
				pressed={active === null}
				onClick={() => onChange(null)}
				ariaLabel="Mostrar todos os domínios"
			/>
			{domains.map((d) => (
				<Chip
					key={d.name}
					label={d.name}
					count={d.count}
					pressed={active === d.name}
					onClick={() => onChange(d.name)}
				/>
			))}
		</div>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/DomainChipFilter.test.tsx
```

Esperado: 5 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/DomainChipFilter.tsx app/src/components/select-tab/__tests__/DomainChipFilter.test.tsx
git commit -m "feat(select-tab): adicionar DomainChipFilter com contagem e estado ativo"
```

---

## Task 5: Componente `TabRow`

**Files:**
- Create: `app/src/components/select-tab/TabRow.tsx`
- Test: `app/src/components/select-tab/__tests__/TabRow.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/TabRow.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabRow } from '../TabRow';
import type { Tab } from '../types';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const baseTab: Tab = {
	id: 1,
	title: 'Issues · guichafy/chrome-extension-debug-buddy',
	url: 'https://github.com/guichafy/chrome-extension-debug-buddy/issues',
	hostname: 'github.com',
	favIconUrl: 'https://github.com/favicon.ico',
	index: 0,
};

describe('TabRow', () => {
	it('renderiza título, URL e chip de domínio', () => {
		render(
			<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />,
		);
		expect(screen.getByText(/Issues · guichafy/)).toBeInTheDocument();
		expect(screen.getByText(baseTab.url)).toBeInTheDocument();
		expect(screen.getByText('github.com')).toBeInTheDocument();
	});

	it('renderiza badge "Atual" quando isCurrent=true', () => {
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={true} onSelect={vi.fn()} />);
		expect(screen.getByText('Atual')).toBeInTheDocument();
	});

	it('NÃO renderiza badge "Atual" quando isCurrent=false', () => {
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.queryByText('Atual')).not.toBeInTheDocument();
	});

	it('clique chama onSelect(tab)', () => {
		const onSelect = vi.fn();
		render(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={onSelect} />);
		fireEvent.click(screen.getByRole('option'));
		expect(onSelect).toHaveBeenCalledWith(baseTab);
	});

	it('aplica role="option" e aria-selected segundo isFocused', () => {
		const { rerender } = render(
			<TabRow tab={baseTab} isFocused={true} isCurrent={false} onSelect={vi.fn()} />,
		);
		const row = screen.getByRole('option');
		expect(row).toHaveAttribute('aria-selected', 'true');
		expect(row).toHaveAttribute('id', 'tab-row-1');
		rerender(<TabRow tab={baseTab} isFocused={false} isCurrent={false} onSelect={vi.fn()} />);
		expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
	});

	it('renderiza placeholder de favicon quando favIconUrl ausente', () => {
		const tabSemFavicon = { ...baseTab, favIconUrl: undefined };
		render(
			<TabRow tab={tabSemFavicon} isFocused={false} isCurrent={false} onSelect={vi.fn()} />,
		);
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByTestId('favicon-placeholder')).toBeInTheDocument();
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabRow.test.tsx
```

Esperado: FAIL com `Cannot find module '../TabRow'`.

### Step 3: Implementar o componente

`app/src/components/select-tab/TabRow.tsx`:

```tsx
import React from 'react';
import { LucideIcon } from '../ui/lucide-icon';
import { cn } from '@/lib/utils';
import type { Tab } from './types';

interface TabRowProps {
	tab: Tab;
	isFocused: boolean;
	isCurrent: boolean;
	onSelect: (tab: Tab) => void;
}

const Favicon: React.FC<{ tab: Tab }> = ({ tab }) => {
	const [errored, setErrored] = React.useState(false);
	const initial = tab.hostname.charAt(0).toUpperCase() || '?';
	if (!tab.favIconUrl || errored) {
		return (
			<div
				data-testid="favicon-placeholder"
				className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground"
				aria-hidden="true"
			>
				{initial}
			</div>
		);
	}
	return (
		<img
			src={tab.favIconUrl}
			alt=""
			loading="lazy"
			onError={() => setErrored(true)}
			className="h-5 w-5 flex-shrink-0 rounded"
		/>
	);
};

export const TabRow: React.FC<TabRowProps> = ({ tab, isFocused, isCurrent, onSelect }) => {
	return (
		<div
			role="option"
			id={`tab-row-${tab.id}`}
			aria-selected={isFocused}
			onClick={() => onSelect(tab)}
			className={cn(
				'flex w-full cursor-pointer items-center gap-3 border-b border-border px-6 py-2.5 transition-colors last:border-b-0',
				isFocused ? 'bg-accent' : 'hover:bg-muted/50',
			)}
		>
			<Favicon tab={tab} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-medium text-foreground">{tab.title}</span>
					{isCurrent && (
						<span className="flex-shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
							Atual
						</span>
					)}
				</div>
				<div className="truncate text-xs text-muted-foreground">{tab.url}</div>
			</div>
			<span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
				{tab.hostname}
			</span>
			<LucideIcon name="chevron-right" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
		</div>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabRow.test.tsx
```

Esperado: 6 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/TabRow.tsx app/src/components/select-tab/__tests__/TabRow.test.tsx
git commit -m "feat(select-tab): adicionar TabRow com favicon, badge Atual e role=option"
```

---

## Task 6: Componente `TabList`

**Files:**
- Create: `app/src/components/select-tab/TabList.tsx`
- Test: `app/src/components/select-tab/__tests__/TabList.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/TabList.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TabList } from '../TabList';
import type { Tab } from '../types';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const tabs: Tab[] = [
	{ id: 10, title: 'A', url: 'https://a.example/', hostname: 'a.example', index: 0 },
	{ id: 20, title: 'B', url: 'https://b.example/', hostname: 'b.example', index: 1 },
	{ id: 30, title: 'C', url: 'https://c.example/', hostname: 'c.example', index: 2 },
];

describe('TabList', () => {
	it('renderiza role="listbox" com id e aria-label', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={null} onSelect={vi.fn()} />);
		const list = screen.getByRole('listbox');
		expect(list).toHaveAttribute('id', 'tab-listbox');
		expect(list).toHaveAttribute('aria-label', 'Abas disponíveis');
	});

	it('aplica aria-activedescendant para a linha focada', () => {
		render(<TabList tabs={tabs} focusedIndex={1} currentTabId={null} onSelect={vi.fn()} />);
		expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', 'tab-row-20');
	});

	it('renderiza um TabRow por aba', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={null} onSelect={vi.fn()} />);
		expect(screen.getAllByRole('option')).toHaveLength(3);
	});

	it('marca a linha cujo id bate com currentTabId como Atual', () => {
		render(<TabList tabs={tabs} focusedIndex={0} currentTabId={20} onSelect={vi.fn()} />);
		expect(screen.getByText('Atual')).toBeInTheDocument();
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabList.test.tsx
```

Esperado: FAIL com `Cannot find module '../TabList'`.

### Step 3: Implementar o componente

`app/src/components/select-tab/TabList.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { TabRow } from './TabRow';
import type { Tab } from './types';

interface TabListProps {
	tabs: Tab[];
	focusedIndex: number;
	currentTabId: number | null;
	onSelect: (tab: Tab) => void;
}

export const TabList: React.FC<TabListProps> = ({ tabs, focusedIndex, currentTabId, onSelect }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const focusedTabId = tabs[focusedIndex]?.id;

	useEffect(() => {
		if (focusedTabId === undefined) return;
		const el = containerRef.current?.querySelector(`#tab-row-${focusedTabId}`);
		if (el && 'scrollIntoView' in el) {
			(el as HTMLElement).scrollIntoView({ block: 'nearest' });
		}
	}, [focusedTabId]);

	return (
		<div
			ref={containerRef}
			role="listbox"
			id="tab-listbox"
			aria-label="Abas disponíveis"
			aria-activedescendant={focusedTabId !== undefined ? `tab-row-${focusedTabId}` : undefined}
			className="flex-1 overflow-y-auto"
		>
			{tabs.map((tab, idx) => (
				<TabRow
					key={tab.id}
					tab={tab}
					isFocused={idx === focusedIndex}
					isCurrent={tab.id === currentTabId}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/TabList.test.tsx
```

Esperado: 4 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/TabList.tsx app/src/components/select-tab/__tests__/TabList.test.tsx
git commit -m "feat(select-tab): adicionar TabList como listbox com aria-activedescendant"
```

---

## Task 7: Componente `EmptyState`

**Files:**
- Create: `app/src/components/select-tab/EmptyState.tsx`
- Test: `app/src/components/select-tab/__tests__/EmptyState.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/EmptyState.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
	it('variant="loading" renderiza spinner com role="status"', () => {
		render(<EmptyState variant="loading" />);
		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	it('variant="no-tabs" mostra mensagem padrão', () => {
		render(<EmptyState variant="no-tabs" />);
		expect(
			screen.getByText('Nenhuma aba disponível para interceptação'),
		).toBeInTheDocument();
	});

	it('variant="no-results" mostra a query e botão "Limpar busca"', () => {
		const onClearSearch = vi.fn();
		render(<EmptyState variant="no-results" query="github" onClearSearch={onClearSearch} />);
		expect(screen.getByText(/Nenhuma aba corresponde a/)).toBeInTheDocument();
		expect(screen.getByText('github')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Limpar busca/ }));
		expect(onClearSearch).toHaveBeenCalled();
	});

	it('variant="error" mostra error.message e botão "Tentar novamente"', () => {
		const onRetry = vi.fn();
		render(
			<EmptyState
				variant="error"
				error={new Error('Tab access denied')}
				onRetry={onRetry}
			/>,
		);
		expect(screen.getByText('Tab access denied')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
		expect(onRetry).toHaveBeenCalled();
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/EmptyState.test.tsx
```

Esperado: FAIL com `Cannot find module '../EmptyState'`.

### Step 3: Implementar o componente

`app/src/components/select-tab/EmptyState.tsx`:

```tsx
import React from 'react';
import { Button } from '../ui/button';

type Variant = 'loading' | 'no-tabs' | 'no-results' | 'error';

interface EmptyStateProps {
	variant: Variant;
	query?: string;
	error?: Error;
	onClearSearch?: () => void;
	onRetry?: () => void;
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
		{children}
	</div>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
	variant,
	query,
	error,
	onClearSearch,
	onRetry,
}) => {
	if (variant === 'loading') {
		return (
			<Wrapper>
				<div
					role="status"
					aria-label="Carregando abas"
					className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
				/>
			</Wrapper>
		);
	}

	if (variant === 'no-tabs') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">
					Nenhuma aba disponível para interceptação
				</p>
			</Wrapper>
		);
	}

	if (variant === 'no-results') {
		return (
			<Wrapper>
				<p className="text-sm text-muted-foreground">
					Nenhuma aba corresponde a <span className="font-medium text-foreground">{query}</span>
				</p>
				<Button variant="ghost" size="sm" onClick={onClearSearch}>
					Limpar busca
				</Button>
			</Wrapper>
		);
	}

	// variant === 'error'
	return (
		<Wrapper>
			<p className="text-sm font-medium text-destructive">Erro ao carregar abas</p>
			<p className="text-xs text-muted-foreground">{error?.message ?? 'Erro desconhecido'}</p>
			<Button variant="outline" size="sm" onClick={onRetry}>
				Tentar novamente
			</Button>
		</Wrapper>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/EmptyState.test.tsx
```

Esperado: 4 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/EmptyState.tsx app/src/components/select-tab/__tests__/EmptyState.test.tsx
git commit -m "feat(select-tab): adicionar EmptyState com variantes loading/no-tabs/no-results/error"
```

---

## Task 8: Container `SelectTabDialog`

**Files:**
- Create: `app/src/components/select-tab/SelectTabDialog.tsx`
- Test: `app/src/components/select-tab/__tests__/SelectTabDialog.test.tsx`

### Step 1: Escrever testes falhando

`app/src/components/select-tab/__tests__/SelectTabDialog.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SelectTabDialog } from '../SelectTabDialog';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

const setupTabs = (tabs: any[]) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.resolve(tabs));
};

const setupQueryReject = (msg: string) => {
	(chrome.tabs.query as any).mockImplementation(() => Promise.reject(new Error(msg)));
};

const setupTargetTab = (tabId: number | null) => {
	const result = tabId === null ? {} : { targetTabInfo: { tabId, tabTitle: '', tabUrl: '' } };
	(chrome.storage.local.get as any).mockResolvedValue(result);
};

const sampleTabs = [
	{ id: 1, title: 'GitHub Issues', url: 'https://github.com/x/y/issues', index: 0 },
	{ id: 2, title: 'Localhost dev', url: 'http://localhost:5173/', index: 1 },
	{ id: 3, title: 'Docs MDN', url: 'https://developer.mozilla.org/', index: 2 },
];

describe('SelectTabDialog', () => {
	beforeEach(() => {
		(chrome.tabs.query as any).mockReset();
		(chrome.storage.local.get as any).mockReset();
		(chrome.runtime as any).lastError = undefined;
		setupTargetTab(null);
	});

	it('mostra spinner enquanto carrega e depois renderiza a lista', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		expect(screen.getByRole('status')).toBeInTheDocument();
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
	});

	it('renderiza badge "Atual" na aba que bate com targetTabInfo.tabId', async () => {
		setupTabs(sampleTabs);
		setupTargetTab(2);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getByText('Atual')).toBeInTheDocument());
		expect(screen.getByText('Atual').closest('[role="option"]')).toHaveAttribute(
			'id',
			'tab-row-2',
		);
	});

	it('Enter na linha focada chama onSelectTab e fecha o dialog', async () => {
		setupTabs(sampleTabs);
		const onSelectTab = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<SelectTabDialog open={true} onOpenChange={onOpenChange} onSelectTab={onSelectTab} />,
		);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		fireEvent.keyDown(window, { key: 'ArrowDown' });
		fireEvent.keyDown(window, { key: 'Enter' });
		expect(onSelectTab).toHaveBeenCalledWith(2, 'Localhost dev', 'http://localhost:5173/');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('"/" foca o input de busca quando o foco não está em outro input', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		// Tira o foco do input (que recebe foco automático no mount)
		const list = screen.getByRole('listbox');
		fireEvent.keyDown(list, { key: '/' });
		expect(document.activeElement).toBe(screen.getByRole('searchbox'));
	});

	it('digitar na busca filtra a lista; "Limpar busca" reseta', async () => {
		setupTabs(sampleTabs);
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } });
		await waitFor(() =>
			expect(screen.getByText(/Nenhuma aba corresponde a/)).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByRole('button', { name: /Limpar busca/ }));
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
	});

	it('estado error mostra mensagem real do erro com botão "Tentar novamente"', async () => {
		setupQueryReject('Tab access denied');
		render(<SelectTabDialog open={true} onOpenChange={vi.fn()} onSelectTab={vi.fn()} />);
		await waitFor(() => expect(screen.getByText('Tab access denied')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
	});
});
```

### Step 2: Rodar testes para confirmar falha

```bash
cd app && npx vitest run src/components/select-tab/__tests__/SelectTabDialog.test.tsx
```

Esperado: FAIL com `Cannot find module '../SelectTabDialog'`.

### Step 3: Implementar o container

`app/src/components/select-tab/SelectTabDialog.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog';
import { TabSearchBar } from './TabSearchBar';
import { DomainChipFilter } from './DomainChipFilter';
import { TabList } from './TabList';
import { EmptyState } from './EmptyState';
import { useFilteredTabs } from './hooks/useFilteredTabs';
import type { Tab } from './types';

interface SelectTabDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectTab: (tabId: number, tabTitle: string, tabUrl: string) => void;
}

const isFormElement = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return (
		tag === 'INPUT' ||
		tag === 'TEXTAREA' ||
		tag === 'SELECT' ||
		target.isContentEditable
	);
};

export const SelectTabDialog: React.FC<SelectTabDialogProps> = ({
	open,
	onOpenChange,
	onSelectTab,
}) => {
	const [query, setQuery] = useState('');
	const [activeDomain, setActiveDomain] = useState<string | null>(null);
	const [focusedIndex, setFocusedIndex] = useState(0);
	const [currentTabId, setCurrentTabId] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { state, error, allTabs, filteredTabs, domains, reload } = useFilteredTabs(
		open,
		query,
		activeDomain,
	);

	useEffect(() => {
		if (!open) return;
		setQuery('');
		setActiveDomain(null);
		setFocusedIndex(0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		chrome.storage.local
			.get(['targetTabInfo'])
			.then((data) => {
				if (cancelled) return;
				const info = (data as { targetTabInfo?: { tabId?: number } }).targetTabInfo;
				setCurrentTabId(typeof info?.tabId === 'number' ? info.tabId : null);
			})
			.catch((err) => {
				console.warn('select-tab: falha ao ler targetTabInfo', err);
				if (!cancelled) setCurrentTabId(null);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	useEffect(() => {
		setFocusedIndex(0);
	}, [query, activeDomain]);

	const handleSelect = useCallback(
		(tab: Tab) => {
			onSelectTab(tab.id, tab.title, tab.url);
			onOpenChange(false);
		},
		[onSelectTab, onOpenChange],
	);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				setFocusedIndex((idx) => Math.min(filteredTabs.length - 1, idx + 1));
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				setFocusedIndex((idx) => Math.max(0, idx - 1));
				return;
			}
			if (e.key === 'Enter') {
				const tab = filteredTabs[focusedIndex];
				if (tab) {
					e.preventDefault();
					handleSelect(tab);
				}
				return;
			}
			if (e.key === '/' && !isFormElement(e.target)) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [open, filteredTabs, focusedIndex, handleSelect]);

	const onClearSearch = () => {
		setQuery('');
		setActiveDomain(null);
	};

	const onRetry = () => reload();

	let body: React.ReactNode;
	if (state === 'loading') {
		body = <EmptyState variant="loading" />;
	} else if (state === 'error') {
		body = <EmptyState variant="error" error={error ?? undefined} onRetry={onRetry} />;
	} else if (allTabs.length === 0) {
		body = <EmptyState variant="no-tabs" />;
	} else if (filteredTabs.length === 0) {
		body = <EmptyState variant="no-results" query={query} onClearSearch={onClearSearch} />;
	} else {
		body = (
			<TabList
				tabs={filteredTabs}
				focusedIndex={focusedIndex}
				currentTabId={currentTabId}
				onSelect={handleSelect}
			/>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="px-6 pb-4 pt-6">
					<DialogTitle>Selecionar aba para interceptar</DialogTitle>
					<DialogDescription>
						Escolha a aba que deseja monitorar as requisições de rede.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 border-y border-border bg-muted/30 px-6 py-4">
					<div className="flex items-center gap-3">
						<TabSearchBar value={query} onChange={setQuery} inputRef={inputRef} />
						<span className="whitespace-nowrap text-xs text-muted-foreground">
							{allTabs.length} {allTabs.length === 1 ? 'aba' : 'abas'}
						</span>
					</div>
					{state === 'ready' && allTabs.length > 0 && (
						<DomainChipFilter
							domains={domains.filter((d) => d.name !== '')}
							total={allTabs.length}
							active={activeDomain}
							onChange={setActiveDomain}
						/>
					)}
				</div>

				<div className="flex min-h-[260px] flex-1 flex-col overflow-hidden">{body}</div>

				<div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-3 text-[11px] text-muted-foreground">
					<span className="flex gap-3">
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">↑</kbd>
							<kbd className="ml-0.5 rounded border border-border bg-background px-1 font-mono">↓</kbd>{' '}
							Navegar
						</span>
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">Enter</kbd>{' '}
							Selecionar
						</span>
						<span>
							<kbd className="rounded border border-border bg-background px-1 font-mono">Esc</kbd>{' '}
							Fechar
						</span>
					</span>
					{state === 'ready' && allTabs.length > 0 && (
						<span>
							{filteredTabs.length} de {allTabs.length} abas visíveis
						</span>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
```

### Step 4: Rodar testes para confirmar PASS

```bash
cd app && npx vitest run src/components/select-tab/__tests__/SelectTabDialog.test.tsx
```

Esperado: 6 testes passando.

### Step 5: Commit

```bash
git add app/src/components/select-tab/SelectTabDialog.tsx app/src/components/select-tab/__tests__/SelectTabDialog.test.tsx
git commit -m "feat(select-tab): adicionar container SelectTabDialog com teclado e estados"
```

---

## Task 9: Substituir o componente antigo

**Files:**
- Modify: `app/src/pages/Layout.tsx:3`
- Delete: `app/src/components/SelectTabDialog.tsx`

- [ ] **Step 1: Atualizar import em `Layout.tsx`**

Em `app/src/pages/Layout.tsx`, alterar:

```tsx
import SelectTabDialog from '../components/SelectTabDialog';
```

Para:

```tsx
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
```

- [ ] **Step 2: Verificar usos restantes do arquivo antigo**

```bash
cd app && grep -rn "from '../components/SelectTabDialog'" src
cd app && grep -rn "from '@/components/SelectTabDialog'" src
```

Esperado: nenhum resultado (somente o import alterado em `Layout.tsx`).

- [ ] **Step 3: Remover arquivo antigo**

```bash
rm app/src/components/SelectTabDialog.tsx
```

- [ ] **Step 4: Rodar a suíte completa**

```bash
cd app && npm test -- --run
```

Esperado: tudo verde, incluindo os novos testes da Task 2–8.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/Layout.tsx app/src/components/SelectTabDialog.tsx
git commit -m "refactor(select-tab): substituir SelectTabDialog antigo pela nova estrutura"
```

(`git add` no arquivo deletado registra o `D` no índice; o commit captura a remoção.)

---

## Task 10: Verificação final (lint, typecheck, build, manual)

**Files:** _none_

- [ ] **Step 1: Lint**

```bash
cd app && npm run lint
```

Esperado: zero issues. Se aparecer, rode `npm run lint:fix` e revise as mudanças manualmente.

- [ ] **Step 2: TypeScript**

```bash
cd app && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Suíte de testes completa**

```bash
cd app && npm test -- --run
```

Esperado: todos os testes passam (incluindo os novos arquivos da Task 2–8).

- [ ] **Step 4: Build de produção**

```bash
cd app && npm run build
```

Esperado: build OK com `dist/` gerado.

- [ ] **Step 5: Validação manual no Chrome**

1. `cd app && npm run build` (já feito).
2. `chrome://extensions` → recarregar a extensão a partir de `app/dist/`.
3. Clicar no ícone da extensão para abrir o interceptor; clicar "Selecionar aba" no header.
4. Conferir, em ordem:
   - Modal aparece visivelmente maior que antes (largura ~896 px, altura até ~85 % do viewport).
   - Input de busca focado por padrão; ícone de lupa à esquerda; badge `/` à direita.
   - Linha de chips abaixo da busca, com "Todos" ativo e a contagem total no chip.
   - Lista renderiza título + URL truncada por aba, com chip de domínio à direita.
   - Digitar parte de um título → lista filtra; rodapé mostra "X de Y abas visíveis".
   - Clicar num chip → lista reduz ao domínio; clicar "Todos" → volta tudo.
   - `↑/↓` movem o destaque visual; `Enter` confirma; `Esc` fecha; `/` foca a busca.
   - Se já houver `targetTab` selecionada e ela aparecer na lista, badge verde "Atual" é exibida.
   - Filtrar para um termo inexistente → estado "Nenhuma aba corresponde" com botão "Limpar busca" funcional.
5. Forçar erro: abrir devtools do interceptor, executar `chrome.tabs.query = () => Promise.reject(new Error('teste'))`, abrir o dialog → estado de erro com a mensagem "teste" e botão "Tentar novamente". Em seguida, reverter o stub recarregando a página.

- [ ] **Step 6: Commit final (somente se algum ajuste de lint/build foi feito)**

Se `npm run lint:fix` ou outras correções pequenas foram aplicadas:

```bash
git add -A
git commit -m "chore(select-tab): correções pós-verificação (lint/build)"
```

Caso contrário, pular.

---

## Critérios de conclusão

A entrega está completa quando:

- Todas as tasks 1–10 marcadas com `- [x]` e seus commits no histórico.
- `npm run lint`, `npx tsc --noEmit`, `npm test -- --run` e `npm run build` rodam todos verdes em `app/`.
- Validação manual no Chrome cobre os 9 critérios de aceitação do spec (`docs/superpowers/specs/2026-04-28-select-tab-dialog-redesign-design.md`, seção "Critérios de aceitação").
- O arquivo `app/src/components/SelectTabDialog.tsx` não existe mais; `app/src/components/select-tab/` contém a nova estrutura.
- Nenhum fallback silencioso introduzido (rever cada `??`/`||` em código novo: deve ser visual ou tipado com erro propagado).
