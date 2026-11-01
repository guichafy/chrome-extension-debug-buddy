import { performanceEnvironment } from './environment';
import { expect, test, type Page, type Locator } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

import { interact, distribution, assertInteractionBudgets } from './measurements';

const scenarios = [
	{ count: 1000, bytes: 10 * 1024, live: false },
	{ count: 1000, bytes: 100 * 1024, live: false },
	{ count: 1000, bytes: 1024 * 1024, live: false },
	{ count: 1000, bytes: 5 * 1024 * 1024, live: false },
	{ count: 10000, bytes: 100 * 1024, live: false },
	{ count: 50000, bytes: 100 * 1024, live: false },
	{ count: 10000, bytes: 5 * 1024 * 1024, live: true },
];

for (const scenario of scenarios) {
	test(`Response ${scenario.bytes} bytes / histórico ${scenario.count}${scenario.live ? ' / captura ativa' : ''}`, async ({
		browserName,
	}, testInfo) => {
		const context = await launchExtensionContext();
		const errors: string[] = [];
		const samples: { action: string; ms: number }[] = [];
		let metrics: Record<string, unknown> = {};
		const bodyProcessing: {
			cycle: number;
			parses: number;
			insertions: number;
			domNodes: number;
		}[] = [];
		await context.tracing.start({ screenshots: true, snapshots: false });
		try {
			const extId = await getExtensionId(context);
			const page = await context.newPage();
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('console', (msg) => {
				if (msg.type() === 'error') errors.push(msg.text());
			});
			await page.goto(`chrome-extension://${extId}/options.html#/command-center`);
			const seeded = await page.evaluate(async ({ count, bytes }) => {
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const open = indexedDB.open('debugger-extension-db', 2);
					open.onsuccess = () => resolve(open.result);
					open.onerror = () => reject(open.error);
				});
				const token =
					'{"id":123,"name":"Pessoa de teste","active":true,"score":12.5,"metadata":null}';
				const body = `[${Array(Math.floor((bytes - 2) / (token.length + 1)))
					.fill(token)
					.join(',')}]`;
				await new Promise<void>((resolve, reject) => {
					const now = Date.now();
					const tx = db.transaction('requests', 'readwrite');
					const store = tx.objectStore('requests');
					store.clear();
					for (let i = 0; i < count; i++)
						store.put({
							id: `perf-${i}`,
							data: {
								url: `http://localhost:3100/api/perf/${i}`,
								method: 'GET',
								status: 200,
								statusText: 'OK',
								headers: { 'content-type': 'application/json' },
								mimeType: 'application/json',
								body: i === 0 ? body : '{"ok":true}',
								type: 'Fetch',
								timestamp: now - i,
								duration: 10,
								isWaiting: false,
							},
						});
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
					tx.onabort = () => reject(tx.error);
				});
				db.close();
				return {
					count,
					selectedBodyCharacters: body.length,
					selectedBodyUtf8Bytes: new TextEncoder().encode(body).byteLength,
					mimeType: 'application/json',
				};
			}, scenario);
			await page.reload();
			await page.bringToFront();
			await expect(page.locator('tr', { hasText: '/api/perf/0' })).toBeVisible();
			const cdp = await context.newCDPSession(page);
			await cdp.send('Performance.enable');
			await cdp.send('Profiler.enable');
			await cdp.send('Profiler.start');
			await page.evaluate(() => {
				(window as any).__longTasks = [];
				new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) (window as any).__longTasks.push(entry.duration);
				}).observe({ type: 'longtask' });
			});
			const before = await cdp.send('Performance.getMetrics');
			await page.evaluate(
				(delay) => {
					(window as any).__bodyWork = { parses: 0, insertions: 0 };
					const original = JSON.parse;
					JSON.parse = (value, reviver) => {
						if (typeof value === 'string' && value.length > 9000)
							(window as any).__bodyWork.parses++;
						return original(value, reviver);
					};
					const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
					if (!descriptor?.set) throw new Error('Setter innerHTML indisponível');
					Object.defineProperty(Element.prototype, 'innerHTML', {
						...descriptor,
						set(value) {
							if (this.tagName === 'PRE') (window as any).__bodyWork.insertions++;
							descriptor.set!.call(this, value);
						},
					});
					if (delay > 0)
						document.addEventListener(
							'click',
							() => {
								const until = performance.now() + delay;
								while (performance.now() < until) {
									/* regressão deliberada apenas no teste */
								}
							},
							{ capture: true },
						);
				},
				process.env.PERF_INJECT_REGRESSION === '1' ? 650 : 0,
			);
			let target: Page | undefined;
			if (scenario.live) {
				target = await context.newPage();
				await target.goto('http://localhost:3100/target.html');
				await page.evaluate(async (url) => {
					const tab = (await chrome.tabs.query({})).find((tab) => tab.url === url);
					if (tab?.id === undefined) throw new Error('Aba alvo ausente');
					for (const message of [
						{ action: 'setTargetTab', tabId: tab.id, tabUrl: url, tabTitle: 'Performance' },
						{ action: 'startDebugging', tabId: tab.id },
					]) {
						const result = await chrome.runtime.sendMessage(message);
						if (result.error || result.success === false) throw new Error(JSON.stringify(result));
					}
				}, target.url());
				await target.evaluate(() => {
					(window as any).__trafficCount = 0;
					(window as any).__trafficStop = false;
					(window as any).__traffic = (async () => {
						while (!(window as any).__trafficStop && (window as any).__trafficCount < 500) {
							const response = await fetch(`/api/users?perf=${(window as any).__trafficCount}`, {
								signal: AbortSignal.timeout(5000),
							});
							if (!response.ok) throw new Error(`HTTP ${response.status}`);
							await response.text();
							(window as any).__trafficCount++;
							await new Promise((resolve) => setTimeout(resolve, 50));
						}
					})();
				});
				await page.bringToFront();
			}
			await page.locator('tr', { hasText: '/api/perf/0' }).click();
			for (let cycle = 0; cycle < 5; cycle++) {
				samples.push({
					action: 'response',
					ms: await interact(
						page,
						page.getByRole('tab', { name: 'Response', exact: true }),
						'[role="tabpanel"][data-state="active"] pre',
					),
				});
				const workBefore = await page.evaluate(() => ({ ...(window as any).__bodyWork }));
				// Canal real do background, controle isolado de updates de OUTRA request.
				await context.serviceWorkers()[0].evaluate(async () => {
					for (let i = 0; i < 5; i++)
						await chrome.runtime.sendMessage({
							action: 'requestUpdated',
							requestId: 'perf-1',
							updates: { duration: 20 + i },
						});
				});
				await page.evaluate(
					() =>
						new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
				);
				const workAfter = await page.evaluate(() => ({
					...(window as any).__bodyWork,
					domNodes: document.querySelectorAll('*').length,
				}));
				bodyProcessing.push({
					cycle,
					parses: workAfter.parses - workBefore.parses,
					insertions: workAfter.insertions - workBefore.insertions,
					domNodes: workAfter.domNodes,
				});
				samples.push({
					action: 'menu',
					ms: await interact(
						page,
						page.getByTestId('request-inspector-create-rule'),
						'[role="menu"]',
					),
				});
				samples.push({
					action: 'editor',
					ms: await interact(
						page,
						page.getByTestId('request-inspector-create-rule-mock'),
						'[role="dialog"]',
					),
				});
				await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
				await page.getByRole('tab', { name: 'Overview', exact: true }).click();
			}
			await page.getByRole('button', { name: 'Fechar inspector', exact: true }).click();
			samples.push({
				action: 'paginar',
				ms: await interact(
					page,
					page.getByRole('button', { name: 'Ir para próxima página', exact: true }),
					'input[type="number"][value="2"]',
				),
			});
			await page.getByRole('button', { name: 'Ir para primeira página', exact: true }).click();
			samples.push({
				action: 'ordenar',
				ms: await interact(
					page,
					page.getByRole('button', { name: 'Horário', exact: true }),
					'tbody tr:first-child',
					`/api/perf/${scenario.count - 1}`,
				),
			});
			await page
				.getByPlaceholder('Filtrar por method:, status:, state: ou texto livre')
				.fill('/api/perf/0');
			samples.push({
				action: 'filtrar',
				ms: await interact(page, page.getByRole('option').first(), 'tbody', '/api/perf/0'),
			});
			await expect(page.locator('tbody tr')).toHaveCount(1);
			await page.getByRole('button', { name: /^Remover filtro/ }).click();
			let trafficCount = 0;
			if (target) {
				trafficCount = await target.evaluate(async () => {
					(window as any).__trafficStop = true;
					await (window as any).__traffic;
					return (window as any).__trafficCount;
				});
				expect(trafficCount).toBeGreaterThan(10);
				await page.evaluate(async () => {
					const result = await chrome.runtime.sendMessage({ action: 'stopDebugging' });
					if (!result.success) throw new Error(JSON.stringify(result));
				});
			}
			const after = await cdp.send('Performance.getMetrics');
			const metric = (values: typeof after, name: string) => {
				const value = values.metrics.find((entry) => entry.name === name);
				if (!value) throw new Error(`Métrica CDP ausente: ${name}`);
				return value.value;
			};
			const cpuTaskSeconds = metric(after, 'TaskDuration') - metric(before, 'TaskDuration');
			await cdp.send('HeapProfiler.collectGarbage');
			const dom = await cdp.send('Memory.getDOMCounters');
			const heap = await cdp.send('Runtime.getHeapUsage');
			const longTasks = await page.evaluate<number[]>(() => (window as any).__longTasks);
			await page.getByRole('button', { name: 'Limpar Histórico', exact: true }).click();
			await page
				.getByRole('alertdialog')
				.getByRole('button', { name: 'Limpar histórico', exact: true })
				.click();
			await expect(
				page.getByText('0 requisição(ões) encontrada(s).', { exact: true }),
			).toBeVisible();
			await page.evaluate(
				() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
			);
			await cdp.send('HeapProfiler.collectGarbage');
			const afterClearHeap = await cdp.send('Runtime.getHeapUsage');
			metrics = {
				scenario,
				seeded,
				samples,
				bodyProcessing,
				trafficCount,
				cpuTaskSeconds,
				latency: Object.fromEntries(
					['response', 'menu', 'editor'].map((action) => [
						action,
						distribution(
							samples.filter((sample) => sample.action === action).map((sample) => sample.ms),
						),
					]),
				),
				before,
				after,
				dom,
				heap,
				afterClearHeap,
				longTasks,
				errors,
				environment: performanceEnvironment(context),
			};
			const { profile } = await cdp.send('Profiler.stop');
			await writeFile(testInfo.outputPath('ui.cpuprofile'), JSON.stringify(profile));
			await testInfo.attach('ui.cpuprofile', {
				path: testInfo.outputPath('ui.cpuprofile'),
				contentType: 'application/json',
			});
			await writeFile(testInfo.outputPath('metrics.json'), JSON.stringify(metrics, null, 2));
			await testInfo.attach('metrics.json', {
				path: testInfo.outputPath('metrics.json'),
				contentType: 'application/json',
			});
			console.log(
				JSON.stringify({ scenario, samples, dom, maxLongTask: Math.max(0, ...longTasks) }),
			);
			expect(errors).toEqual([]);
			// Budgets de responsividade; calibrar/documentar a partir das execuções
			// do mesmo Chromium/runner. Sem retries: a primeira falha é preservada.
			assertInteractionBudgets(samples, scenario.live);
			for (const work of bodyProcessing) {
				expect(work.parses, 'JSON inalterado não deve ser reprocessado').toBe(0);
				expect(work.insertions, 'body não deve recriar HTML por update alheio').toBe(0);
				expect(work.domNodes, 'DOM durante Response').toBeLessThan(6000);
			}
			expect(Math.max(0, ...longTasks), 'maior bloqueio da UI').toBeLessThan(
				scenario.live ? 500 : 250,
			);
			expect(
				longTasks.reduce((sum, ms) => sum + Math.max(0, ms - 50), 0),
				'bloqueio acumulado',
			).toBeLessThan(scenario.live ? 2000 : 500);
			expect(dom.nodes, 'DOM após GC e fechamento do Response').toBeLessThan(12000);
			expect(heap.usedSize, 'heap UI após GC').toBeLessThan(256 * 1024 * 1024);
			expect(afterClearHeap.usedSize, 'heap UI após limpar histórico').toBeLessThan(
				80 * 1024 * 1024,
			);
			expect(cpuTaskSeconds, 'tempo de tarefas no renderer UI').toBeLessThan(
				scenario.live ? 12 : 4,
			);
		} finally {
			await testInfo.attach('partial-metrics.json', {
				body: JSON.stringify({ metrics, samples, errors }, null, 2),
				contentType: 'application/json',
			});
			await context.tracing.stop({ path: testInfo.outputPath('trace.zip') });
			await context.close();
		}
	});
}
