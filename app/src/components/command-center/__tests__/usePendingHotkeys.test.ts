import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { usePendingHotkeys } from '../usePendingHotkeys';

const baseHandlers = () => ({
	onApprove: vi.fn(),
	onIgnore: vi.fn(),
	onNext: vi.fn(),
	onPrev: vi.fn(),
	onEscape: vi.fn(),
});

function dispatchKey(key: string, init: Partial<KeyboardEventInit> = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	window.dispatchEvent(event);
	return event;
}

describe('usePendingHotkeys', () => {
	test('A dispara onApprove e previne default; I dispara onIgnore', () => {
		const handlers = baseHandlers();
		renderHook(() => usePendingHotkeys({ enabled: true, navEnabled: true, ...handlers }));

		const a = dispatchKey('a');
		expect(handlers.onApprove).toHaveBeenCalledTimes(1);
		expect(a.defaultPrevented).toBe(true);

		const i = dispatchKey('I');
		expect(handlers.onIgnore).toHaveBeenCalledTimes(1);
		expect(i.defaultPrevented).toBe(true);
	});

	test('J/K disparam navegação apenas quando navEnabled=true', () => {
		const handlers = baseHandlers();
		const { rerender } = renderHook(
			(props) => usePendingHotkeys({ enabled: true, ...handlers, ...props }),
			{ initialProps: { navEnabled: true } },
		);

		const j1 = dispatchKey('j');
		expect(handlers.onNext).toHaveBeenCalledTimes(1);
		expect(j1.defaultPrevented).toBe(true);

		const k1 = dispatchKey('k');
		expect(handlers.onPrev).toHaveBeenCalledTimes(1);
		expect(k1.defaultPrevented).toBe(true);

		rerender({ navEnabled: false });

		// Sem nav: J/K não chamam callbacks NEM disparam preventDefault — o
		// usuário pode continuar usando essas teclas para scroll/Vimium.
		const j2 = dispatchKey('j');
		expect(handlers.onNext).toHaveBeenCalledTimes(1);
		expect(j2.defaultPrevented).toBe(false);

		const k2 = dispatchKey('k');
		expect(handlers.onPrev).toHaveBeenCalledTimes(1);
		expect(k2.defaultPrevented).toBe(false);
	});

	test('enabled=false desabilita todos os atalhos', () => {
		const handlers = baseHandlers();
		renderHook(() => usePendingHotkeys({ enabled: false, navEnabled: true, ...handlers }));

		dispatchKey('a');
		dispatchKey('i');
		dispatchKey('j');
		dispatchKey('k');
		dispatchKey('Escape');

		expect(handlers.onApprove).not.toHaveBeenCalled();
		expect(handlers.onIgnore).not.toHaveBeenCalled();
		expect(handlers.onNext).not.toHaveBeenCalled();
		expect(handlers.onPrev).not.toHaveBeenCalled();
		expect(handlers.onEscape).not.toHaveBeenCalled();
	});

	test('Modifier keys (Ctrl/Meta/Alt) ignoram o handler', () => {
		const handlers = baseHandlers();
		renderHook(() => usePendingHotkeys({ enabled: true, navEnabled: true, ...handlers }));

		dispatchKey('a', { ctrlKey: true });
		dispatchKey('a', { metaKey: true });
		dispatchKey('a', { altKey: true });
		expect(handlers.onApprove).not.toHaveBeenCalled();
	});

	test('Foco em INPUT/TEXTAREA/SELECT não dispara handler', () => {
		const handlers = baseHandlers();
		renderHook(() => usePendingHotkeys({ enabled: true, navEnabled: true, ...handlers }));

		const input = document.createElement('input');
		document.body.appendChild(input);
		fireEvent.keyDown(input, { key: 'a' });
		expect(handlers.onApprove).not.toHaveBeenCalled();

		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);
		fireEvent.keyDown(textarea, { key: 'i' });
		expect(handlers.onIgnore).not.toHaveBeenCalled();

		const select = document.createElement('select');
		document.body.appendChild(select);
		fireEvent.keyDown(select, { key: 'j' });
		expect(handlers.onNext).not.toHaveBeenCalled();

		document.body.removeChild(input);
		document.body.removeChild(textarea);
		document.body.removeChild(select);
	});

	test('Escape dispara onEscape; ausente é no-op', () => {
		const handlers = baseHandlers();
		type EscapeProps = { onEscape: (() => void) | undefined };
		const { rerender } = renderHook(
			(props: EscapeProps) =>
				usePendingHotkeys({
					enabled: true,
					navEnabled: true,
					onApprove: handlers.onApprove,
					onIgnore: handlers.onIgnore,
					onNext: handlers.onNext,
					onPrev: handlers.onPrev,
					onEscape: props.onEscape,
				}),
			{ initialProps: { onEscape: handlers.onEscape } as EscapeProps },
		);
		const e1 = dispatchKey('Escape');
		expect(handlers.onEscape).toHaveBeenCalledTimes(1);
		expect(e1.defaultPrevented).toBe(true);

		// Sem onEscape: keystroke não é roubado.
		rerender({ onEscape: undefined });
		const e2 = dispatchKey('Escape');
		expect(e2.defaultPrevented).toBe(false);
	});
});
