// Gera os assets da listagem na Chrome Web Store em `docs/store/` a partir das
// screenshots reais de `docs/images/` (produzidas por screenshots.spec.ts, que
// roda antes — mesmo worker, ordem alfabética). Rodar com
// `npm run docs:screenshots`.
//
// Requisitos da loja (developer.chrome.com/docs/webstore/images):
// - ícone 128x128 com arte de 96x96 e 16px de margem transparente;
// - screenshots 1280x800, cantos retos, sem padding (até 5, localizáveis);
// - small promo tile 440x280 e marquee 1400x560 (não localizáveis).
// Screenshots e tiles saem em JPEG para não carregar canal alfa.

import { type Browser, chromium, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const IMAGES_DIR = path.join(ROOT, 'docs/images');
const STORE_DIR = path.join(ROOT, 'docs/store');
const ICON = path.join(ROOT, 'app/images/icon_128px.png');

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const BG = 'radial-gradient(120% 120% at 0% 0%, #2e1065 0%, #18181b 55%, #09090b 100%)';
const ACCENT = '#a78bfa';

type Locale = 'en' | 'pt_BR';

interface Shot {
	image: string;
	title: Record<Locale, string>;
	subtitle: Record<Locale, string>;
}

const SHOTS: Shot[] = [
	{
		image: 'command-center',
		title: {
			en: 'See and control every request',
			pt_BR: 'Veja e controle cada requisição',
		},
		subtitle: {
			en: 'Mocked, delayed, blocked and rewritten calls side by side with real traffic.',
			pt_BR: 'Chamadas mockadas, atrasadas, bloqueadas e reescritas ao lado do tráfego real.',
		},
	},
	{
		image: 'rules-lab',
		title: {
			en: 'Break your API on purpose',
			pt_BR: 'Quebre sua API de propósito',
		},
		subtitle: {
			en: 'Mock, block, delay or transform responses — no backend changes.',
			pt_BR: 'Mock, bloqueio, atraso ou transformação de respostas — sem mexer no backend.',
		},
	},
	{
		image: 'pending-breakpoint',
		title: {
			en: 'Pause a request and decide',
			pt_BR: 'Pause uma requisição e decida',
		},
		subtitle: {
			en: 'Approve, edit status, headers and body, or turn it into a mock.',
			pt_BR: 'Aprove, edite status, headers e body, ou transforme em mock.',
		},
	},
	{
		image: 'rule-editor',
		title: {
			en: 'Chain actions per stage',
			pt_BR: 'Encadeie ações por stage',
		},
		subtitle: {
			en: 'Rewrite the request before it leaves, or the response after the server replies.',
			pt_BR: 'Reescreva a request antes do envio ou a response depois que o servidor responde.',
		},
	},
	{
		image: 'session-replay',
		title: {
			en: 'Replay what happened',
			pt_BR: 'Reveja o que aconteceu',
		},
		subtitle: {
			en: 'Session replay with the network and console timeline, stored locally.',
			pt_BR: 'Replay da sessão com timeline de rede e console, salvo localmente.',
		},
	},
];

async function dataUri(file: string): Promise<string> {
	const buf = await readFile(file);
	return `data:image/png;base64,${buf.toString('base64')}`;
}

async function render(
	browser: Browser,
	html: string,
	size: { width: number; height: number },
	file: string,
	type: 'jpeg' | 'png',
): Promise<void> {
	const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
	await page.setContent(html);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({
		path: file,
		type,
		...(type === 'jpeg' ? { quality: 92 } : { omitBackground: true }),
	});
	await page.close();
}

const shell = (body: string, background = BG) => `<!doctype html><html><head><meta charset="utf-8">
<style>
	* { margin: 0; box-sizing: border-box; }
	html, body { width: 100%; height: 100%; }
	body { background: ${background}; font-family: ${FONT}; color: #fafafa; overflow: hidden; }
</style></head><body>${body}</body></html>`;

function screenshotHtml(shot: Shot, locale: Locale, ui: string, icon: string): string {
	return shell(`
	<div style="position:absolute;left:56px;top:40px;right:56px;display:flex;align-items:center;gap:20px">
		<img src="${icon}" style="width:56px;height:56px">
		<div>
			<div style="font-size:38px;font-weight:700;letter-spacing:-0.5px">${shot.title[locale]}</div>
			<div style="font-size:19px;color:#d4d4d8;margin-top:6px">${shot.subtitle[locale]}</div>
		</div>
	</div>
	<img src="${ui}" style="position:absolute;left:128px;top:136px;width:1024px;height:640px;
		border-radius:14px;border:1px solid rgba(167,139,250,0.35);
		box-shadow:0 30px 80px rgba(0,0,0,0.6)">`);
}

function smallTileHtml(icon: string): string {
	return shell(`
	<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center">
		<img src="${icon}" style="width:104px;height:104px">
		<div style="font-size:34px;font-weight:700;letter-spacing:-0.5px">Debug Buddy</div>
		<div style="font-size:17px;color:${ACCENT};font-weight:600">Mock · Block · Pause HTTP</div>
	</div>`);
}

function marqueeHtml(icon: string, ui: string): string {
	return shell(`
	<div style="position:absolute;left:80px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:18px">
		<img src="${icon}" style="width:96px;height:96px">
		<div style="font-size:56px;font-weight:800;letter-spacing:-1px">Debug Buddy</div>
		<div style="font-size:26px;line-height:1.35;color:#e4e4e7">
			Mock, block, delay and pause HTTP traffic to test how your app handles API failures.
		</div>
		<div style="font-size:18px;color:${ACCENT};font-weight:600">No backend changes. No proxy.</div>
	</div>
	<div style="position:absolute;left:700px;top:70px;width:880px;height:550px;border-radius:16px;overflow:hidden;
		border:1px solid rgba(167,139,250,0.35);box-shadow:0 30px 80px rgba(0,0,0,0.6)">
		<img src="${ui}" style="width:880px;height:550px;object-fit:cover;object-position:left top">
	</div>`);
}

function storeIconHtml(icon: string): string {
	return `<!doctype html><html><head><style>
	* { margin: 0; } html, body { background: transparent; width: 128px; height: 128px; }
	</style></head><body><img src="${icon}" style="position:absolute;left:16px;top:16px;width:96px;height:96px"></body></html>`;
}

test('assets da Chrome Web Store', async () => {
	const browser = await chromium.launch();
	try {
		const icon = await dataUri(ICON);

		for (const locale of ['en', 'pt_BR'] as const) {
			const dir = path.join(STORE_DIR, 'screenshots', locale);
			await mkdir(dir, { recursive: true });
			for (const [i, shot] of SHOTS.entries()) {
				const ui = await dataUri(path.join(IMAGES_DIR, `${shot.image}.png`));
				const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${shot.image}.jpg`);
				await render(
					browser,
					screenshotHtml(shot, locale, ui, icon),
					{ width: 1280, height: 800 },
					file,
					'jpeg',
				);
			}
		}

		const commandCenter = await dataUri(path.join(IMAGES_DIR, 'command-center.png'));
		await render(
			browser,
			smallTileHtml(icon),
			{ width: 440, height: 280 },
			path.join(STORE_DIR, 'promo-small-440x280.jpg'),
			'jpeg',
		);
		await render(
			browser,
			marqueeHtml(icon, commandCenter),
			{ width: 1400, height: 560 },
			path.join(STORE_DIR, 'promo-marquee-1400x560.jpg'),
			'jpeg',
		);
		await render(
			browser,
			storeIconHtml(icon),
			{ width: 128, height: 128 },
			path.join(STORE_DIR, 'icon-128.png'),
			'png',
		);
	} finally {
		await browser.close();
	}
});
