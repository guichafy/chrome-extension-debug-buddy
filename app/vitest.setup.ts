import '@testing-library/jest-dom/vitest';
import { TextDecoder, TextEncoder } from 'node:util';
import { vi } from 'vitest';

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
	},
	tabs: {
		query: vi.fn(),
	},
};
