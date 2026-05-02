import { NetworkTimingTracker, deriveNetworkTiming } from '../networkTiming';

describe('NetworkTimingTracker', () => {
	let emitted: Array<{ fetchId: string; duration: number }>;
	let tracker: NetworkTimingTracker;

	beforeEach(() => {
		emitted = [];
		tracker = new NetworkTimingTracker((fetchId, duration) => {
			emitted.push({ fetchId, duration });
		});
	});

	it('emite duration quando start, end e fetchId chegam em qualquer ordem', () => {
		// Ordem comum: start → end → linkFetchId (Fetch.requestPaused)
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n1', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n1', timestamp: 1.5 });
		tracker.linkFetchId('n1', 'fetch-1');
		expect(emitted).toEqual([{ fetchId: 'fetch-1', duration: 500 }]);
	});

	it('emite duration quando linkFetchId chega antes do end', () => {
		// Ordem real observada: paused chega antes de loadingFinished
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n2', timestamp: 2.0 });
		tracker.linkFetchId('n2', 'fetch-2');
		expect(emitted).toEqual([]);

		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n2', timestamp: 2.25 });
		expect(emitted).toEqual([{ fetchId: 'fetch-2', duration: 250 }]);
	});

	it('emite no máximo uma vez por requisição', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n3', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.responseReceived', { requestId: 'n3', timestamp: 1.1 });
		tracker.linkFetchId('n3', 'fetch-3');
		// Primeiro emit aconteceu com TTFB; loadingFinished chega depois.
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n3', timestamp: 1.5 });
		expect(emitted).toHaveLength(1);
	});

	it('responseReceived não sobrescreve end já registrado por loadingFinished', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n4', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n4', timestamp: 1.4 });
		tracker.handleNetworkEvent('Network.responseReceived', { requestId: 'n4', timestamp: 1.1 });
		tracker.linkFetchId('n4', 'fetch-4');
		expect(emitted).toEqual([{ fetchId: 'fetch-4', duration: 400 }]);
	});

	it('descarta entrada em loadingFailed', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n5', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.loadingFailed', { requestId: 'n5' });
		tracker.linkFetchId('n5', 'fetch-5');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n5', timestamp: 2.0 });
		expect(emitted).toEqual([]);
	});

	it('discardByNetworkId limpa entrada (usado para mocks)', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n6', timestamp: 1.0 });
		tracker.discardByNetworkId('n6');
		tracker.linkFetchId('n6', 'fetch-6');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n6', timestamp: 1.5 });
		expect(emitted).toEqual([]);
	});

	it('ignora eventos Network fora da allowlist', () => {
		tracker.handleNetworkEvent('Network.dataReceived', { requestId: 'n7', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.responseReceivedExtraInfo', {
			requestId: 'n7',
			timestamp: 1.0,
		});
		tracker.linkFetchId('n7', 'fetch-7');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n7', timestamp: 1.5 });
		expect(emitted).toEqual([]);
	});

	it('reset limpa todas as entradas pendentes', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n8', timestamp: 1.0 });
		tracker.reset();
		tracker.linkFetchId('n8', 'fetch-8');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n8', timestamp: 1.5 });
		expect(emitted).toEqual([]);
	});

	it('arredonda duration para inteiro >= 0', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'n9', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'n9', timestamp: 1.0006 });
		tracker.linkFetchId('n9', 'fetch-9');
		expect(emitted).toEqual([{ fetchId: 'fetch-9', duration: 1 }]);
	});

	it('emite duration do hop 301 quando o redirect chega via requestWillBeSent.redirectResponse', () => {
		// Trace típico de um 301 → 200:
		//   1. requestWillBeSent (inicial) — start do 301
		//   2. Fetch.requestPaused (301) → linkFetchId(networkId, fetch-301)
		//   3. requestWillBeSent (com redirectResponse) — fim do 301 / início do destino
		//   4. Fetch.requestPaused (destino) → linkFetchId(networkId, fetch-final)
		//   5. loadingFinished — fim do destino
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'r1', timestamp: 1.0 });
		tracker.linkFetchId('r1', 'fetch-301');

		tracker.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'r1',
			timestamp: 1.2,
			redirectResponse: { status: 301 },
		});
		expect(emitted).toEqual([{ fetchId: 'fetch-301', duration: 200 }]);

		tracker.linkFetchId('r1', 'fetch-final');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'r1', timestamp: 1.5 });
		expect(emitted).toEqual([
			{ fetchId: 'fetch-301', duration: 200 },
			{ fetchId: 'fetch-final', duration: 300 },
		]);
	});

	it('emite duration para cada hop em uma cadeia de redirects', () => {
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'r2', timestamp: 1.0 });
		tracker.linkFetchId('r2', 'hop-a');

		tracker.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'r2',
			timestamp: 1.1,
			redirectResponse: { status: 301 },
		});
		tracker.linkFetchId('r2', 'hop-b');

		tracker.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'r2',
			timestamp: 1.3,
			redirectResponse: { status: 302 },
		});
		tracker.linkFetchId('r2', 'hop-c');

		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'r2', timestamp: 1.6 });

		expect(emitted).toEqual([
			{ fetchId: 'hop-a', duration: 100 },
			{ fetchId: 'hop-b', duration: 200 },
			{ fetchId: 'hop-c', duration: 300 },
		]);
	});

	it('redirect sem fetchRequestId associado ao hop anterior não emite (defensivo)', () => {
		// Cenário improvável: requestWillBeSent inicial, depois redirect, sem que o
		// Fetch.requestPaused do primeiro hop tenha chegado para linkar o fetchId.
		tracker.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'r3', timestamp: 1.0 });
		tracker.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'r3',
			timestamp: 1.2,
			redirectResponse: { status: 301 },
		});
		expect(emitted).toEqual([]);

		// O hop seguinte deve continuar funcionando normalmente, com start
		// reiniciado no momento do redirect.
		tracker.linkFetchId('r3', 'fetch-final');
		tracker.handleNetworkEvent('Network.loadingFinished', { requestId: 'r3', timestamp: 1.5 });
		expect(emitted).toEqual([{ fetchId: 'fetch-final', duration: 300 }]);
	});

	it('emite onMetricsReady com timing + encodedDataLength quando ambos existem', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm1', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm1',
			timestamp: 1.1,
			response: {
				timing: {
					dnsStart: 0,
					dnsEnd: 5,
					connectStart: 5,
					connectEnd: 15,
					sslStart: -1,
					sslEnd: -1,
					receiveHeadersEnd: 30,
				},
				fromDiskCache: false,
				fromServiceWorker: false,
			},
		});
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm1',
			timestamp: 1.5,
			encodedDataLength: 4096,
		});
		t.linkFetchId('m1', 'fetch-m1');
		expect(metrics).toEqual([
			{
				fetchId: 'fetch-m1',
				timing: {
					ttfbMs: 30,
					dnsMs: 5,
					tcpMs: 10,
					transferSize: 4096,
					encodedDataLength: 4096,
				},
			},
		]);
	});

	it('não emite onMetricsReady quando nem timing nem encodedDataLength existem', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm2', timestamp: 1.0 });
		t.handleNetworkEvent('Network.loadingFinished', { requestId: 'm2', timestamp: 1.5 });
		t.linkFetchId('m2', 'fetch-m2');
		expect(metrics).toEqual([]);
	});

	it('emite onMetricsReady só com flags quando timing/encodedDataLength faltam mas fromDiskCache=true', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm3', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm3',
			timestamp: 1.05,
			response: { fromDiskCache: true },
		});
		t.handleNetworkEvent('Network.loadingFinished', { requestId: 'm3', timestamp: 1.05 });
		t.linkFetchId('m3', 'fetch-m3');
		expect(metrics).toEqual([{ fetchId: 'fetch-m3', timing: { fromDiskCache: true } }]);
	});

	it('emite onMetricsReady para hop de redirect a partir de redirectResponse', () => {
		// Trace típico de um 301 → 200:
		//   1. requestWillBeSent (inicial) — start do 301
		//   2. Fetch.requestPaused (301) → linkFetchId(networkId, fetch-301)
		//   3. requestWillBeSent (com redirectResponse contendo encodedDataLength
		//      e timing do 301) — fim do 301 / início do destino
		//   4. Fetch.requestPaused (destino) → linkFetchId(networkId, fetch-final)
		//   5. loadingFinished — fim do destino
		// O hop do 301 não recebe Network.responseReceived/Network.loadingFinished
		// próprios — o CDP empurra os dados embutidos em redirectResponse. Sem
		// extrair daí, o transferSize do hop 301 fica undefined e a coluna
		// "Tamanho" da UI mostra "—" mesmo a rede tendo transferido bytes.
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'rm1', timestamp: 1.0 });
		t.linkFetchId('rm1', 'fetch-301');

		t.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'rm1',
			timestamp: 1.2,
			redirectResponse: {
				status: 301,
				encodedDataLength: 512,
				timing: {
					dnsStart: 0,
					dnsEnd: 5,
					connectStart: 5,
					connectEnd: 15,
					sslStart: -1,
					sslEnd: -1,
					receiveHeadersEnd: 30,
				},
				fromDiskCache: false,
				fromServiceWorker: false,
			},
		});

		expect(metrics).toEqual([
			{
				fetchId: 'fetch-301',
				timing: {
					ttfbMs: 30,
					dnsMs: 5,
					tcpMs: 10,
					transferSize: 512,
					encodedDataLength: 512,
				},
			},
		]);
	});

	it('emite onMetricsReady para cada hop em cadeia de redirects', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'rm2', timestamp: 1.0 });
		t.linkFetchId('rm2', 'hop-a');

		t.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'rm2',
			timestamp: 1.1,
			redirectResponse: { status: 301, encodedDataLength: 256 },
		});
		t.linkFetchId('rm2', 'hop-b');

		t.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'rm2',
			timestamp: 1.3,
			redirectResponse: { status: 302, encodedDataLength: 384 },
		});
		t.linkFetchId('rm2', 'hop-c');

		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'rm2',
			timestamp: 1.4,
			response: { fromDiskCache: false, fromServiceWorker: false },
		});
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'rm2',
			timestamp: 1.6,
			encodedDataLength: 4096,
		});

		expect(metrics).toEqual([
			{ fetchId: 'hop-a', timing: { transferSize: 256, encodedDataLength: 256 } },
			{ fetchId: 'hop-b', timing: { transferSize: 384, encodedDataLength: 384 } },
			{ fetchId: 'hop-c', timing: { transferSize: 4096, encodedDataLength: 4096 } },
		]);
	});

	it('redirect sem fetchRequestId no hop anterior não emite metrics (defensivo)', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'rm3', timestamp: 1.0 });
		t.handleNetworkEvent('Network.requestWillBeSent', {
			requestId: 'rm3',
			timestamp: 1.2,
			redirectResponse: { status: 301, encodedDataLength: 512 },
		});
		expect(metrics).toEqual([]);
	});

	it('emite onMetricsReady idempotente (uma vez por fetchId)', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm4', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm4',
			timestamp: 1.1,
			response: {
				timing: {
					dnsStart: 0,
					dnsEnd: 1,
					connectStart: 1,
					connectEnd: 2,
					sslStart: -1,
					sslEnd: -1,
					receiveHeadersEnd: 5,
				},
			},
		});
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm4',
			timestamp: 1.2,
			encodedDataLength: 100,
		});
		t.linkFetchId('m4', 'fetch-m4');
		// loadingFinished + linkFetchId já dispararam — qualquer evento adicional não deve duplicar.
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm4',
			timestamp: 1.3,
			encodedDataLength: 999,
		});
		expect(metrics).toHaveLength(1);
	});

	it('loadingFailed descarta entrada antes de emitir métricas', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm5', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm5',
			timestamp: 1.1,
			response: { fromDiskCache: true },
		});
		t.handleNetworkEvent('Network.loadingFailed', { requestId: 'm5' });
		t.linkFetchId('m5', 'fetch-m5');
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm5',
			timestamp: 1.5,
			encodedDataLength: 100,
		});
		expect(metrics).toEqual([]);
	});
});

describe('deriveNetworkTiming', () => {
	it('retorna undefined quando timing e encodedDataLength são ambos ausentes', () => {
		expect(deriveNetworkTiming(undefined, undefined, {})).toBeUndefined();
	});

	it('retorna objeto com transferSize quando só encodedDataLength existe', () => {
		expect(deriveNetworkTiming(undefined, 1234, {})).toEqual({
			transferSize: 1234,
			encodedDataLength: 1234,
		});
	});

	it('retorna objeto com fromDiskCache quando response.fromDiskCache é true', () => {
		expect(deriveNetworkTiming(undefined, undefined, { fromDiskCache: true })).toEqual({
			fromDiskCache: true,
		});
	});

	it('retorna objeto com fromServiceWorker quando response.fromServiceWorker é true', () => {
		expect(deriveNetworkTiming(undefined, undefined, { fromServiceWorker: true })).toEqual({
			fromServiceWorker: true,
		});
	});

	it('calcula dnsMs/tcpMs/tlsMs quando todos os pares existem', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 10,
			connectStart: 10,
			connectEnd: 30,
			sslStart: 15,
			sslEnd: 25,
			receiveHeadersEnd: 50,
		};
		const result = deriveNetworkTiming(timing, 2048, {});
		expect(result).toEqual({
			ttfbMs: 50,
			dnsMs: 10,
			tcpMs: 20,
			tlsMs: 10,
			transferSize: 2048,
			encodedDataLength: 2048,
		});
	});

	it('omite tlsMs quando sslStart/sslEnd são -1 (http puro)', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 5,
			connectStart: 5,
			connectEnd: 15,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 30,
		};
		const result = deriveNetworkTiming(timing, undefined, {});
		expect(result).toEqual({
			ttfbMs: 30,
			dnsMs: 5,
			tcpMs: 10,
		});
	});

	it('omite dnsMs/tcpMs quando intervalos são negativos (cache resolveu sem rede)', () => {
		const timing = {
			dnsStart: -1,
			dnsEnd: -1,
			connectStart: -1,
			connectEnd: -1,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 5,
		};
		const result = deriveNetworkTiming(timing, undefined, {});
		expect(result).toEqual({});
	});

	it('combina timing com flags fromDiskCache/fromServiceWorker', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 1,
			connectStart: 1,
			connectEnd: 2,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 3,
		};
		const result = deriveNetworkTiming(timing, 100, {
			fromDiskCache: false,
			fromServiceWorker: true,
		});
		expect(result).toEqual({
			ttfbMs: 3,
			dnsMs: 1,
			tcpMs: 1,
			transferSize: 100,
			encodedDataLength: 100,
			fromServiceWorker: true,
		});
	});
});
