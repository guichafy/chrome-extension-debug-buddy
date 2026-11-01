import { expect, test } from '@playwright/test';
import {
	assertBodyTypesExport,
	assertBodyTypesPersisted,
	bodyTypesPanel,
	bodyTypesPre,
	withBodyTypes,
	type BodyTypesFixture,
	type BodyTypesHarness,
} from './bodyTypesHarness';

const BLOCK_SIZE = 16_384;
const LARGE_SIZE = 1024 * 1024;
const unicodeLine =
	'Debug Buddy: integridade do texto completo, com palavras em português, ação, café, 東京 e emoji 😀.\n';
const plain: BodyTypesFixture = {
	name: 'plain-unicode',
	mimeType: 'text/plain; charset=utf-8',
	body: unicodeLine.repeat(Math.ceil(LARGE_SIZE / unicodeLine.length)),
};
const largeHtml: BodyTypesFixture = {
	name: 'html-large',
	mimeType: 'text/html',
	body: `<!doctype html><html><body>${'<p>Conteúdo HTML preservado em blocos.</p>'.repeat(28_000)}</body></html>`,
};
const smallHtml: BodyTypesFixture = {
	name: 'html-sandbox',
	mimeType: 'text/html',
	body: '<!doctype html><html><body><h1>Prévia isolada</h1><p>Sem permissões de script.</p></body></html>',
};
const invalidJson: BodyTypesFixture = {
	name: 'invalid-json',
	mimeType: 'application/json',
	body: '{"mensagem":"ação 😀", "ausente": }',
};
const unavailable: BodyTypesFixture = {
	name: 'body-unavailable',
	mimeType: 'application/octet-stream',
	bodyUnavailableReason: 'Body indisponível: resposta de stream sem buffer capturável.',
};
const image: BodyTypesFixture = {
	name: 'image-png',
	mimeType: 'image/png',
	body: Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMwnvn/PwAFmQLLFOU//QAAAABJRU5ErkJggg==',
		'base64',
	).toString('latin1'),
};
const sparseJson = JSON.stringify({
	value: 'x'.repeat(LARGE_SIZE - JSON.stringify({ value: '' }).length),
});
const denseJsonBase = `[${Array(Math.floor((LARGE_SIZE - 2) / 2))
	.fill('0')
	.join(',')}]`;
const denseJson = denseJsonBase.padEnd(LARGE_SIZE, ' ');
const noMimeJson: BodyTypesFixture = { name: 'large-json-no-mime', body: sparseJson };

async function assertPagedBody(harness: BodyTypesHarness, fixture: BodyTypesFixture) {
	const { page } = harness;
	if (fixture.body === undefined) throw new Error('Fixture de paginação sem body');
	const pre = page.locator(bodyTypesPre);
	await expect(
		page.getByText(/Body grande: visualização em blocos, sem formatação ou validação/),
	).toBeVisible();
	expect(await pre.textContent()).toBe(fixture.body.slice(0, BLOCK_SIZE));
	expect(await pre.locator('*').count(), 'bloco não expande tokens em spans').toBe(0);
	await expect(
		page.getByText(`Bloco 1 de ${Math.ceil(fixture.body.length / BLOCK_SIZE)}`, { exact: true }),
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Bloco anterior do body' })).toBeDisabled();
	await page.getByRole('button', { name: 'Próximo bloco do body' }).click();
	expect(await pre.textContent()).toBe(fixture.body.slice(BLOCK_SIZE, BLOCK_SIZE * 2));
	await page.getByRole('button', { name: 'Bloco anterior do body' }).click();
	expect(await pre.textContent()).toBe(fixture.body.slice(0, BLOCK_SIZE));
}

for (const fixture of [plain, largeHtml, noMimeJson]) {
	test(`BodyViewer real: ${fixture.name}, blocos e exportação integral / 1k`, async ({
		browserName,
	}, testInfo) => {
		await withBodyTypes(testInfo, [fixture], async (harness) => {
			for (let cycle = 0; cycle < 3; cycle++) {
				await harness.openResponse(fixture);
				await assertPagedBody(harness, fixture);
			}
			await expect(harness.page.locator(`${bodyTypesPanel} iframe`)).toHaveCount(0);
			if (fixture === largeHtml) {
				await expect(
					harness.page.getByRole('button', { name: 'Preview', exact: true }),
				).toHaveCount(0);
				await expect(harness.page.getByRole('button', { name: 'Source', exact: true })).toHaveCount(
					0,
				);
			}
			if (fixture === noMimeJson) {
				await harness.page.getByRole('tab', { name: 'Overview', exact: true }).click();
				await expect(harness.page.getByText('Sem Content-Type', { exact: true })).toBeVisible();
				await harness.openResponse(fixture);
			}
			await assertBodyTypesExport(harness.page, fixture.body!, testInfo);
			await assertBodyTypesPersisted(harness.page, fixture);
		});
	});
}

test('BodyViewer real: HTML pequeno em iframe sandbox / 1k', async ({ browserName }, testInfo) => {
	await withBodyTypes(testInfo, [smallHtml], async (harness) => {
		const { page } = harness;
		for (let cycle = 0; cycle < 3; cycle++) {
			await harness.openResponse(smallHtml, `${bodyTypesPanel} iframe[title="HTML preview"]`);
			const frame = page.locator('iframe[title="HTML preview"]');
			await expect(frame).toHaveAttribute('sandbox', '');
			await expect(frame).toHaveAttribute('srcdoc', smallHtml.body!);
			await expect(
				page
					.frameLocator('iframe[title="HTML preview"]')
					.getByRole('heading', { name: 'Prévia isolada' }),
			).toBeVisible();
			await page.getByRole('button', { name: 'Source', exact: true }).click();
			await expect(frame).toHaveCount(0);
			expect(await page.locator(bodyTypesPre).textContent()).toBe(smallHtml.body);
			await page.getByRole('button', { name: 'Preview', exact: true }).click();
		}
		await assertBodyTypesExport(page, smallHtml.body!, testInfo);
		await assertBodyTypesPersisted(page, smallHtml);
	});
});

test('BodyViewer real: JSON inválido mantém erro e texto original / 1k', async ({
	browserName,
}, testInfo) => {
	await withBodyTypes(testInfo, [invalidJson], async (harness) => {
		for (let cycle = 0; cycle < 3; cycle++) {
			await harness.openResponse(invalidJson, `${bodyTypesPanel} [role="alert"]`);
			await expect(harness.page.getByRole('alert')).toContainText('JSON inválido:');
			expect(await harness.page.locator(bodyTypesPre).textContent()).toBe(invalidJson.body);
		}
		await assertBodyTypesExport(harness.page, invalidJson.body!, testInfo);
		await assertBodyTypesPersisted(harness.page, invalidJson);
	});
});

test('BodyViewer real: motivo de body indisponível permanece visível / 1k', async ({
	browserName,
}, testInfo) => {
	await withBodyTypes(testInfo, [unavailable], async (harness) => {
		for (let cycle = 0; cycle < 3; cycle++) {
			await harness.openResponse(unavailable, `${bodyTypesPanel} .p-4`);
			await expect(
				harness.page
					.locator(bodyTypesPanel)
					.getByText(unavailable.bodyUnavailableReason!, { exact: true }),
			).toBeVisible();
			await expect(harness.page.locator(bodyTypesPre)).toHaveCount(0);
			await expect(
				harness.page.getByRole('button', { name: 'Copiar body', exact: true }),
			).toHaveCount(0);
			await expect(
				harness.page.getByRole('button', { name: 'Baixar body', exact: true }),
			).toHaveCount(0);
		}
		await assertBodyTypesPersisted(harness.page, unavailable);
	});
});

test('BodyViewer real: imagem PNG decodificada pelo browser / 1k', async ({
	browserName,
}, testInfo) => {
	await withBodyTypes(testInfo, [image], async (harness) => {
		for (let cycle = 0; cycle < 3; cycle++) {
			await harness.openResponse(image, `${bodyTypesPanel} img[alt="Response body preview"]`);
			const preview = harness.page.getByRole('img', { name: 'Response body preview' });
			await expect(preview).toBeVisible();
			await expect
				.poll(() =>
					preview.evaluate((node) => ({
						width: (node as HTMLImageElement).naturalWidth,
						height: (node as HTMLImageElement).naturalHeight,
					})),
				)
				.toEqual({ width: 1, height: 1 });
		}
		await assertBodyTypesPersisted(harness.page, image);
	});
});

test('BodyViewer real: JSON esparso e denso de exatamente 1MiB / 1k', async ({
	browserName,
}, testInfo) => {
	const sparse: BodyTypesFixture = {
		name: 'json-sparse',
		mimeType: 'application/json',
		body: sparseJson,
	};
	const dense: BodyTypesFixture = {
		name: 'json-dense',
		mimeType: 'application/json',
		body: denseJson,
	};
	expect(Buffer.byteLength(sparseJson)).toBe(LARGE_SIZE);
	expect(Buffer.byteLength(denseJson)).toBe(LARGE_SIZE);
	expect(JSON.parse(sparseJson)).toHaveProperty('value');
	expect(Array.isArray(JSON.parse(denseJson))).toBe(true);
	await withBodyTypes(testInfo, [sparse, dense], async (harness) => {
		for (let cycle = 0; cycle < 3; cycle++) {
			for (const fixture of [sparse, dense]) {
				await harness.openResponse(fixture);
				await assertPagedBody(harness, fixture);
			}
		}
		for (const fixture of [sparse, dense]) await assertBodyTypesPersisted(harness.page, fixture);
	});
});

test('BodyViewer real: fechar, trocar rota e recarregar preservam captura / 1k', async ({
	browserName,
}, testInfo) => {
	await withBodyTypes(testInfo, [plain], async (harness) => {
		const { page } = harness;
		await harness.openResponse(plain);
		await page.getByRole('button', { name: 'Próximo bloco do body' }).click();
		await page.getByRole('button', { name: 'Fechar inspector', exact: true }).click();
		await expect(page.getByTestId('request-inspector-header')).toHaveCount(0);
		await harness.openResponse(plain);
		await assertPagedBody(harness, plain);
		await page.getByRole('link', { name: 'Rules Lab', exact: true }).click();
		await expect(page).toHaveURL(/#\/rules-lab$/);
		await expect(page.getByTestId('request-inspector-header')).toHaveCount(0);
		await page.getByRole('link', { name: 'Command Center', exact: true }).click();
		await harness.openResponse(plain);
		await assertPagedBody(harness, plain);
		await page.reload();
		await expect(page.getByTestId('request-inspector-header')).toHaveCount(0);
		await harness.openResponse(plain);
		await assertPagedBody(harness, plain);
		await assertBodyTypesPersisted(page, plain);
		await assertBodyTypesExport(page, plain.body!, testInfo);
	});
});

test('BodyViewer real: entrypoint sidepanel.html em aba de 480px, sem host nativo / 1k', async ({
	browserName,
}, testInfo) => {
	await withBodyTypes(
		testInfo,
		[plain],
		async (harness) => {
			for (let cycle = 0; cycle < 3; cycle++) {
				await harness.openResponse(plain);
				await assertPagedBody(harness, plain);
				await harness.page.getByRole('button', { name: 'Fechar inspector', exact: true }).click();
			}
			await assertBodyTypesPersisted(harness.page, plain);
		},
		'sidepanel.html',
	);
});
