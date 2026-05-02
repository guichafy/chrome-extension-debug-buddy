import type { InterceptedResponse } from '@/types/intercepted';
import type { RequestState } from '@/types/filters';

// Estado de execução canônico de uma requisição. Os antigos `mocked` e `proxy`
// migraram para `AppliedType` (coluna Tipo). Estado ficou só com semântica de
// execução: pending (aguardando interação no breakpoint), failed (erro de
// captura), modified (edição manual em runtime), ok (passou normalmente).
//
// A coluna visual "Estado" foi removida da tabela (redundante com Status Code);
// `getRequestState` continua sendo usado pelo filtro `state:` no command-center
// e pelo border-color da coluna URL.
export function getRequestState(request: InterceptedResponse): RequestState {
	if (request.captureError) return 'failed';
	if (request.isWaiting === true) return 'pending';
	if (request.editedAtRuntime === true) return 'modified';
	return 'ok';
}
