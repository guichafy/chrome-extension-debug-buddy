import { NetworkTimingTracker } from '../networkTiming';

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
});
