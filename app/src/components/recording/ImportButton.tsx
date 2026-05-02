import { useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Props {
	onImported?: (sessionId: string) => void;
}

export function ImportButton({ onImported }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const buf = await file.arrayBuffer();
		const res = await chrome.runtime.sendMessage({
			action: 'importSession',
			data: buf,
			filename: file.name,
		});
		// Reset input pra permitir re-importar mesmo arquivo
		e.target.value = '';
		if (!res?.ok || !res.sessionId) {
			window.alert(`Falha ao importar: ${res?.error ?? 'erro desconhecido'}`);
			return;
		}
		onImported?.(res.sessionId);
		navigate(`/replay/${res.sessionId}`);
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
				Importar .dbsession
			</Button>
		</>
	);
}
