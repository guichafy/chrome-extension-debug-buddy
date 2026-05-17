// Phase 8: golden paths dual-stage. Cada test sobe contexto isolado, semeia
// uma regra (ou par de regras) específica de stage='request'/'response',
// liga a interceptação na aba alvo e dispara um fetch via `window.runFetch`
// (helper exposto pelo target.html). Cobre os caminhos novos do schema
// (requestBlock/requestModify/requestMock/requestBreakpoint + chain
// request+response).

import { expect, request as apiRequest, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { attachDebuggerToTarget, goToCommandCenter } from '../helpers/debugger';
import { captureEvidence } from '../helpers/evidence';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

interface FetchResult {
	ok: boolean;
	status: number;
	body: string | null;
	error?: string;
}

async function runFetch(
	page: import('@playwright/test').Page,
	url: string,
	opts?: RequestInit,
): Promise<FetchResult> {
	return (await page.evaluate(
		async ({ url: u, opts: o }) => {
			const w = window as unknown as {
				runFetch: (url: string, opts?: RequestInit) => Promise<FetchResult>;
			};
			return w.runFetch(u, o);
		},
		{ url, opts },
	)) as FetchResult;
}

const now = () => Date.now();

function baseRule(overrides: Partial<Rule>): Rule {
	const created = now();
	return {
		id: 'e2e-dual-stage',
		name: 'rule',
		enabled: true,
		stage: 'response',
		matchers: [],
		actions: [],
		createdAt: created,
		updatedAt: created,
		...overrides,
	};
}

test('Phase 8 — requestBlock: regra de Request stage falha a requisição', async () => {
	const context = await launchExtensionContext();
	try {
		const extId = await getExtensionId(context);

		const rule = baseRule({
			id: 'e2e-request-block',
			name: 'Block /api/users',
			stage: 'request',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false }],
			actions: [{ type: 'block', enabled: true, errorReason: 'Failed' }],
		});
		await seedRules(context, [rule]);

		const targetPage = await context.newPage();
		await targetPage.goto('http://localhost:3100/target.html');

		const optionsPage = await attachDebuggerToTarget(context, extId, targetPage);
		await captureEvidence(optionsPage, 'phase8-block-attached');

		// Reload p/ disparar /api/users automático com debugger ativo.
		await targetPage.reload();

		// O fetch automático no target.html falha — texto começa com "ERROR:".
		await expect(targetPage.locator('#users-data')).toContainText(/ERROR:/);

		await goToCommandCenter(optionsPage, extId);
		await expect
			.poll(async () => optionsPage.locator('tr', { hasText: '/api/users' }).count(), {
				timeout: 8000,
			})
			.toBeGreaterThan(0);
		await captureEvidence(optionsPage, 'phase8-block-history');
	} finally {
		await context.close();
	}
});

test('Phase 8 — requestModify: regra adiciona header e ele chega no servidor', async () => {
	const context = await launchExtensionContext();
	try {
		const extId = await getExtensionId(context);

		const rule = baseRule({
			id: 'e2e-request-modify',
			name: 'Inject X-Injected header',
			stage: 'request',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/echo', isRegex: false }],
			actions: [
				{
					type: 'requestModify',
					enabled: true,
					addHeaders: { 'X-Injected': 'phase-8' },
				},
			],
		});
		await seedRules(context, [rule]);

		const targetPage = await context.newPage();
		await targetPage.goto('http://localhost:3100/target.html');
		await attachDebuggerToTarget(context, extId, targetPage);

		const result = await runFetch(targetPage, '/api/echo');
		expect(result.ok).toBe(true);
		expect(result.status).toBe(200);
		const parsed = JSON.parse(result.body ?? '{}') as {
			headers: Record<string, string>;
		};
		expect(parsed.headers['x-injected']).toBe('phase-8');
	} finally {
		await context.close();
	}
});

test('Phase 8 — requestMock: regra responde sem bater no servidor', async () => {
	const context = await launchExtensionContext();
	// API request fora do contexto debugged — vai DIRETO ao servidor sem
	// passar pelo Fetch.requestPaused, então é fonte confiável de verdade
	// sobre quantos hits o counter recebeu.
	const api = await apiRequest.newContext({ baseURL: 'http://localhost:3100' });
	try {
		const extId = await getExtensionId(context);

		// Pattern com `$` em regex pra evitar casar `/api/counter/value` e
		// `/api/counter/reset` que o test usa para sondar o estado real.
		const rule = baseRule({
			id: 'e2e-request-mock',
			name: 'Mock counter at request stage',
			stage: 'request',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/counter$', isRegex: true }],
			actions: [
				{
					type: 'mock',
					enabled: true,
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					body: '{"count":-1,"mocked":true}',
				},
			],
		});
		await seedRules(context, [rule]);

		// Reset counter via API fora do contexto debugged.
		await api.post('/api/counter/reset');
		const baselineResp = await api.get('/api/counter/value');
		const baseline = (await baselineResp.json()) as { count: number };

		const targetPage = await context.newPage();
		await targetPage.goto('http://localhost:3100/target.html');
		await attachDebuggerToTarget(context, extId, targetPage);

		const mocked = await runFetch(targetPage, '/api/counter');
		expect(mocked.status).toBe(200);
		const mockedBody = JSON.parse(mocked.body ?? '{}') as { count: number; mocked: boolean };
		expect(mockedBody.mocked).toBe(true);
		expect(mockedBody.count).toBe(-1);

		// Counter no servidor NÃO incrementa — request foi curto-circuitada.
		const afterResp = await api.get('/api/counter/value');
		const after = (await afterResp.json()) as { count: number };
		expect(after.count).toBe(baseline.count);
	} finally {
		await api.dispose();
		await context.close();
	}
});

test('Phase 8 — requestBreakpoint: pausa request, UI aprova e libera', async () => {
	const context = await launchExtensionContext();
	try {
		const extId = await getExtensionId(context);

		const rule = baseRule({
			id: 'e2e-request-breakpoint',
			name: 'Breakpoint on /api/echo',
			stage: 'request',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/echo', isRegex: false }],
			actions: [{ type: 'breakpoint', enabled: true, description: 'Pausa antes do envio' }],
		});
		await seedRules(context, [rule]);

		const targetPage = await context.newPage();
		await targetPage.goto('http://localhost:3100/target.html');
		const optionsPage = await attachDebuggerToTarget(context, extId, targetPage);

		// Dispara fetch SEM await — fica pendurado até o usuário aprovar.
		const fetchPromise = targetPage
			.evaluate(async () => {
				const w = window as unknown as {
					runFetch: (url: string) => Promise<FetchResult>;
				};
				return w.runFetch('/api/echo');
			})
			.catch((err) => ({ ok: false, status: 0, body: null, error: String(err) }));

		// UI: command-center mostra o PendingActionDock quando há interceptação
		// na fila. Navega e usa o botão "Aprovar" do dock (testid estável).
		await optionsPage.goto(`chrome-extension://${extId}/options.html#/command-center`);
		await optionsPage.reload();

		const approveBtn = optionsPage.getByTestId('pending-action-dock-approve-next');
		await expect(approveBtn).toBeVisible({ timeout: 8000 });
		await captureEvidence(optionsPage, 'phase8-breakpoint-pending');
		await approveBtn.click();

		const result = (await fetchPromise) as FetchResult;
		expect(result.status).toBe(200);
	} finally {
		await context.close();
	}
});

test('Phase 8 — chain: request injeta header E response troca status para 503', async () => {
	const context = await launchExtensionContext();
	try {
		const extId = await getExtensionId(context);

		const requestRule = baseRule({
			id: 'e2e-chain-request',
			name: 'Inject X-Injected',
			stage: 'request',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/chain', isRegex: false }],
			actions: [
				{
					type: 'requestModify',
					enabled: true,
					addHeaders: { 'X-Injected': 'chain' },
				},
			],
		});
		const responseRule = baseRule({
			id: 'e2e-chain-response',
			name: 'Force 503 on /api/chain',
			stage: 'response',
			matchers: [{ type: 'url', enabled: true, pattern: '/api/chain', isRegex: false }],
			actions: [
				{
					type: 'mock',
					enabled: true,
					status: 503,
					headers: { 'Content-Type': 'application/json' },
					body: '{"forced":true}',
				},
			],
		});
		await seedRules(context, [requestRule, responseRule]);

		const targetPage = await context.newPage();
		await targetPage.goto('http://localhost:3100/target.html');
		await attachDebuggerToTarget(context, extId, targetPage);

		const result = await runFetch(targetPage, '/api/chain');
		// Response stage trocou pra 503 com body forçado — não importa o que o
		// servidor real respondeu (mas o servidor recebeu a request modificada,
		// porque o mock está no Response stage e não no Request stage).
		expect(result.status).toBe(503);
		const body = JSON.parse(result.body ?? '{}') as { forced?: boolean };
		expect(body.forced).toBe(true);
	} finally {
		await context.close();
	}
});
