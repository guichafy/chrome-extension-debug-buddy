import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RrwebPlayer, type RrwebPlayerHandle } from '../RrwebPlayer';
import type { RrwebEvent } from '@/lib/session/types';

// Mock rrweb-player — em jsdom o player tenta criar iframe + virar Canvas.
// Stub captura props e expõe métodos para asserts.
const playerMock = {
	goto: vi.fn(),
	getCurrentTime: vi.fn(() => 1234),
	play: vi.fn(),
	pause: vi.fn(),
	addEventListener: vi.fn(),
	$destroy: vi.fn(),
};
// Função regular (não arrow) para suportar `new RrwebPlayerLib(...)`.
// `vi.fn(function ...)` mantém spy de chamadas e retorna o stub do construtor.
vi.mock('rrweb-player', () => ({
	default: vi.fn(function PlayerStub() {
		return playerMock;
	}),
}));
vi.mock('rrweb-player/dist/style.css', () => ({}));

const minimalEvents: RrwebEvent[] = [
	{ type: 4, timestamp: 0, data: { href: 'https://example/', width: 1024, height: 768 } },
	{ type: 2, timestamp: 1, data: { node: {}, initialOffset: { left: 0, top: 0 } } },
];

describe('RrwebPlayer', () => {
	it('monta sem crash com >=2 eventos', () => {
		const { container } = render(<RrwebPlayer events={minimalEvents} />);
		expect(container.querySelector('.rrweb-player-host')).toBeInTheDocument();
	});

	it('não monta player com <2 eventos', async () => {
		const RrwebPlayerLib = (await import('rrweb-player')).default as unknown as ReturnType<
			typeof vi.fn
		>;
		RrwebPlayerLib.mockClear();
		render(<RrwebPlayer events={[]} />);
		expect(RrwebPlayerLib).not.toHaveBeenCalled();
	});

	it('expõe goto/getCurrentTime via ref', () => {
		const ref = createRef<RrwebPlayerHandle>();
		render(<RrwebPlayer ref={ref} events={minimalEvents} />);
		ref.current?.goto(500);
		expect(playerMock.goto).toHaveBeenCalledWith(500);
		expect(ref.current?.getCurrentTime()).toBe(1234);
	});

	it('chama onTimeUpdate quando player emite ui-update-current-time', () => {
		const onTimeUpdate = vi.fn();
		render(<RrwebPlayer events={minimalEvents} onTimeUpdate={onTimeUpdate} />);
		const handler = playerMock.addEventListener.mock.calls.find(
			(c) => c[0] === 'ui-update-current-time',
		)?.[1];
		expect(handler).toBeDefined();
		handler?.({ payload: 750 });
		expect(onTimeUpdate).toHaveBeenCalledWith(750);
	});
});
