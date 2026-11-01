import { act, cleanup, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { useAllRequests } from '../useAllRequests';
import { indexedDBService } from '@/lib/indexedDB';
import type { InterceptedResponse } from '@/types/intercepted';

vi.mock('@/lib/indexedDB', () => ({
	indexedDBService: {
		init: vi.fn().mockResolvedValue(undefined),
		getAllRequests: vi.fn().mockResolvedValue({}),
	},
}));

const request: InterceptedResponse = {
	url: 'https://example.test/dados',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: {},
	type: 'Fetch',
	timestamp: 1,
	body: 'conteúdo integral',
};

type Listener = (message: unknown) => void;
const listeners = new Set<Listener>();
function emit(message: unknown) {
	act(() => {
		for (const listener of listeners) listener(message);
	});
}

async function mount() {
	const snapshots: Record<string, InterceptedResponse>[] = [];
	const hook = renderHook(() => {
		const result = useAllRequests();
		useEffect(() => {
			snapshots.push(result.allRequests);
		}, [result.allRequests]);
		return result;
	});
	await act(async () => {});
	snapshots.length = 0;
	return { ...hook, snapshots };
}

beforeEach(() => {
	vi.useFakeTimers();
	listeners.clear();
	vi.mocked(indexedDBService.getAllRequests).mockResolvedValue({ existing: request });
	vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
		listeners.add(listener as Listener);
	});
	vi.mocked(chrome.runtime.onMessage.removeListener).mockImplementation((listener) => {
		listeners.delete(listener as Listener);
	});
	vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.clearAllMocks();
});

test('agrupa commits em janela limitada mesmo com updates contínuos', async () => {
	const { result, snapshots } = await mount();
	for (let duration = 1; duration <= 5; duration++) {
		emit({ action: 'requestUpdated', requestId: 'existing', updates: { duration } });
		act(() => vi.advanceTimersByTime(10));
	}
	expect(snapshots).toHaveLength(1);
	expect(result.current.allRequests.existing.duration).toBe(5);
	for (let duration = 6; duration <= 10; duration++) {
		emit({ action: 'requestUpdated', requestId: 'existing', updates: { duration } });
		act(() => vi.advanceTimersByTime(10));
	}
	expect(snapshots).toHaveLength(2);
	expect(result.current.allRequests.existing.duration).toBe(10);
});

test('preserva ordem de criação, patches e substituição sem perder outras requests', async () => {
	const { result, snapshots } = await mount();
	emit({ action: 'requestUpdated', requestId: 'new', updates: { status: 404 } });
	emit({ action: 'newRequest', requestId: 'new', request });
	emit({ action: 'requestUpdated', requestId: 'new', updates: { duration: 10, status: 201 } });
	emit({ action: 'requestUpdated', requestId: 'new', updates: { duration: 20 } });
	emit({ action: 'newRequest', requestId: 'replaced', request });
	emit({ action: 'requestUpdated', requestId: 'replaced', updates: { duration: 30 } });
	emit({ action: 'newRequest', requestId: 'replaced', request: { ...request, body: 'novo' } });
	act(() => vi.advanceTimersByTime(50));
	expect(snapshots).toHaveLength(1);
	expect(result.current.allRequests).toEqual({
		existing: request,
		new: { ...request, status: 201, duration: 20 },
		replaced: { ...request, body: 'novo' },
	});
	expect(result.current.allRequests.existing).toBe(request);
});

test('limpar cancela o lote antigo sem ressuscitar requests e aceita novas capturas', async () => {
	const { result } = await mount();
	emit({ action: 'newRequest', requestId: 'old', request });
	await act(async () => {
		await result.current.clearAllRequests();
	});
	act(() => vi.advanceTimersByTime(50));
	expect(result.current.allRequests).toEqual({});
	emit({ action: 'newRequest', requestId: 'new', request });
	act(() => vi.advanceTimersByTime(50));
	expect(result.current.allRequests).toEqual({ new: request });
});

test('desmontar cancela timer e remove listener sem executar commits atrasados', async () => {
	const { unmount, snapshots } = await mount();
	emit({ action: 'newRequest', requestId: 'new', request });
	expect(vi.getTimerCount()).toBe(1);
	unmount();
	expect(vi.getTimerCount()).toBe(0);
	expect(listeners.size).toBe(0);
	act(() => vi.advanceTimersByTime(50));
	expect(snapshots).toHaveLength(0);
});
