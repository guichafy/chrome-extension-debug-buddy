import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { serializeSession } from '../exporter';
import { DEFAULT_REDACTION_CONFIG } from '../privacy/defaults';
import { redactConsoleArgs } from '../privacy/consoleRedactor';
import type { Session } from '../types';

// Payload que uma página gravada consegue emitir via console.log. Antes do escape,
// o `</script>` fechava o <script> do viewer e o <script> seguinte executava ao
// abrir o viewer.html exportado — com acesso a todo o conteúdo da sessão.
const PAYLOAD =
	"</script><script>window.__xss = true; addEventListener('DOMContentLoaded', function () { window.__leak = document.body.textContent; });</script>";

const SENSITIVE_URL = 'https://api.interna.test/users?email=fulano@empresa.test';

const maliciousSession = (): Session => ({
	id: 'sess_xss',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://atacante.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [
		{
			type: 'console',
			timestamp: 1_500,
			phaseId: 'p1',
			source: 'app',
			level: 'log',
			// Mesmo caminho do background: args passam pelo redator antes de persistir.
			args: redactConsoleArgs([{ type: 'string', description: PAYLOAD }], DEFAULT_REDACTION_CONFIG),
		},
		{
			type: 'network',
			timestamp: 1_600,
			phaseId: 'p1',
			requestId: 'r1',
			method: 'GET',
			url: SENSITIVE_URL,
			status: 200,
		},
		{
			type: 'error',
			timestamp: 1_700,
			phaseId: 'p1',
			message: 'separadores de linha \u2028 e \u2029 no meio',
		},
	],
});

async function renderExportedViewer(session: Session): Promise<Window> {
	const zip = await JSZip.loadAsync(await serializeSession(session));
	const viewerFile = zip.file('viewer.html');
	if (!viewerFile) throw new Error('viewer.html ausente no zip exportado');
	const html = await viewerFile.async('string');

	const iframe = document.createElement('iframe');
	document.body.appendChild(iframe);
	const win = iframe.contentWindow;
	const doc = iframe.contentDocument;
	if (!win || !doc) throw new Error('iframe sem documento');
	doc.open();
	doc.write(html);
	doc.close();
	return win;
}

describe('viewer.html exportado — conteúdo gravado não injeta script', () => {
	it('não executa <script> vindo de console.log da página gravada', async () => {
		const win = (await renderExportedViewer(maliciousSession())) as Window & {
			__xss?: boolean;
			__leak?: string;
		};
		expect(win.__xss).toBeUndefined();
		expect(win.__leak).toBeUndefined();
	});

	it('SESSION embutido faz round-trip exato (</script>, U+2028, U+2029)', async () => {
		const session = maliciousSession();
		const win = (await renderExportedViewer(session)) as Window & { eval: (src: string) => unknown };
		expect(win.eval('SESSION')).toEqual(JSON.parse(JSON.stringify(session)));
	});

	it('timeline mostra o payload como texto', async () => {
		const win = await renderExportedViewer(maliciousSession());
		const timeline = win.document.getElementById('timeline');
		expect(timeline?.textContent).toContain(PAYLOAD);
		expect(timeline?.textContent).toContain(SENSITIVE_URL);
		expect(timeline?.querySelectorAll('script')).toHaveLength(0);
	});
});
