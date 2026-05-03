# Spec: Live Insights v3 — Sub-agrupamento + Remoção de state detection

**Produto:** Debug Buddy
**Status:** Draft v1.0 — entrevista 2026-05-03 (após validação visual da v2)
**Branch:** `feature/session-replay`
**Refina:** v2 (`2026-05-03-live-insights-visual-organization-design.md`)

---

## 0. Motivação

Após v2 entregue (agrupamento por categoria + paleta dedicada), validação visual em sites reais revelou dois problemas:

1. **Sub-agrupamento ausente.** Dentro de cada categoria (Segurança/Performance), 18+9 hits aparecem em lista plana — para um host com muitos endpoints, vê-se a mesma regra repetida dezenas de vezes. Difícil de navegar e priorizar.

2. **State detection sem retorno em produção.** A feature de captura de estado (Redux/Zustand/NgRx/Angular Signals) só funciona quando a app expõe globais de devtools — caso raro em produção real. Em todos os testes em sites públicos (pokemon.com, formio), a seção "Estado ao vivo" mostrou "Nenhum store de estado detectado nesta página". Custo de manutenção alto (probe taps, types, recorder, UI, persistência) sem valor prático visível. Decisão: remover por completo nesta passagem para evitar dead code.

## 1. Decisões consolidadas

| # | Decisão | Implicação |
|---|---|---|
| 1 | Sub-agrupar recomendações por `ruleId` dentro de categoria | Cada categoria mantém `<details open>`; cada ruleId vira `<details>` (sem `open`) — collapsed por default. |
| 2 | Header de cada grupo de ruleId mostra severity badge + count | Severity é a mesma para todas instâncias de uma rule. Ex: `▸ [ERRO] csp-missing (5)`. |
| 3 | Remover toda detecção/captura de state | Probe taps, recorder methods, types, UI section, mensagens, viewer rendering. |
| 4 | Manter `angularHttpTap` (não é state — é HTTP) | Continuação da feature `angular-http` em `httpClients`. |
| 5 | Manter `detectAngular` fallback prod (`app-root`/`_ngcontent`) | Já era independente de state. |
| 6 | Manter Recommendations engine + Live snapshot cache (sem `state` field) | Cache fica com `detection` + `recommendations` apenas. |
| 7 | Backward compat de sessões exportadas com state | Schema mantém `schemaVersion: 1`; campos `stateBaseline`/`stateKeyframes`/`StateChangeEvent` permanecem opcionais; importer ignora silenciosamente. Viewer não renderiza. |

## 2. UI Recomendações — sub-agrupamento

### 2.1 Estrutura

```
RECOMENDAÇÕES (27)
═══════════════════════════════════════
▾ Segurança (18)                          ← <details open>
  ▸ [ERRO] csp-missing (5)                ← <details> (collapsed)
  ▸ [ERRO] hsts-missing (3)
  ▸ [AVISO] cors-open (10)

▾ Performance (9)
  ▸ [AVISO] compression-missing (4)
  ▸ [INFO] cache-missing (5)
```

Ao expandir um grupo de ruleId:

```
▾ [ERRO] csp-missing (5)
   /api/products      example.com    ← cada item é uma instância
   /api/users         example.com
   /api/orders        example.com
   /static/index.html www.example.com
   /static/login.html www.example.com
```

Ao clicar numa instância, expande para mostrar `evidence` + `suggestion` (mesmo comportamento que hoje).

### 2.2 Component shape

```tsx
function RecommendationsSection({ items }: { items: Recommendation[] }) {
	if (items.length === 0) return <EmptyState />;

	const grouped: Record<RecommendationCategory, Recommendation[]> = { security: [], performance: [] };
	for (const r of items) {
		const cat = RULE_CATEGORIES[r.ruleId];
		if (cat) grouped[cat].push(r);
	}

	return (
		<div>
			{CATEGORY_ORDER.map((cat) =>
				grouped[cat].length === 0 ? null : (
					<details key={cat} open className="border-b last:border-b-0">
						<summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hover:bg-muted/40">
							{CATEGORY_LABEL[cat]} ({grouped[cat].length})
						</summary>
						<RuleGroups items={grouped[cat]} />
					</details>
				),
			)}
		</div>
	);
}

function RuleGroups({ items }: { items: Recommendation[] }) {
	// Agrupa por ruleId preservando ordem de inserção (newest first do reducer)
	const byRule = new Map<RecommendationRuleId, Recommendation[]>();
	for (const r of items) {
		const arr = byRule.get(r.ruleId) ?? [];
		arr.push(r);
		byRule.set(r.ruleId, arr);
	}

	return (
		<div>
			{[...byRule.entries()].map(([ruleId, instances]) => (
				<RuleGroup key={ruleId} ruleId={ruleId} instances={instances} />
			))}
		</div>
	);
}

function RuleGroup({ ruleId, instances }: { ruleId: RecommendationRuleId; instances: Recommendation[] }) {
	const severity = instances[0].severity;
	return (
		<details className="border-t first:border-t-0">
			<summary className={`cursor-pointer select-none px-4 py-1.5 text-xs hover:bg-muted/40 flex items-center gap-2 border-l-2 ${SEVERITY_BORDER[severity]}`}>
				<span className={`font-semibold text-[10px] ${SEVERITY_LABEL_CLASSES[severity]}`}>
					{SEVERITY_LABEL[severity]}
				</span>
				<span className="font-medium">{ruleId}</span>
				<span className="ml-auto text-muted-foreground">({instances.length})</span>
			</summary>
			<div>
				{instances.map((r) => <RecommendationRow key={r.id} item={r} compact />)}
			</div>
		</details>
	);
}
```

### 2.3 Mudança em `RecommendationRow`

Nova prop `compact?: boolean`. Quando true:
- Não renderiza `[ERRO]` label nem `ruleId` (já estão no header do grupo).
- Não renderiza border-left colorido (já está no header do grupo).
- Mostra: `path` (extraído de `url`) + host à direita.
- Mantém comportamento de expansão (clique mostra evidence + suggestion).

```tsx
export function RecommendationRow({ item, compact }: { item: Recommendation; compact?: boolean }) {
	// ... existing state
	const pathname = (() => {
		try { return new URL(item.url).pathname; } catch { return item.url; }
	})();

	if (compact) {
		return (
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full flex-col items-start gap-1 border-b px-4 py-1.5 text-left text-xs hover:bg-muted/40"
			>
				<div className="flex w-full items-center gap-2">
					<span className="font-mono">{pathname}</span>
					<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
						{item.host}
					</span>
				</div>
				{open && <ExpandedDetails item={item} />}
			</button>
		);
	}

	// Modo full (não-compact) — comportamento atual com border colorido,
	// label de severity, ruleId. Usado em outros lugares (replay tab, viewer).
	return /* layout atual */;
}
```

`ExpandedDetails` é um sub-componente extraído (evidence table + suggestion) reusado pelos dois modos.

## 3. Remoção de state detection — escopo completo

### 3.1 Arquivos a deletar

```
app/src/probe/state/reduxTap.ts
app/src/probe/state/zustandTap.ts
app/src/probe/state/angularSignalTap.ts
app/src/probe/state/ngrxTap.ts
app/src/probe/state/__tests__/reduxTap.test.ts            (se existir)
app/src/probe/state/__tests__/zustandTap.test.ts          (se existir)
app/src/probe/state/__tests__/angularSignalTap.test.ts    (se existir)
app/src/probe/state/__tests__/ngrxTap.test.ts             (se existir)
app/src/probe/detectors/stateManagers.ts
app/src/probe/detectors/__tests__/stateManagers.test.ts   (se existir)
app/src/lib/session/state/diff.ts
app/src/lib/session/state/replay.ts
app/src/lib/session/state/__tests__/diff.test.ts          (se existir)
app/src/lib/session/state/__tests__/replay.test.ts        (se existir)
app/src/components/replay/StateInspector.tsx
app/src/components/replay/__tests__/StateInspector.test.tsx
app/src/lib/session/__tests__/recorder.state.test.ts
app/src/lib/session/__tests__/recorder.state.angular.test.ts
```

**Mantém** `app/src/probe/state/angularHttpTap.ts` (e seu test, se existir). Esse arquivo está sob `state/` por organização legacy mas semanticamente é HTTP, não state. Move-lo para outro path é opcional e fora do escopo.

### 3.2 Arquivos a editar

#### `app/src/probe/protocol.ts`
- Remover variant `'probe:state-change'`.
- Remover interface `ProbeStateChangePayload`.

#### `app/src/probe/main.ts`
- Remover imports: `installReduxTap`, `installZustandTap`, `installAngularSignalTap`, `installNgRxTap`.
- Remover chamadas correspondentes no handler de `probe:start-detection`.
- Manter `installAngularHttpTap`.
- Em `buildFingerprint`: remover linha `stateManagers: detectStateManagers()`.
- Remover import de `detectStateManagers`.

#### `app/src/probe/bridge.ts`
- Remover branch que ouve `'probe:state-change'` e relaya como `'stateChange'` para o background.

#### `app/src/lib/session/types.ts`
- Remover: `StoreKind`, `StateSnapshot`, `StateKeyframe`, `StateManagerDetection`.
- `EnvironmentFingerprint`: remover field `stateManagers`.
- `DetectionPhase`: remover fields `stateBaseline?`, `stateKeyframes?` (sessões antigas com esses campos continuam parseáveis — TS aceita propriedades extras em JSON).
- `SessionEvent`: remover variant `{ type: 'state'; ... }`.

#### `app/src/lib/session/fingerprint.ts`
- Remover comparação `sameSet(a.stateManagers, b.stateManagers, ...)`.

#### `app/src/lib/session/__tests__/fingerprint.test.ts`
- Remover testes que verificam `stateManagers` na comparação.
- Atualizar fixtures que constroem `EnvironmentFingerprint` para não incluir `stateManagers`.

#### `app/src/lib/session/recorder.ts`
- Remover método `addStateChange`.
- Remover `stateRuntime`, `stateRuntimeFor`, `StoreRuntime`, `SessionStateRuntime`.
- Remover constantes `DEFAULT_STATE_KEYFRAME_*`, variáveis `stateKeyframeEveryN`/`stateKeyframeEveryT`, métodos `_setStateLimitsForTests`/`_resetStateLimitsForTests`.
- Remover imports: `StoreKind`, `StateKeyframe`, `compressDiff`, `compressSnapshot`, `computeDiff`.
- Em `_resetLimitsForTests`: remover linhas relacionadas a `stateRuntime` e state keyframe limits.
- Em `stopSession`: remover `stateRuntime.delete(id);`.

#### `app/src/lib/session/__tests__/recorder.test.ts` e adjacentes
- Atualizar fixtures de `EnvironmentFingerprint` (remover `stateManagers: []`).
- Remover testes que dependem de StateChangePayload.

#### `app/src/types/messages.ts`
- Remover `'stateChange'` e `'liveStateChange'` do `MessageAction` union.
- Remover field `statePayload?: ProbeStateChangePayload`.
- Remover import `ProbeStateChangePayload`.

#### `app/src/entrypoints/background.ts`
- Remover handler `if (message.action === 'stateChange')` inteiro (broadcast `liveStateChange` + persistência).
- Remover helper `applyLiveStateChange`.
- Remover field `state` de `LiveSnapshot` (e tipo `LiveStateEntry`).
- `getLiveSnapshot` handler retorna `{ ok: true, snapshot: { detection, recommendations } }` (sem `state`).
- `resetLiveSnapshotForNavigation`: só limpa `recommendations` agora.
- `clearLiveSnapshot`: idêntico (já apaga entrada inteira).
- `getOrInitLiveSnapshot`: shape novo sem `state`.

#### `app/src/components/replay/LiveInsightsPanel.tsx`
- Remover import `StateInspector`, `LiveStateSnapshot`.
- Remover seção "Estado ao vivo" inteira.
- Remover reducer actions `'state-change'`, `'reset-state'`.
- Remover field `state` do `PanelState`.
- Reducer `'hydrate'` action: remover `state` do snapshot.
- Listener `chrome.runtime.onMessage`: remover branch para `'liveStateChange'`.

#### `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`
- Remover/atualizar tests que mencionavam "Estado ao vivo" ou "Nenhum store de estado".

#### `app/src/lib/session/viewerTemplate.ts`
- Se renderiza state em algum bloco, remover.

#### Replay page (rotas /replay/:sessionId e /replay/imported-:hash)
- Se há aba "Estado" usando `StateInspector`, remover essa aba.
- Pesquisar com: `grep -rn "StateInspector\|state-tab" app/src/pages app/src/routes.tsx`

#### Backward compat de sessões já exportadas
- Importer ignora `events` com `type === 'state'` silenciosamente (já comportamento default — TS valida na deserialização mas não rejeita propriedades extras).
- `DetectionPhase.stateBaseline`/`stateKeyframes` em sessões antigas: campos extras, ignorados.
- `EnvironmentFingerprint.stateManagers` em sessões antigas: campo extra, ignorado.

### 3.3 Beads de cleanup

- Fechar bead `chrome-extension-debug-buddy-6ue` ("Angular signals com primitives quebram computeDiff (no-fallbacks)") — feature removida.
- Fechar bead `chrome-extension-debug-buddy-4pl` ("liveStateChange broadcast bypassa redação") — feature removida.

## 4. Testes

### 4.1 Unit (mudanças)

- `LiveInsightsPanel.test.tsx`: remover tests de "Estado ao vivo"; adicionar 2 tests de sub-agrupamento:
  - "agrupa instâncias da mesma rule sob um sub-grupo (ruleId × N)"
  - "expandir grupo mostra instâncias compact-mode (sem severity duplicada)"
- `RecommendationRow` precisa de teste pra modo compact (1 test novo).
- `recorder.test.ts`: remover qualquer teste que cubra state changes (já estão em arquivos dedicados que serão deletados).

### 4.2 Manual

- Testar em formio.github.io/angular-demo: drawer Live Insights deve mostrar grupos colapsados de regra. Categoria "Estado ao vivo" deve estar AUSENTE.
- Importar uma sessão antiga (com `events: [{ type: 'state', ... }]` e `stateBaseline`/`stateKeyframes`): viewer deve abrir sem erro, simplesmente não renderizar nada de state.

## 5. Não-objetivos

- **Não** mudar o schema de export de session (continua `schemaVersion: 1`).
- **Não** mover `angularHttpTap.ts` para outro diretório (deixar em `probe/state/` apesar do nome — refactor cosmético adiável).
- **Não** introduzir novos tipos/sub-categorias de regras.
- **Não** persistir estado collapsed/expanded entre sessions.
- **Não** ordenar grupos de ruleId dentro de categoria por contagem (mantém ordem de inserção da primeira instância — newest-first do reducer).
- **Não** adicionar busca/filtro textual nas instâncias.

## 6. Rollback

Mudanças desta phase são local-only (sem schema migration; sem mudança de contrato de export). Revert via `git revert` é trivial e não afeta sessões salvas.

Risco principal: **se o usuário tinha sessões antigas com state events úteis**, perdem a aba de inspeção do replay. Mitigação: viewer template embutido nas sessões já exportadas (tem `viewer.html` standalone) **continua** funcionando se foi exportado em versão anterior — só novas exportações ficam sem state. Isso é aceitável dado o objetivo de simplificação.
