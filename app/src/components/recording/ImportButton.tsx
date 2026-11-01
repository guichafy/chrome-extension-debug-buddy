import { Button } from '@/components/ui/button';
import { arrayBufferToBase64 } from '@/lib/session/binaryTransport';
import { parseDbsession } from '@/lib/session/importer';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ImportOriginWarningDialog } from './ImportOriginWarningDialog';

interface Props {
	onImported?: (sessionId: string) => void;
}

function originOf(rawUrl: string): string {
	try {
		return new URL(rawUrl).origin;
	} catch {
		return rawUrl;
	}
}

async function getCurrentTabOrigin(): Promise<string> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.url ? originOf(tab.url) : '';
}

export function ImportButton({ onImported }: Props) {
	const { t } = useTranslation('sessions');
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();
	const [pending, setPending] = useState<{
		buf: ArrayBuffer;
		filename: string;
		importedOrigin: string;
		currentOrigin: string;
	} | null>(null);

	const persist = async (buf: ArrayBuffer, filename: string) => {
		// chrome.runtime.sendMessage descarta ArrayBuffer no transporte (vira {}),
		// quebrando JSZip.loadAsync no background. Encodamos como base64 — handler
		// no background decoda antes do parseDbsession.
		const data = arrayBufferToBase64(buf);
		const res = await chrome.runtime.sendMessage({
			action: 'importSession',
			data,
			filename,
		});
		if (!res?.ok || !res.sessionId) {
			window.alert(t('import.failed', { error: res?.error ?? t('import.unknownError') }));
			return;
		}
		onImported?.(res.sessionId);
		navigate(`/replay/${res.sessionId}`);
	};

	const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// Reset input pra permitir re-importar mesmo arquivo
		e.target.value = '';
		if (!file) return;
		const buf = await file.arrayBuffer();
		// Pré-parse só pra ler initialUrl. Reparse depois no background é idempotente.
		try {
			const session = await parseDbsession(buf);
			const importedOrigin = originOf(session.metadata.initialUrl);
			const currentOrigin = await getCurrentTabOrigin();
			if (currentOrigin && importedOrigin && importedOrigin !== currentOrigin) {
				setPending({ buf, filename: file.name, importedOrigin, currentOrigin });
				return;
			}
		} catch (err) {
			window.alert(t('import.invalidFile', { error: String(err) }));
			return;
		}
		await persist(buf, file.name);
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".dbsession,application/zip"
				className="hidden"
				onChange={(e) => void onChange(e)}
			/>
			<Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
				{t('import.button')}
			</Button>
			{pending && (
				<ImportOriginWarningDialog
					open={true}
					importedOrigin={pending.importedOrigin}
					currentOrigin={pending.currentOrigin}
					onCancel={() => setPending(null)}
					onContinue={async () => {
						const p = pending;
						setPending(null);
						await persist(p.buf, p.filename);
					}}
				/>
			)}
		</>
	);
}
