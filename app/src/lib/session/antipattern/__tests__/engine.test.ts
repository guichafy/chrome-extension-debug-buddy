import { describe, expect, it } from 'vitest';
import type { AntipatternHit, AntipatternId, SessionEvent } from '../../types';
import { AntipatternEngine, type Detector } from '../engine';

function netEv(over: Partial<Extract<SessionEvent, { type: 'network' }>>): SessionEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r1',
		method: 'GET',
		url: 'http://x/',
		status: 200,
		...over,
	};
}

function consoleEv(timestamp: number): SessionEvent {
	return {
		type: 'console',
		timestamp,
		phaseId: 'p1',
		source: 'app',
		level: 'log',
		args: [],
	};
}

const fakeHit = (patternId: AntipatternId = 'dup-req-burst', summary = 's'): AntipatternHit => ({
	patternId,
	severity: 'warn',
	startTimestamp: 1,
	endTimestamp: 2,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary },
});

describe('AntipatternEngine', () => {
	it('ignora eventos não-network', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		const hits = eng.pushEvent(consoleEv(10));
		expect(hits).toEqual([]);
	});

	it('aplica todos os detectores em ordem e devolve hits', () => {
		const a: Detector = () => fakeHit('dup-req-burst', 'A');
		const b: Detector = () => fakeHit('retry-storm', 'B');
		const eng = new AntipatternEngine([a, b]);
		const hits = eng.pushEvent(netEv({ timestamp: 100 }));
		expect(hits.map((h) => h.patternId)).toEqual(['dup-req-burst', 'retry-storm']);
	});

	it('dedup por patternId+start+end+summary', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		const first = eng.pushEvent(netEv({ timestamp: 1 }));
		const second = eng.pushEvent(netEv({ timestamp: 2, requestId: 'r2' }));
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(0);
	});

	it('FIFO eviction respeita janela de 5s', () => {
		const det: Detector = (_ev, buf) => {
			return buf.length >= 2 ? fakeHit('dup-req-burst', String(buf.length)) : null;
		};
		const eng = new AntipatternEngine([det]);
		eng.pushEvent(netEv({ timestamp: 0 }));
		eng.pushEvent(netEv({ timestamp: 100 }));
		expect(eng.bufferSize).toBe(2);
		eng.pushEvent(netEv({ timestamp: 6_000 }));
		// cutoff=1000ms; buffer pré-push tinha [0, 100]; 0 e 100 ambos < 1000 saem.
		expect(eng.bufferSize).toBe(1);
	});

	it('reset limpa buffer e emitted', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		eng.pushEvent(netEv({ timestamp: 1 }));
		eng.reset();
		const hits = eng.pushEvent(netEv({ timestamp: 2 }));
		expect(hits).toHaveLength(1);
		expect(eng.bufferSize).toBe(1);
	});

	it('emitted tem cap FIFO (não vaza memória em sessões longas)', () => {
		// Detector que produz hit único por evento (summary derivado do timestamp)
		const det: Detector = (ev) =>
			fakeHit('dup-req-burst', `unique-${ev.timestamp}`);
		const eng = new AntipatternEngine([det]);
		// Dispara mais do que MAX_EMITTED (500) hits únicos com timestamps crescentes
		// dentro da janela de 5s pra forçar o engine a manter mantendo eventos no buffer.
		// Usamos timestamps espaçados em 1ms — janela WINDOW_MS=5000 cobre todos.
		for (let i = 0; i < 600; i++) {
			eng.pushEvent(netEv({ timestamp: i, requestId: `r${i}` }));
		}
		// Set não pode crescer além de MAX_EMITTED (500).
		expect(eng.emittedSize).toBeLessThanOrEqual(500);
		expect(eng.emittedSize).toBeGreaterThan(0);
	});
});
