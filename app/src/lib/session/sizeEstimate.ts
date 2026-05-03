import type { RrwebEvent, SessionEvent } from './types';

// Estimativa rápida via JSON.stringify. Usado pelo recorder pra contar bytes
// acumulados na sessão e disparar hard limit. Não precisa ser exato — só
// monotônico e proporcional ao payload real persistido em IndexedDB.
export function estimateEventBytes(event: SessionEvent): number {
	return JSON.stringify(event).length;
}

// Estima bytes de um batch de eventos rrweb. JSON.stringify do array inteiro
// é mais barato que somar por evento e captura overhead de delimitadores.
export function estimateRrwebBytes(events: RrwebEvent[]): number {
	if (events.length === 0) return 0;
	return JSON.stringify(events).length;
}
