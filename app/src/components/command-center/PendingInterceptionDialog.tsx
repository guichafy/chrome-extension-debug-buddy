// Phase 5 — hub que despacha pra `EditRequestSheet` ou `EditResponseSheet` em
// função do stage da PendingInterception. Substitui a montagem direta do
// EditResponseSheet em CommandCenter pré-dual-stage.
//
// Para Response stage, traduzimos `PendingInterception` na forma narrow
// `EditResponseSheetRequest` (sem inventar timestamp/type que não existem no
// pipeline). Para Request stage, EditRequestSheet recebe a entry direto.

import type { InterceptionEditPayload } from '@/hooks/usePendingInterceptions';
import type { PendingInterception } from '@/lib/interceptionPipeline';
import { EditRequestSheet } from './EditRequestSheet';
import { EditResponseSheet, type EditResponseSheetRequest } from './EditResponseSheet';

interface PendingInterceptionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: PendingInterception;
	onApprove: (requestId: string) => Promise<boolean>;
	onApproveWithEdit: (
		requestId: string,
		payload: InterceptionEditPayload,
	) => Promise<{ success: boolean; error?: string }>;
	onCancel: (requestId: string) => Promise<boolean>;
}

function toResponseSheetRequest(entry: PendingInterception): EditResponseSheetRequest {
	if (!entry.response) {
		// Em Response stage o pipeline sempre popula `response` antes de
		// enfileirar — ausência sinaliza bug no enqueue, não cenário de runtime
		// esperado. Lançamos para que o erro fique visível (regra no-fallbacks).
		throw new Error(
			`PendingInterception stage='response' sem snapshot de response (requestId=${entry.requestId}).`,
		);
	}
	return {
		url: entry.url,
		method: entry.method,
		status: entry.response.status,
		statusText: entry.response.statusPhrase,
		headers: entry.response.headers,
		...(entry.response.body !== undefined ? { body: entry.response.body } : {}),
		response: {
			headers: entry.response.headers,
			...(entry.response.body !== undefined ? { body: entry.response.body } : {}),
		},
	};
}

export function PendingInterceptionDialog({
	open,
	onOpenChange,
	entry,
	onApprove,
	onApproveWithEdit,
	onCancel,
}: PendingInterceptionDialogProps) {
	if (entry.stage === 'request') {
		return (
			<EditRequestSheet
				open={open}
				onOpenChange={onOpenChange}
				entry={entry}
				onApprove={onApprove}
				onApproveWithEdit={(requestId, payload) =>
					onApproveWithEdit(requestId, {
						url: payload.url,
						method: payload.method,
						headers: payload.headers,
						postData: payload.postData,
					})
				}
				onCancel={onCancel}
			/>
		);
	}

	const responseRequest = toResponseSheetRequest(entry);
	return (
		<EditResponseSheet
			open={open}
			onOpenChange={onOpenChange}
			request={responseRequest}
			requestId={entry.requestId}
			onSubmit={(requestId, payload) =>
				onApproveWithEdit(requestId, {
					status: payload.status,
					headers: payload.headers,
					body: payload.body,
				})
			}
		/>
	);
}

export default PendingInterceptionDialog;
