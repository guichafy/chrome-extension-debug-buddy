import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import { detectBodyKind, formatByteSize, type BodyKind } from '@/lib/bodyDetection';

interface BodyViewerProps {
	body: string | undefined;
	mimeType?: string;
	bodyUnavailableReason?: string;
	label?: string;
	/** Quando true, renderiza com altura maior (usado em response body principal). */
	expandedHeight?: boolean;
}

const ASCII_CHECK_LIMIT = 256;

function bodyToBlob(body: string, mimeType: string): Blob {
	const bytes = new Uint8Array(body.length);
	for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
	return new Blob([bytes], { type: mimeType });
}

function tryPrettyJson(body: string): string {
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return body;
	}
}

function highlightJson(json: string): string {
	return json
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(
			/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[eE][+-]?\d+)?/g,
			(match, str, colon, bool) => {
				if (str) {
					return colon
						? `<span class="text-blue-500 dark:text-blue-300">${str}</span>${colon}`
						: `<span class="text-emerald-600 dark:text-emerald-300">${str}</span>`;
				}
				if (bool) {
					return `<span class="text-violet-600 dark:text-violet-300">${match}</span>`;
				}
				return `<span class="text-amber-600 dark:text-amber-300">${match}</span>`;
			},
		);
}

export function BodyViewer({
	body,
	mimeType,
	bodyUnavailableReason,
	label,
	expandedHeight = false,
}: BodyViewerProps) {
	const kind = useMemo<BodyKind>(
		() => detectBodyKind(body, mimeType, bodyUnavailableReason),
		[body, mimeType, bodyUnavailableReason],
	);

	const [htmlMode, setHtmlMode] = useState<'preview' | 'source'>('preview');
	const blobUrlRef = useRef<string | null>(null);

	useEffect(() => {
		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, []);

	const totalBytes = body?.length ?? 0;
	const showSize = body !== undefined && body !== '';

	const handleCopy = async () => {
		if (body === undefined) return;
		try {
			await navigator.clipboard.writeText(body);
		} catch (err) {
			console.error('Falha ao copiar body:', err);
		}
	};

	const handleDownload = () => {
		if (body === undefined) return;
		const inferredMime = mimeType ?? 'application/octet-stream';
		const blob = bodyToBlob(body, inferredMime);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const ext = inferredMime.split('/')[1]?.split('+')[0] ?? 'bin';
		a.download = `response-body.${ext}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const containerHeight = expandedHeight ? 'max-h-[420px]' : 'max-h-[260px]';

	return (
		<div className="flex min-w-0 flex-col rounded-md border bg-muted/20">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
				{label && <span className="font-medium text-muted-foreground">{label}</span>}
				<span className="inline-flex items-center gap-1 font-mono uppercase tracking-wide text-[10px] text-muted-foreground">
					{kind.kind}
				</span>
				{mimeType && (
					<Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
						{mimeType}
					</Badge>
				)}
				{showSize && (
					<Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
						{formatByteSize(totalBytes)}
					</Badge>
				)}
				<div className="ml-auto flex items-center gap-1">
					{kind.kind === 'html' && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-6 gap-1 px-2 text-[11px]"
							onClick={() => setHtmlMode((m) => (m === 'preview' ? 'source' : 'preview'))}
						>
							<LucideIcon
								name={htmlMode === 'preview' ? 'file-json' : 'image'}
								className="h-3 w-3"
							/>
							{htmlMode === 'preview' ? 'Source' : 'Preview'}
						</Button>
					)}
					{body !== undefined && body !== '' && (
						<>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-6 gap-1 px-2 text-[11px]"
								onClick={handleCopy}
								aria-label="Copiar body"
							>
								<LucideIcon name="copy" className="h-3 w-3" />
								Copiar
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-6 gap-1 px-2 text-[11px]"
								onClick={handleDownload}
								aria-label="Baixar body"
							>
								<LucideIcon name="download" className="h-3 w-3" />
								Download
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Conteúdo */}
			<div className={cn('min-w-0 overflow-auto', containerHeight)}>
				{renderBody(kind, body, mimeType, htmlMode, blobUrlRef)}
			</div>
		</div>
	);
}

function renderBody(
	kind: BodyKind,
	body: string | undefined,
	mimeType: string | undefined,
	htmlMode: 'preview' | 'source',
	blobUrlRef: React.MutableRefObject<string | null>,
) {
	if (kind.kind === 'empty') {
		return <div className="p-4 text-xs text-muted-foreground">{kind.reason ?? 'Body vazio.'}</div>;
	}

	if (body === undefined) return null;

	if (kind.kind === 'image') {
		if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		const blob = bodyToBlob(body, kind.mimeType);
		const url = URL.createObjectURL(blob);
		blobUrlRef.current = url;
		return (
			<div
				className="flex min-h-[180px] items-center justify-center p-4"
				style={{
					backgroundImage:
						'linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)',
					backgroundSize: '16px 16px',
					backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
				}}
			>
				<img
					src={url}
					alt="Response body preview"
					className="max-h-[360px] max-w-full object-contain"
				/>
			</div>
		);
	}

	if (kind.kind === 'json') {
		const pretty = tryPrettyJson(body);
		const html = highlightJson(pretty);
		return (
			<pre
				className="min-w-0 whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON é escapado em highlightJson antes de aplicar spans
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	}

	if (kind.kind === 'html') {
		if (htmlMode === 'preview') {
			return (
				<iframe
					title="HTML preview"
					sandbox=""
					srcDoc={body}
					className="h-[360px] w-full border-0 bg-background"
				/>
			);
		}
		return (
			<pre className="min-w-0 whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed">
				{body}
			</pre>
		);
	}

	if (kind.kind === 'binary') {
		return (
			<div className="p-3 font-mono text-xs leading-relaxed">
				<p className="mb-2 text-muted-foreground">
					Conteúdo binário ({kind.totalBytes.toLocaleString('pt-BR')} bytes). Mostrando primeiros{' '}
					{Math.min(kind.totalBytes, ASCII_CHECK_LIMIT)} bytes:
				</p>
				<pre className="overflow-x-auto whitespace-pre">{kind.sampleHex}</pre>
			</div>
		);
	}

	// plain | xml | css | javascript
	return (
		<pre className="min-w-0 whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed">
			{body}
		</pre>
	);
}
