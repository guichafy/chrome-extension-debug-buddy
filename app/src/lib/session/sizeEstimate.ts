import type { SessionEvent } from './types';

// Estimativa rápida via JSON.stringify. Usado pelo recorder pra contar bytes
// acumulados na sessão e disparar hard limit. Não precisa ser exato — só
// monotônico e proporcional ao payload real persistido em IndexedDB.
export function estimateEventBytes(event: SessionEvent): number {
	return JSON.stringify(event).length;
}
