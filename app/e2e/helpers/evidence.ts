import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../evidence');

export async function captureEvidence(page: Page, slug: string): Promise<void> {
	const file = path.join(EVIDENCE_DIR, `${slug}.png`);
	await page.screenshot({ path: file, fullPage: false });
}
