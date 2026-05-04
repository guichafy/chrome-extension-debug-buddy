import { describe, expect, it } from 'vitest';
import { buildViewerHtml } from '../viewerTemplate';

describe('buildViewerHtml — Phase 2', () => {
	it('embute o JSON da session', () => {
		const html = buildViewerHtml('{"id":"sess_test","rrwebEvents":[{"type":4,"timestamp":1,"data":{}}]}');
		expect(html).toContain('"sess_test"');
		expect(html).toContain('rrwebEvents');
	});

	it('embute código do rrweb-player (procura por símbolo característico)', () => {
		const html = buildViewerHtml('{}');
		// rrweb-player UMD expõe o global `rrwebPlayer`. O bundle minificado contém o nome.
		expect(html).toMatch(/rrwebPlayer/);
	});

	it('embute CSS do rrweb-player', () => {
		const html = buildViewerHtml('{}');
		// Classes características do player CSS.
		expect(html).toMatch(/\.rr-player|\.replayer-wrapper/);
	});

	it('inclui fallback "sem captura visual"', () => {
		const html = buildViewerHtml('{}');
		expect(html).toContain('Sessão sem captura visual');
	});

	it('marca header como Phase 2 (replay visual via rrweb embutido)', () => {
		const html = buildViewerHtml('{}');
		expect(html).toContain('replay visual via rrweb embutido');
	});
});
