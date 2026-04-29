import '@testing-library/jest-dom/vitest';
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

// Polyfills para TextEncoder/TextDecoder
if (typeof globalThis.TextEncoder === 'undefined') {
	(globalThis as any).TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
	(globalThis as any).TextDecoder = TextDecoder;
}

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
			get: vi.fn(),
			set: vi.fn(),
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
