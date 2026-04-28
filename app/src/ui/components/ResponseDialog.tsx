import React, { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogClose,
	DialogDescription,
} from './shadcn/dialog';
import { Button } from './shadcn/button';
import { Icon } from './shadcn/icon';
import { Badge } from './shadcn/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './shadcn/tabs';
import { ScrollArea } from './shadcn/scroll-area';
import { Input } from './shadcn/input';
import { InterceptedResponse, ResponseModifications } from '../hooks/useResponses';

interface ResponseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	response: InterceptedResponse | null;
	requestId: string | null;
	onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
	onIgnore: (requestId: string) => Promise<boolean>;
	onMock: (response: InterceptedResponse) => void;
	onEdit: () => void;
	onCancel: () => void;
	isEditing: boolean;
	readOnly?: boolean;
	ruleCreated?: boolean;
}

// Função auxiliar para truncar URLs longas
const truncateUrl = (url: string, maxLength = 60): string => {
	if (url.length <= maxLength) {
		return url;
	}
	const startLength = Math.floor((maxLength - 3) / 2);
	const endLength = Math.ceil((maxLength - 3) / 2);
	return `${url.substring(0, startLength)}...${url.substring(url.length - endLength)}`;
};

// Função para detectar se o conteúdo é binário
const isBinaryContent = (str: string): boolean => {
	// Verifica se a string contém caracteres não imprimíveis ou binários
	for (let i = 0; i < Math.min(str.length, 1000); i++) {
		const charCode = str.charCodeAt(i);
		// Caracteres de controle (exceto quebras de linha e tabs) ou caracteres não-ASCII
		if ((charCode < 32 && ![9, 10, 13].includes(charCode)) || charCode > 127) {
			return true;
		}
	}
	return false;
};

// Função auxiliar para verificar se o conteúdo é uma imagem base64 válida
const isValidBase64Image = (str: string, mimeType: string): boolean => {
	if (!str || str.length === 0) return false;
	if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(mimeType))
		return false;

	try {
		// Verifica se a string começa com um prefixo de data URL
		if (str.startsWith('data:image/')) {
			return true;
		}

		// Se for conteúdo binário, provavelmente é uma imagem válida
		if (isBinaryContent(str)) {
			return true;
		}

		// Tenta verificar se é uma string base64 válida
		// Permite alguns caracteres especiais que podem aparecer em base64 válido
		return /^[A-Za-z0-9+/=\r\n\s]+$/.test(str);
	} catch (e) {
		console.error('Erro ao validar base64:', e);
		return false;
	}
};

// Função para converter dados binários para base64
const binaryToBase64 = (data: string): string => {
	try {
		// Converter dados binários para um array de bytes
		const bytes = new Uint8Array(data.length);
		for (let i = 0; i < data.length; i++) {
			bytes[i] = data.charCodeAt(i) & 0xff;
		}

		// Converter bytes para base64 usando API nativa
		// Dividir em chunks para evitar o erro "Maximum call stack size exceeded"
		const CHUNK_SIZE = 8192; // 8K por chunk
		let result = '';

		for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
			const chunk = bytes.slice(i, i + CHUNK_SIZE);
			result += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
		}

		return result;
	} catch (e) {
		console.error('Erro ao converter binário para base64:', e);
		return '';
	}
};

// Função para converter string para base64 de forma segura
const safeBase64Encode = (str: string): string => {
	try {
		// Se a string já for uma data URL, extrair apenas a parte base64
		if (str.startsWith('data:image/')) {
			const base64Data = str.split(',')[1];
			if (base64Data) return base64Data;
		}

		// Se for conteúdo binário, usar a função especializada
		if (isBinaryContent(str)) {
			console.log('Detectado conteúdo binário, convertendo...');
			return binaryToBase64(str);
		}

		// Verifica se já é base64
		if (/^[A-Za-z0-9+/=\r\n\s]+$/.test(str)) {
			// Remover espaços e quebras de linha que podem estar no base64
			return str.replace(/[\r\n\s]/g, '');
		}

		// Tenta codificar para base64
		// Substitui o idioma `btoa(unescape(encodeURIComponent(str)))` (unescape é deprecated):
		// usamos TextEncoder para obter os bytes UTF-8 e então convertemos para a string
		// binária esperada por btoa. O resultado é idêntico ao do truque legado.
		const utf8Bytes = new TextEncoder().encode(str);
		let binary = '';
		for (let i = 0; i < utf8Bytes.length; i++) {
			binary += String.fromCharCode(utf8Bytes[i]);
		}
		return btoa(binary);
	} catch (e) {
		console.error('Erro ao codificar para base64:', e);
		return '';
	}
};

// Função para criar uma URL de dados para a imagem
const createImageDataUrl = (base64Data: string, mimeType: string): string => {
	return `data:${mimeType};base64,${base64Data}`;
};

const formatJsonForDisplay = (value: string, mimeType?: string): string => {
	const trimmedValue = value.trim();
	const shouldTryJson =
		mimeType?.toLowerCase().includes('json') ||
		trimmedValue.startsWith('{') ||
		trimmedValue.startsWith('[');
	if (!shouldTryJson) return value;

	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return value;
	}
};

const getResponseHeaders = (response: InterceptedResponse): Record<string, string> =>
	response.response?.headers ?? response.headers;

const getResponseBody = (response: InterceptedResponse): string | undefined =>
	response.response && 'body' in response.response ? response.response.body : response.body;

const sanitizeHeaderTestId = (key: string): string => key.replace(/[^a-zA-Z0-9_-]/g, '-');

const HeaderViewer: React.FC<{
	headers: Record<string, string>;
	emptyMessage: string;
	testIdPrefix: string;
}> = ({ headers, emptyMessage, testIdPrefix }) => {
	const entries = Object.entries(headers);

	return (
		<ScrollArea className="h-[260px] rounded-md border bg-muted/20">
			<div className="min-w-full text-sm">
				{entries.length > 0 ? (
					entries.map(([key, value]) => (
						<div
							key={key}
							data-testid={`${testIdPrefix}-header-row-${sanitizeHeaderTestId(key)}`}
							className="grid grid-cols-1 gap-1 border-b px-3 py-2 last:border-b-0 md:grid-cols-[minmax(140px,220px)_minmax(0,1fr)] md:gap-4"
						>
							<div className="font-mono text-xs font-semibold text-muted-foreground break-all">
								{key}
							</div>
							<div className="font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
								{value}
							</div>
						</div>
					))
				) : (
					<div className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</div>
				)}
			</div>
		</ScrollArea>
	);
};

const responseDialogActionButtonClass =
	'inline-flex h-9 items-center gap-2 px-3 text-sm leading-none';
const responseDialogActionIconClass = 'shrink-0 text-base leading-none';

const ResponseDialog: React.FC<ResponseDialogProps> = ({
	open,
	onOpenChange,
	response,
	requestId,
	onApprove,
	onIgnore,
	onMock,
	onEdit,
	onCancel,
	isEditing,
	readOnly = false,
	ruleCreated = false,
}) => {
	const [status, setStatus] = useState('');
	const [headers, setHeaders] = useState('');
	const [body, setBody] = useState('');
	const [isImageResponse, setIsImageResponse] = useState(false);
	const [imageData, setImageData] = useState('');
	const [imageZoom, setImageZoom] = useState(100); // Zoom em porcentagem
	const [blobUrls, setBlobUrls] = useState<string[]>([]); // Armazenar URLs de Blob para limpeza

	useEffect(() => {
		if (response) {
			const responseHeaders = getResponseHeaders(response);
			const responseBody = getResponseBody(response);

			// Resetar o zoom quando uma nova resposta for carregada
			setImageZoom(100);

			setStatus(response.status.toString());
			setHeaders(JSON.stringify(responseHeaders, null, 2));
			setBody(responseBody ?? '');

			// Verificar se é uma resposta de imagem
			const supportedImageTypes = [
				'image/png',
				'image/jpeg',
				'image/gif',
				'image/webp',
				'image/svg+xml',
			];
			const isImage = response.mimeType && supportedImageTypes.includes(response.mimeType);
			setIsImageResponse(Boolean(isImage));

			// Se for uma imagem, preparar os dados para exibição
			if (isImage && response.mimeType && responseBody) {
				try {
					// Verificar se o body já está em base64 ou é uma data URL
					if (responseBody.startsWith('data:image/')) {
						// Já é uma data URL completa
						const base64Data = responseBody.split(',')[1] || '';
						setImageData(base64Data);
						console.log('Processando imagem: Data URL detectada');
					} else if (isValidBase64Image(responseBody, response.mimeType)) {
						if (isBinaryContent(responseBody)) {
							console.log('Processando imagem: Conteúdo binário detectado');

							// Abordagem alternativa usando Blob e FileReader para dados binários
							try {
								// Criar um array de bytes a partir dos dados binários
								const bytes = new Uint8Array(responseBody.length);
								for (let i = 0; i < responseBody.length; i++) {
									bytes[i] = responseBody.charCodeAt(i) & 0xff;
								}

								// Criar um Blob com os bytes e o tipo MIME correto
								const blob = new Blob([bytes], { type: response.mimeType });

								// Criar uma URL para o Blob
								const blobUrl = URL.createObjectURL(blob);

								// Usar a URL diretamente na imagem
								setImageData('blob-url:' + blobUrl);
								// Armazenar a URL do Blob para limpeza posterior
								setBlobUrls((prev) => [...prev, blobUrl]);
								console.log('Imagem processada como Blob URL');
							} catch (blobError) {
								console.error('Erro ao processar imagem como Blob:', blobError);
								const encodedData = safeBase64Encode(responseBody);
								setImageData(encodedData);
							}
						} else {
							// É uma string base64 válida
							console.log('Processando imagem: Base64 válido detectado');
							setImageData(responseBody.replace(/[\r\n\s]/g, ''));
						}
					} else {
						// Tentar converter para base64
						console.log('Processando imagem: Tentando converter para base64');
						const encodedData = safeBase64Encode(responseBody);
						setImageData(encodedData);

						// Registrar informações de debug
						console.log(`Imagem processada: ${response.mimeType}, tamanho: ${encodedData.length}`);
					}
				} catch (e) {
					console.error('Erro ao processar imagem:', e);
					setImageData('');
				}
			} else {
				setImageData('');
			}
		}
	}, [response]);

	// Limpar URLs de Blob quando o componente for desmontado
	useEffect(() => {
		return () => {
			// Revogar todas as URLs de Blob criadas
			blobUrls.forEach((url) => {
				try {
					URL.revokeObjectURL(url);
					console.log('URL de Blob revogada:', url);
				} catch (e) {
					console.error('Erro ao revogar URL de Blob:', e);
				}
			});
		};
	}, [blobUrls]);

	if (!response || !requestId) {
		return null;
	}

	const responseHeaders = getResponseHeaders(response);
	const responseBody = getResponseBody(response);
	const requestHeaders = response.request?.headers ?? {};
	const displayMethod = response.method ?? 'Método ausente';
	const displayMimeType = response.mimeType ?? 'Sem Content-Type';
	const formattedResponseBody =
		responseBody !== undefined ? formatJsonForDisplay(responseBody, response.mimeType) : '';

	const handleApprove = async () => {
		if (!requestId) return;

		const modifications: ResponseModifications = {};

		if (isEditing) {
			// Adicionar modificações se estiver editando
			// Garantir que o status code seja um número válido
			if (status && status.trim() !== '') {
				const statusNumber = Number.parseInt(status, 10);
				if (!Number.isNaN(statusNumber)) {
					modifications.status = statusNumber;
				} else {
					alert('Status code inválido. Deve ser um número.');
					return;
				}
			}

			try {
				modifications.headers = JSON.parse(headers);
			} catch (e) {
				alert('Formato de headers inválido. Deve ser um objeto JSON válido.');
				return;
			}

			if (responseBody !== undefined) {
				modifications.body = body;
			}
		}

		const success = await onApprove(requestId, modifications);
		if (success) {
			onOpenChange(false);
		}
	};

	const handleIgnore = async () => {
		if (!requestId) return;
		const success = await onIgnore(requestId);
		if (success) {
			onOpenChange(false);
		}
	};

	const handleMock = () => {
		if (!response || response.captureError) return;
		onMock(response);
		onOpenChange(false);
	};

	const handleEdit = () => {
		onEdit();
	};

	const handleCancel = () => {
		if (response) {
			setStatus(response.status.toString());
			setHeaders(JSON.stringify(getResponseHeaders(response), null, 2));
			setBody(getResponseBody(response) ?? '');
		}
		onCancel();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between">
						<span className="flex items-center gap-2">
							<Badge
								variant={
									response.status >= 400
										? 'destructive'
										: response.status >= 300
											? 'secondary'
											: 'default'
								}
								className="text-xs"
							>
								{displayMethod}
							</Badge>
							<span className="font-mono text-sm break-all" title={response.url}>
								{truncateUrl(response.url)}
							</span>
							{isEditing && (
								<Badge variant="outline" className="ml-2 text-xs">
									Modo de Edição
								</Badge>
							)}
							{readOnly && (
								<Badge variant="outline" className="ml-2 text-xs">
									Somente Leitura
								</Badge>
							)}
						</span>
						<DialogClose asChild>
							<Button variant="ghost" size="icon" onClick={handleCancel}>
								<Icon name="X" className="h-4 w-4" />
								<span className="sr-only">Fechar</span>
							</Button>
						</DialogClose>
					</DialogTitle>
					<DialogDescription className="sr-only">
						Visualize e manipule os detalhes da requisição{' '}
						{readOnly ? 'do histórico' : 'interceptada'}. Edite status, cabeçalhos e corpo antes de
						aprovar, ignorar ou criar um mock.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
						<div>
							<div className="flex items-center gap-1 mb-1">
								<span className="font-medium">URL:</span>
								<span className="truncate max-w-[300px]">{response.url}</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="font-medium">Método:</span>
								<Badge variant="outline" className="text-xs">
									{displayMethod}
								</Badge>
							</div>
						</div>
						<div>
							<div className="flex items-center gap-1 mb-1">
								<span className="font-medium">Tipo:</span>
								<span>{response.type}</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="font-medium">MIME Type:</span>
								<span>{displayMimeType}</span>
							</div>
						</div>
					</div>
					<div className="flex flex-wrap justify-start gap-2 lg:justify-end">
						<Button
							variant={ruleCreated ? 'default' : 'outline'}
							size="sm"
							className={responseDialogActionButtonClass}
							onClick={handleMock}
							disabled={ruleCreated || !!response.captureError}
						>
							{ruleCreated ? (
								<>
									<Icon
										name="check"
										className={responseDialogActionIconClass}
										data-testid="response-dialog-icon-check"
									/>
									<span>Mock Criado</span>
								</>
							) : (
								<>
									<Icon
										name="content_copy"
										className={responseDialogActionIconClass}
										data-testid="response-dialog-icon-content_copy"
									/>
									<span>Criar Mock</span>
								</>
							)}
						</Button>

						{!readOnly && (
							<Button
								variant="outline"
								size="sm"
								className={responseDialogActionButtonClass}
								onClick={handleIgnore}
							>
								<Icon
									name="close"
									className={responseDialogActionIconClass}
									data-testid="response-dialog-icon-close"
								/>
								<span>Ignorar</span>
							</Button>
						)}

						{!readOnly && (
							<Button
								variant="outline"
								size="sm"
								className={responseDialogActionButtonClass}
								onClick={handleEdit}
								disabled={isEditing}
							>
								<Icon
									name="edit"
									className={responseDialogActionIconClass}
									data-testid="response-dialog-icon-edit"
								/>
								<span>Editar</span>
							</Button>
						)}
					</div>
				</div>

				{response.captureError && (
					<div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<div className="flex items-start gap-2">
							<Icon name="error" className="mt-0.5 h-4 w-4" />
							<span className="break-words">Falha na captura: {response.captureError}</span>
						</div>
					</div>
				)}

				{response.bodyUnavailableReason && (
					<div className="mb-4 rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
						<div className="flex items-start gap-2">
							<Icon name="info" className="mt-0.5 h-4 w-4" />
							<span className="break-words">{response.bodyUnavailableReason}</span>
						</div>
					</div>
				)}

				<div className="flex-1 overflow-y-auto pr-2">
					<Tabs defaultValue="request" className="w-full h-full flex flex-col">
						<TabsList className="grid grid-cols-2 mb-4">
							<TabsTrigger value="request">Request</TabsTrigger>
							<TabsTrigger value="response">Response</TabsTrigger>
						</TabsList>

						<ScrollArea className="flex-1 pr-4">
							<TabsContent value="request" className="data-[state=active]:block">
								<div className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label htmlFor="requestMethod" className="block text-sm font-medium mb-1">
												Método
											</label>
											<Input
												type="text"
												id="requestMethod"
												value={displayMethod}
												disabled={true}
												className="font-mono"
											/>
										</div>
										<div>
											<label htmlFor="requestType" className="block text-sm font-medium mb-1">
												Tipo
											</label>
											<Input
												type="text"
												id="requestType"
												value={response.type}
												disabled={true}
												className="font-mono"
											/>
										</div>
									</div>
									<div>
										<label htmlFor="requestUrl" className="block text-sm font-medium mb-1">
											URL
										</label>
										<Input
											type="text"
											id="requestUrl"
											value={response.url}
											disabled={true}
											className="font-mono"
										/>
									</div>

									<div>
										<div className="block text-sm font-medium mb-1">Request Headers</div>
										<HeaderViewer
											headers={requestHeaders}
											emptyMessage="Headers de request ausentes."
											testIdPrefix="request"
										/>
									</div>
									{response.request?.postData && (
										<div>
											<label htmlFor="requestPostData" className="block text-sm font-medium mb-1">
												Request Body
											</label>
											<ScrollArea className="h-[200px] border rounded-md">
												<textarea
													id="requestPostData"
													value={response.request.postData}
													readOnly
													className="w-full p-3 font-mono text-sm min-h-[200px] focus:outline-hidden"
												/>
											</ScrollArea>
										</div>
									)}
								</div>
							</TabsContent>

							<TabsContent value="response" className="data-[state=active]:block">
								<div className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label htmlFor="responseStatus" className="block text-sm font-medium mb-1">
												Status Code
											</label>
											<Input
												type="text"
												id="responseStatus"
												value={status}
												onChange={(e) => setStatus(e.target.value)}
												disabled={!isEditing || readOnly}
												className="font-mono"
											/>
										</div>
										<div>
											<label
												htmlFor="responseStatusText"
												className="block text-sm font-medium mb-1"
											>
												Status Text
											</label>
											<Input
												type="text"
												id="responseStatusText"
												value={response.statusText}
												disabled={true}
												className="font-mono"
											/>
										</div>
									</div>

									<div>
										<div className="block text-sm font-medium mb-1">Response Headers</div>
										<HeaderViewer
											headers={responseHeaders}
											emptyMessage="Headers de response ausentes."
											testIdPrefix="response"
										/>

										{isEditing && !readOnly && (
											<div className="mt-4">
												<label htmlFor="responseHeaders" className="block text-sm font-medium mb-1">
													Editar Headers (JSON)
												</label>
												<ScrollArea className="h-[200px] border rounded-md">
													<textarea
														id="responseHeaders"
														value={headers}
														onChange={(e) => setHeaders(e.target.value)}
														className="w-full p-3 font-mono text-sm min-h-[200px] focus:outline-hidden"
														disabled={!isEditing || readOnly}
													/>
												</ScrollArea>
											</div>
										)}
									</div>

									<div>
										<div className="flex justify-between items-center mb-1">
											<label htmlFor="responseBody" className="block text-sm font-medium">
												Response Body
											</label>
											<div className="text-sm text-muted-foreground">
												MIME Type:{' '}
												<Badge variant="outline" className="text-xs">
													{displayMimeType}
												</Badge>
											</div>
										</div>

										{responseBody === undefined ? (
											<div className="h-[120px] rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
												{response.bodyUnavailableReason || 'Corpo da resposta indisponível.'}
											</div>
										) : isImageResponse ? (
											<div className="border rounded-md h-[400px] overflow-hidden flex flex-col">
												<div className="bg-muted p-2 flex justify-between items-center border-b">
													<div className="text-sm font-medium">Visualização de Imagem</div>
													{imageData && (
														<div className="flex items-center gap-2">
															<div className="flex items-center gap-1">
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 w-7 p-0 rounded-full"
																	onClick={() => setImageZoom(Math.max(50, imageZoom - 10))}
																	title="Diminuir zoom"
																	disabled={imageZoom <= 50}
																>
																	<Icon name="zoom_out" className="h-4 w-4" />
																</Button>
																<span className="text-xs w-12 text-center">{imageZoom}%</span>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 w-7 p-0 rounded-full"
																	onClick={() => setImageZoom(Math.min(200, imageZoom + 10))}
																	title="Aumentar zoom"
																	disabled={imageZoom >= 200}
																>
																	<Icon name="zoom_in" className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 w-7 p-0 rounded-full"
																	onClick={() => setImageZoom(100)}
																	title="Resetar zoom"
																	disabled={imageZoom === 100}
																>
																	<Icon name="restart_alt" className="h-4 w-4" />
																</Button>
															</div>
															<Button
																variant="outline"
																size="sm"
																className="flex items-center gap-1 h-7 px-2"
																onClick={() => {
																	// Criar um link para download da imagem
																	let url: string;
																	if (imageData.startsWith('blob-url:')) {
																		// Já é uma URL de Blob
																		url = imageData.substring(9);
																	} else {
																		// Criar uma data URL
																		url = createImageDataUrl(imageData, displayMimeType);
																	}

																	const a = document.createElement('a');
																	a.href = url;
																	a.download = `image.${displayMimeType.split('/')[1] || 'png'}`;
																	document.body.appendChild(a);
																	a.click();
																	document.body.removeChild(a);
																}}
															>
																<Icon name="download" className="h-3 w-3" />
																<span>Download</span>
															</Button>
														</div>
													)}
												</div>
												<div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-[#1a1a1a]">
													{imageData ? (
														<>
															<img
																src={
																	imageData.startsWith('blob-url:')
																		? imageData.substring(9) // Remover o prefixo 'blob-url:'
																		: createImageDataUrl(imageData, displayMimeType)
																}
																alt="Response"
																style={{
																	transform: `scale(${imageZoom / 100})`,
																	transformOrigin: 'center center',
																	transition: 'transform 0.2s ease-in-out',
																}}
																className="max-w-full max-h-full object-contain"
																onError={(e) => {
																	console.error('Erro ao carregar imagem');
																	e.currentTarget.style.display = 'none';
																	e.currentTarget.nextElementSibling?.classList.remove('hidden');
																}}
															/>
															<div className="text-muted-foreground hidden p-4 text-center">
																<div className="mb-2">
																	<Icon name="error" className="h-6 w-6 text-destructive" />
																</div>
																<p>Não foi possível exibir a imagem.</p>
																<p className="text-xs mt-1">
																	O conteúdo pode estar corrompido ou em um formato não suportado.
																</p>
															</div>
														</>
													) : (
														<div className="text-muted-foreground p-4 text-center">
															<div className="mb-2">
																<Icon name="image_not_supported" className="h-6 w-6" />
															</div>
															<p>Imagem não disponível</p>
															<p className="text-xs mt-1">
																Não foi possível processar o conteúdo como imagem.
															</p>
														</div>
													)}
												</div>
											</div>
										) : isEditing && !readOnly ? (
											<ScrollArea className="h-[300px] border rounded-md">
												<textarea
													id="responseBody"
													value={body}
													onChange={(e) => setBody(e.target.value)}
													className="w-full p-3 font-mono text-sm min-h-[300px] focus:outline-hidden"
												/>
											</ScrollArea>
										) : (
											<ScrollArea className="h-[360px] rounded-md border bg-muted/20">
												<pre
													id="responseBody"
													data-testid="response-body-viewer"
													className="min-h-[220px] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
												>
													{formattedResponseBody}
												</pre>
											</ScrollArea>
										)}
									</div>
								</div>
							</TabsContent>
						</ScrollArea>
					</Tabs>
				</div>

				<DialogFooter className="mt-4">
					{!readOnly ? (
						<>
							<Button size="sm" className={responseDialogActionButtonClass} onClick={handleApprove}>
								<Icon name="check" className={responseDialogActionIconClass} />
								{isEditing ? 'Salvar e Aprovar' : 'Aprovar'}
							</Button>

							{isEditing && (
								<Button
									variant="outline"
									size="sm"
									className={responseDialogActionButtonClass}
									onClick={handleCancel}
								>
									<Icon name="cancel" className={responseDialogActionIconClass} />
									Cancelar
								</Button>
							)}
						</>
					) : null}

					<DialogClose asChild>
						<Button variant="outline" size="sm" className={responseDialogActionButtonClass}>
							<Icon name="close" className={responseDialogActionIconClass} />
							Fechar
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default ResponseDialog;
