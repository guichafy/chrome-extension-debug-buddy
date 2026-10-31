// Gera as screenshots do README (README.md / README.pt-BR.md) a partir da
// extensão real em `dist/`, interceptando a loja fictícia de
// `fixtures/index.html`. Rodar com `npm run docs:screenshots`.

import { expect, type Page, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rule } from '../../src/types/rules';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(__dirname, '../../../docs/images');
const STORE_URL = 'http://localhost:3200/index.html';

const created = new Date(2026, 9, 1, 12).getTime();

function rule(overrides: Partial<Rule> & Pick<Rule, 'id' | 'name' | 'stage'>): Rule {
	return {
		enabled: true,
		matchers: [],
		actions: [],
		createdAt: created,
		updatedAt: created,
		...overrides,
	};
}

const url = (pattern: string) => ({ type: 'url' as const, enabled: true, pattern, isRegex: false });

const RULES: Rule[] = [
	rule({
		id: 'docs-auth',
		name: 'Injeta token de auth no perfil',
		stage: 'request',
		matchers: [url('/api/profile')],
		actions: [
			{
				type: 'requestModify',
				enabled: true,
				addHeaders: { Authorization: 'Bearer demo-token', 'X-Debug-Buddy': 'readme' },
			},
		],
	}),
	rule({
		id: 'docs-cart',
		name: 'Mock de carrinho vazio',
		stage: 'request',
		matchers: [url('/api/cart')],
		actions: [
			{
				type: 'mock',
				enabled: true,
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: '{"items":[],"total":0}',
			},
		],
	}),
	rule({
		id: 'docs-orders',
		name: 'Latência de 1,2s em pedidos',
		stage: 'request',
		matchers: [url('/api/orders')],
		actions: [{ type: 'requestDelay', enabled: true, timeMs: 1200 }],
	}),
	rule({
		id: 'docs-checkout',
		name: 'Derruba o checkout',
		stage: 'request',
		matchers: [url('/api/checkout'), { type: 'method', enabled: true, method: 'POST' }],
		actions: [{ type: 'block', enabled: true, errorReason: 'ConnectionRefused' }],
	}),
	rule({
		id: 'docs-products',
		name: 'Zera o preço do primeiro produto',
		stage: 'response',
		matchers: [url('/api/products')],
		actions: [
			{
				type: 'transform',
				enabled: true,
				mode: 'declarative',
				operations: [{ id: 'op-1', type: 'replace', path: '$.products[0].price', value: '0' }],
			},
		],
	}),
	rule({
		id: 'docs-inventory',
		name: 'Pausa consulta de estoque',
		stage: 'request',
		matchers: [url('/api/inventory')],
		actions: [{ type: 'breakpoint', enabled: true, description: 'Inspecionar antes do envio' }],
	}),
	rule({
		id: 'docs-offline',
		name: 'Simula API fora do ar',
		stage: 'response',
		enabled: false,
		matchers: [url('/api/')],
		actions: [
			{
				type: 'mock',
				enabled: true,
				status: 503,
				headers: { 'Content-Type': 'application/json' },
				body: '{"error":"maintenance"}',
			},
		],
	}),
];

async function shot(page: Page, name: string): Promise<void> {
	// Deixa animações/toasts assentarem antes de capturar.
	await page.waitForTimeout(600);
	await page.screenshot({ path: path.join(IMAGES_DIR, `${name}.png`) });
}

test('screenshots do README', async () => {
	const context = await launchExtensionContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
	});
	try {
		const extId = await getExtensionId(context);
		const ext = (hash: string) => `chrome-extension://${extId}/options.html#${hash}`;
		await seedRules(context, RULES);

		const store = await context.newPage();
		await store.goto(STORE_URL);

		const ui = await context.newPage();
		await ui.goto(ext('/command-center'));
		await ui.getByRole('button', { name: /selecionar aba/i }).click();
		await ui.getByRole('option', { name: /acme store/i }).click();
		await ui.getByRole('button', { name: /iniciar análise/i }).click();
		await expect(ui.getByRole('button', { name: /parar análise/i })).toBeVisible();

		// A gravação de sessão (Session Replay) liga sozinha junto com a
		// interceptação — só é desligada no fim, antes de abrir o replay.
		await expect(ui.getByRole('switch', { name: 'Gravação' })).toBeChecked();

		await store.bringToFront();
		await store.reload();
		await store.evaluate(() =>
			(window as unknown as { loadStore: () => Promise<void> }).loadStore(),
		);
		await store.mouse.move(300, 160);
		await store.mouse.click(300, 160);
		await store.mouse.wheel(0, 200);

		// 1. Command Center com tráfego misto.
		await ui.bringToFront();
		await ui.goto(ext('/command-center'));
		await expect
			.poll(async () => ui.locator('tr', { hasText: '/api/' }).count(), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(7);
		await shot(ui, 'command-center');

		// 2. Inspector de uma request mockada (Overview).
		await ui.locator('tr', { hasText: '/api/cart' }).first().click();
		await shot(ui, 'request-inspector');
		await ui.getByRole('button', { name: 'Fechar inspector' }).click();

		// 3. Breakpoint pendente: dock com ações e atalhos.
		const pending = store.evaluate(() =>
			(window as unknown as { checkInventory: () => Promise<unknown> }).checkInventory(),
		);
		const approve = ui.getByTestId('pending-action-dock-approve-next');
		await expect(approve).toBeVisible({ timeout: 10_000 });
		await shot(ui, 'pending-breakpoint');
		await approve.click();
		await pending;

		// 4. Rules Lab.
		await ui.goto(ext('/rules-lab'));
		await expect(ui.getByTestId('rule-row-docs-auth')).toBeVisible();
		await shot(ui, 'rules-lab');

		// 5. Editor de regra no passo "Ação".
		await ui
			.getByTestId('rule-row-docs-auth')
			.getByRole('button', { name: 'Editar regra' })
			.click();
		await ui.getByRole('button', { name: /próximo/i }).click();
		await ui.getByRole('button', { name: /próximo/i }).click();
		await ui.getByRole('tab', { name: 'Headers' }).click();
		await shot(ui, 'rule-editor');
		await ui.getByRole('button', { name: 'Cancelar' }).click();

		// 6. Sessões + Replay: encerra a gravação e abre a sessão gravada.
		await ui.getByRole('switch', { name: 'Gravação' }).click();
		await expect(ui.getByRole('switch', { name: 'Gravação' })).not.toBeChecked();
		await ui.goto(ext('/sessions'));
		const sessionLink = ui.getByRole('link', { name: /localhost:3200/ }).first();
		await expect(sessionLink).toBeVisible();

		await sessionLink.click();
		await ui.waitForTimeout(2000);
		// Leva o player pro fim da gravação (estado final da página).
		await ui.mouse.click(1045, 587);
		await ui.waitForTimeout(1000);
		await shot(ui, 'session-replay');
	} finally {
		await context.close();
	}
});
