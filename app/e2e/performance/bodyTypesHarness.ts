import { performanceEnvironment } from './environment';
import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import {
	assertInteractionBudgets,
	distribution,
	interact,
	type InteractionSample,
} from './measurements';

export interface BodyTypesFixture {
	name: string;
	body?: string;
	mimeType?: string;
	bodyUnavailableReason?: string;
}

export interface BodyTypesHarness {
	context: BrowserContext;
	page: Page;
	samples: InteractionSample[];
	openResponse: (fixture: BodyTypesFixture, feedbackSelector?: string) => Promise<void>;
}

export const bodyTypesPanel = '[role="tabpanel"][data-state="active"]';
export const bodyTypesPre = `${bodyTypesPanel} pre`;

export async function seedBodyTypes(page: Page, fixtures: BodyTypesFixture[]) {
	await page.evaluate(async (cases) => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('debugger-extension-db', 2);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction('requests', 'readwrite');
			const store = transaction.objectStore('requests');
			store.clear();
			const now = Date.now();
			for (let index = 0; index < 1000; index++) {
				const fixture = cases[index];
				const name = fixture ? fixture.name : `filler-${index}`;
				const body = fixture ? fixture.body : '{"ok":true}';
				const mimeType = fixture ? fixture.mimeType : 'application/json';
				store.put({
					id: `body-types-${name}`,
					data: {
						url: `http://localhost:3100/body-types/${name}`,
						method: 'GET',
						status: 200,
						statusText: 'OK',
						headers: mimeType === undefined ? {} : { 'content-type': mimeType },
						mimeType,
						body,
						bodyUnavailableReason: fixture?.bodyUnavailableReason,
						timestamp: now - index,
						duration: 20,
						type: 'Fetch',
						isWaiting: false,
					},
				});
			}
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		db.close();
	}, fixtures);
	await page.reload();
	await expect(
		page.getByText('1000 requisição(ões) encontrada(s).', { exact: true }),
	).toBeVisible();
}

/** Sem substituir clipboard/Blob/download: usa APIs reais autorizadas pelo browser. */
export async function assertBodyTypesExport(page: Page, body: string, testInfo: TestInfo) {
	await page.bringToFront();
	await page.getByRole('button', { name: 'Copiar body', exact: true }).click();
	await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(body);
	const downloaded = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Baixar body', exact: true }).click();
	const download = await downloaded;
	expect(await download.failure()).toBeNull();
	const stream = await download.createReadStream();
	if (!stream) throw new Error('Download sem stream de bytes');
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	const bytes = Buffer.concat(chunks);
	expect(
		bytes.equals(Buffer.from(body, 'utf8')),
		'download UTF-8 integral, inclusive Unicode',
	).toBe(true);
	const artifact = testInfo.outputPath('body-types-export.json');
	await writeFile(
		artifact,
		JSON.stringify(
			{
				filename: download.suggestedFilename(),
				bytes: bytes.length,
				sha256: createHash('sha256').update(bytes).digest('hex'),
				clipboardCharacters: body.length,
				clipboardExact: true,
				downloadExact: true,
			},
			null,
			2,
		),
	);
	await testInfo.attach('body-types-export', { path: artifact, contentType: 'application/json' });
}

export async function assertBodyTypesPersisted(page: Page, fixture: BodyTypesFixture) {
	const saved = await page.evaluate(async (id) => {
		return new Promise<{ count: number; body?: string; mimeType?: string; reason?: string }>(
			(resolve, reject) => {
				const open = indexedDB.open('debugger-extension-db');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const transaction = db.transaction('requests');
					const store = transaction.objectStore('requests');
					const record = store.get(`body-types-${id}`);
					const count = store.count();
					transaction.onerror = () => {
						db.close();
						reject(transaction.error);
					};
					transaction.oncomplete = () => {
						db.close();
						if (!record.result) {
							reject(new Error(`Captura ${id} ausente`));
							return;
						}
						resolve({
							count: count.result,
							body: record.result.data.body,
							mimeType: record.result.data.mimeType,
							reason: record.result.data.bodyUnavailableReason,
						});
					};
				};
			},
		);
	}, fixture.name);
	expect(saved).toEqual({
		count: 1000,
		body: fixture.body,
		mimeType: fixture.mimeType,
		reason: fixture.bodyUnavailableReason,
	});
}

export async function withBodyTypes(
	testInfo: TestInfo,
	fixtures: BodyTypesFixture[],
	run: (harness: BodyTypesHarness) => Promise<void>,
	entrypoint: 'options.html' | 'sidepanel.html' = 'options.html',
) {
	const context = await launchExtensionContext({
		viewport:
			entrypoint === 'sidepanel.html'
				? { width: 480, height: 1000 }
				: { width: 1440, height: 1000 },
	});
	const errors: string[] = [];
	context.setDefaultTimeout(15_000);
	const samples: InteractionSample[] = [];
	const evidence: Record<string, unknown> = {
		entrypoint,
		environment: performanceEnvironment(context),
		nativeSidePanelHost: false,
		samples,
		errors,
		fixtures: fixtures.map((fixture) => ({
			name: fixture.name,
			characters: fixture.body?.length,
			utf8Bytes: fixture.body === undefined ? undefined : Buffer.byteLength(fixture.body),
			mimeType: fixture.mimeType,
		})),
	};
	await context.tracing.start({ screenshots: true, snapshots: false });
	try {
		const id = await getExtensionId(context);
		const origin = `chrome-extension://${id}`;
		// Chrome não permite grantPermissions para a origem opaca chrome-extension.
		// A permissão vale só neste perfil descartável, sem substituir a API real.
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const page = await context.newPage();
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() !== 'error') return;
			errors.push(message.text());
		});
		await page.goto(`${origin}/${entrypoint}#/command-center`);
		await seedBodyTypes(page, fixtures);
		if (entrypoint === 'sidepanel.html') {
			testInfo.annotations.push({
				type: 'coverage',
				description:
					'Entrypoint sidepanel.html em aba regular de 480px; não exercita o host nativo Chrome Side Panel.',
			});
			await page
				.locator('select')
				.filter({ has: page.locator('option[value="5"]') })
				.selectOption('5');
		}
		await page.bringToFront();
		const cdp = await context.newCDPSession(page);
		await cdp.send('Performance.enable');
		evidence.before = await cdp.send('Performance.getMetrics');
		const openResponse = async (fixture: BodyTypesFixture, feedbackSelector = bodyTypesPre) => {
			await page.locator('tr', { hasText: `/body-types/${fixture.name}` }).click();
			await page.getByRole('tab', { name: 'Overview', exact: true }).click();
			samples.push({
				action: `response-${fixture.name}`,
				ms: await interact(
					page,
					page.getByRole('tab', { name: 'Response', exact: true }),
					feedbackSelector,
				),
			});
		};
		await run({ context, page, samples, openResponse });
		evidence.after = await cdp.send('Performance.getMetrics');
		evidence.dom = await cdp.send('Memory.getDOMCounters');
		evidence.heap = await cdp.send('Runtime.getHeapUsage');
		evidence.distribution = distribution(samples.map((sample) => sample.ms));
		assertInteractionBudgets(samples, false);
		expect(errors).toEqual([]);
		await cdp.detach();
	} finally {
		try {
			const file = testInfo.outputPath('body-types-evidence.json');
			await writeFile(file, JSON.stringify(evidence, null, 2));
			await testInfo.attach('body-types-evidence', { path: file, contentType: 'application/json' });
			await context.tracing.stop({ path: testInfo.outputPath('body-types-first-run-trace.zip') });
		} finally {
			await context.close();
		}
	}
}
