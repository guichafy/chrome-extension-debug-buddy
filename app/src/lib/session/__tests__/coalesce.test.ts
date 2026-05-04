import { describe, expect, it } from 'vitest';
import { tryCoalesceConsole } from '../coalesce';
import type { SessionEvent } from '../types';

const ce = (overrides: Partial<Extract<SessionEvent, { type: 'console' }>> = {}): Extract<SessionEvent, { type: 'console' }> => ({
	type: 'console',
	timestamp: 0,
	phaseId: 'p1',
	source: 'app',
	level: 'log',
	args: [{ type: 'string', description: 'hello' }],
	...overrides,
});

describe('tryCoalesceConsole', () => {
	it('coalesce dois consoles idênticos consecutivos', () => {
		const prev = ce({ timestamp: 1 });
		const next = ce({ timestamp: 2 });
		const out = tryCoalesceConsole(prev, next);
		expect(out.coalesced).toBe(true);
		if (out.coalesced) {
			expect(out.event.coalesceCount).toBe(2);
			expect(out.event.timestamp).toBe(1); // primeiro
		}
	});

	it('incrementa coalesceCount quando prev já está coalescido', () => {
		const prev = ce({ timestamp: 1, coalesceCount: 5 });
		const next = ce({ timestamp: 6 });
		const out = tryCoalesceConsole(prev, next);
		expect(out.coalesced).toBe(true);
		if (out.coalesced) expect(out.event.coalesceCount).toBe(6);
	});

	it('não coalesce quando level difere', () => {
		const prev = ce({ level: 'log' });
		const next = ce({ level: 'warn' });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('não coalesce quando source difere', () => {
		const prev = ce({ source: 'app' });
		const next = ce({ source: 'browser' });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('não coalesce quando args description difere', () => {
		const prev = ce({ args: [{ type: 'string', description: 'a' }] });
		const next = ce({ args: [{ type: 'string', description: 'b' }] });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('coalesce ignorando timestamp e stackTrace', () => {
		const prev = ce({
			timestamp: 1,
			stackTrace: { frames: [{ url: 'a.js', lineNumber: 1, columnNumber: 1, functionName: 'f' }] },
		});
		const next = ce({ timestamp: 999 });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(true);
	});

	it('não coalesce quando prev não é console event', () => {
		const prev: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		const next = ce();
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});
});
