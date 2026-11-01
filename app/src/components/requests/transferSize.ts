// Tooltip explicativo da coluna "Tamanho". Quando o valor exibido (`0 B` ou `—`)
// puder confundir o usuário, devolvemos uma string de contexto que a célula
// renderiza num Tooltip. Caso normal (request real com bytes na rede) ou quando
// não há contexto disponível, retorna undefined — sem inventar texto.

import { i18n } from '@/i18n/instance';
import type { InterceptedResponse } from '@/types';

export function getTransferSizeTooltip(request: InterceptedResponse): string | undefined {
	if (request.isMocked === true) {
		return i18n.t('commandCenter:transferSize.mock');
	}

	if (request.captureError && request.networkTiming?.transferSize === undefined) {
		return i18n.t('commandCenter:transferSize.captureError', { error: request.captureError });
	}

	if (request.networkTiming?.fromDiskCache === true) {
		return i18n.t('commandCenter:transferSize.diskCache');
	}

	if (request.networkTiming?.fromServiceWorker === true) {
		return i18n.t('commandCenter:transferSize.serviceWorker');
	}

	return undefined;
}
