// Tooltip explicativo da coluna "Tamanho". Quando o valor exibido (`0 B` ou `—`)
// puder confundir o usuário, devolvemos uma string de contexto que a célula
// renderiza num Tooltip. Caso normal (request real com bytes na rede) ou quando
// não há contexto disponível, retorna undefined — sem inventar texto.

import type { InterceptedResponse } from '@/types';

export function getTransferSizeTooltip(request: InterceptedResponse): string | undefined {
	if (request.isMocked === true) {
		return 'Mock — não passou pela rede';
	}

	if (request.captureError && request.networkTiming?.transferSize === undefined) {
		return `Falha de captura: ${request.captureError}`;
	}

	if (request.networkTiming?.fromDiskCache === true) {
		return 'Servido pelo cache do navegador';
	}

	if (request.networkTiming?.fromServiceWorker === true) {
		return 'Servido por Service Worker';
	}

	return undefined;
}
