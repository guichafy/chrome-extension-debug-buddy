import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { TextDecoder, TextEncoder } from 'node:util';
import { vi } from 'vitest';

// Polyfill para File.prototype.text (ausente em versões antigas do jsdom)
if (typeof File !== 'undefined' && !File.prototype.text) {
	File.prototype.text = function () {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsText(this);
		});
	};
}

// Polyfills para PointerEvent / Element APIs usados pelo Radix UI
// (DropdownMenu/Tabs/etc) — jsdom não implementa essas APIs, então o
// componente nunca abre nos testes sem esses stubs.
if (typeof Element !== 'undefined') {
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
	}
	if (!Element.prototype.setPointerCapture) {
		Element.prototype.setPointerCapture = () => {};
	}
	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = () => {};
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
}

// Polyfill ResizeObserver para componentes que usam medição reativa do DOM
// (RrwebPlayer responsivo, etc). jsdom não implementa nativo. Stub silencioso —
// não dispara callbacks (testes que dependem de medição passam dimensions
// explícitas via props).
if (typeof globalThis.ResizeObserver === 'undefined') {
	(globalThis as any).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	};
}

// Polyfills para TextEncoder/TextDecoder
if (typeof globalThis.TextEncoder === 'undefined') {
	(globalThis as any).TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
	(globalThis as any).TextDecoder = TextDecoder;
}

// Storage backing — mock de chrome.storage.local que persiste entre get/set
// dentro do mesmo teste. Testes podem resetar via:
//   (chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
const storageData: Record<string, unknown> = {};

// Mock para o objeto chrome
(globalThis as any).chrome = {
	runtime: {
		sendMessage: vi.fn(),
		lastError: undefined as { message: string } | undefined,
		onMessage: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
		connect: vi.fn().mockReturnValue({
			onMessage: {
				addListener: vi.fn(),
			},
		}),
	},
	storage: {
		local: {
			_data: storageData,
			get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
				const data = (chrome.storage.local as unknown as { _data: Record<string, unknown> })
					._data;
				if (keys === null || keys === undefined) {
					return { ...data };
				}
				if (typeof keys === 'string') {
					return keys in data ? { [keys]: data[keys] } : {};
				}
				if (Array.isArray(keys)) {
					const out: Record<string, unknown> = {};
					for (const k of keys) {
						if (k in data) out[k] = data[k];
					}
					return out;
				}
				// keys é objeto { chave: default } — retorna default quando ausente.
				const out: Record<string, unknown> = {};
				for (const k of Object.keys(keys)) {
					out[k] = k in data ? data[k] : (keys as Record<string, unknown>)[k];
				}
				return out;
			}),
			set: vi.fn(async (items: Record<string, unknown>) => {
				const data = (chrome.storage.local as unknown as { _data: Record<string, unknown> })
					._data;
				Object.assign(data, items);
			}),
			remove: vi.fn(async (keys: string | string[]) => {
				const data = (chrome.storage.local as unknown as { _data: Record<string, unknown> })
					._data;
				const arr = typeof keys === 'string' ? [keys] : keys;
				for (const k of arr) delete data[k];
			}),
		},
		onChanged: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
	},
	tabs: {
		query: vi.fn(),
	},
};
