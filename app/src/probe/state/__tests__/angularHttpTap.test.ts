import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installAngularHttpTap } from '../angularHttpTap';

// NOTA: a heurística stack-based `isHttpClientCallSite` é frágil de testar em
// jsdom (mockar Error.stack globalmente quebra outros testes). Aqui cobrimos
// apenas o lifecycle install/uninstall — em apps Angular reais, a tag é
// emitida quando o stack contém HttpClient/HttpHandler/HttpInterceptor.
describe('installAngularHttpTap', () => {
	const origOpen = XMLHttpRequest.prototype.open;
	const origSend = XMLHttpRequest.prototype.send;

	beforeEach(() => {
		(window as unknown as { ng?: unknown }).ng = {
			getComponent: () => null,
			getContext: () => null,
		};
		document.body.innerHTML = '<app-root></app-root>';
	});

	afterEach(() => {
		XMLHttpRequest.prototype.open = origOpen;
		XMLHttpRequest.prototype.send = origSend;
		(window as unknown as { ng?: unknown }).ng = undefined;
		document.body.innerHTML = '';
	});

	it('retorna null quando contexto Angular não detectado', () => {
		(window as unknown as { ng?: unknown }).ng = undefined;
		document.body.innerHTML = '';
		expect(installAngularHttpTap()).toBeNull();
	});

	it('instala wrapper em XMLHttpRequest.prototype quando Angular detectado', () => {
		const tap = installAngularHttpTap();
		expect(tap).not.toBeNull();
		expect(XMLHttpRequest.prototype.open).not.toBe(origOpen);
		expect(XMLHttpRequest.prototype.send).not.toBe(origSend);
		tap?.uninstall();
		expect(XMLHttpRequest.prototype.open).toBe(origOpen);
	});

	it('uninstall restaura XHR original', () => {
		const tap = installAngularHttpTap();
		tap?.uninstall();
		expect(XMLHttpRequest.prototype.open).toBe(origOpen);
		expect(XMLHttpRequest.prototype.send).toBe(origSend);
	});
});
