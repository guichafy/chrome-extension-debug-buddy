import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureEvidence } from '../helpers/evidence';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

// Mesmo padrão do global-setup: o loader ESM do Playwright não aceita import
// de JSON sem atributo, então a versão é lida do package.json real.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../evidence');
const { version } = JSON.parse(
	readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
) as { version: string };

// Issue #6: o rodapé da sidebar mostra a versão do package.json no mesmo
// menu-item do link do repositório e do copyright. O sidebar desta base usa
// `data-sidebar="footer"` / `data-sidebar="menu-item"` (não `data-slot`).
const REPO_URL = 'https://github.com/guichafy/chrome-extension-debug-buddy';
const CONTRIBUTE_CTA = 'GitHub';
const EXPECTED_YEAR = '© 2026';

function repoFooterItem(page: Page) {
	return page
		.locator('[data-sidebar="footer"] [data-sidebar="menu-item"]')
		.filter({ has: page.getByRole('link', { name: CONTRIBUTE_CTA }) });
}

const EXPECTED_VERSION = `Versão ${version}`;

test('options.html mostra a versão no rodapé da sidebar (desktop)', async () => {
	const context = await launchExtensionContext({
		viewport: { width: 1280, height: 800 },
	});
	try {
		const extId = await getExtensionId(context);
		const page = await context.newPage();
		await page.goto(`chrome-extension://${extId}/options.html`);

		const item = repoFooterItem(page);
		await expect(item).toBeVisible();
		await expect(item.getByRole('link', { name: CONTRIBUTE_CTA })).toHaveAttribute(
			'href',
			REPO_URL,
		);
		await expect(item).toContainText(EXPECTED_VERSION);
		await expect(item).toContainText(EXPECTED_YEAR);
		await expect(item).not.toContainText('Guilherme Chafy');
		await expect(item).not.toContainText('direitos reservados');

		await captureEvidence(page, 'sidebar-version-options-desktop');
	} finally {
		await context.close();
	}
});

test('sidepanel.html mostra a versão no rodapé da sidebar (desktop)', async () => {
	const context = await launchExtensionContext({
		viewport: { width: 1280, height: 800 },
	});
	try {
		const extId = await getExtensionId(context);
		const page = await context.newPage();
		await page.goto(`chrome-extension://${extId}/sidepanel.html`);

		const item = repoFooterItem(page);
		await expect(item).toBeVisible();
		await expect(item).toContainText(EXPECTED_VERSION);

		await captureEvidence(page, 'sidebar-version-sidepanel-desktop');
	} finally {
		await context.close();
	}
});

// Viewport estreito (< 768px): a sidebar vira offcanvas num Sheet e precisa
// ser aberta pelo trigger do header antes de ler o rodapé.
test('options.html mostra a versão no rodapé da sidebar (viewport estreito)', async () => {
	const context = await launchExtensionContext({
		viewport: { width: 500, height: 800 },
	});
	try {
		const extId = await getExtensionId(context);
		const page = await context.newPage();
		await page.goto(`chrome-extension://${extId}/options.html`);

		await expect(repoFooterItem(page)).not.toBeVisible();
		await page.locator('[data-sidebar="trigger"]').click();

		const item = repoFooterItem(page);
		await expect(item).toBeVisible();
		await expect(item).toBeInViewport();
		await expect(item.getByRole('link', { name: CONTRIBUTE_CTA })).toHaveAttribute(
			'href',
			REPO_URL,
		);
		await expect(item).toContainText(EXPECTED_VERSION);
		await expect(item).toContainText(EXPECTED_YEAR);
		await expect(item).not.toContainText('Guilherme Chafy');
		await expect(item).not.toContainText('direitos reservados');

		// O drawer offcanvas entra por transição: congelamos as animações no
		// screenshot local (o helper compartilhado não aceita opções) e guardamos
		// também o recorte do menu-item como evidência direta do rodapé aberto.
		await page.screenshot({
			path: path.join(EVIDENCE_DIR, 'sidebar-version-options-narrow.png'),
			animations: 'disabled',
		});
		await item.screenshot({
			path: path.join(EVIDENCE_DIR, 'sidebar-version-options-narrow-footer.png'),
			animations: 'disabled',
		});
	} finally {
		await context.close();
	}
});
