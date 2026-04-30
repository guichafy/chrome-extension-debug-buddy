import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Action, MockAction, BreakpointAction, MockLatency } from '@/types/rules';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ActionEditorProps {
	action: Action;
	onChange: (action: Action) => void;
}

const createEmptyMockAction = (): MockAction => ({
	type: 'mock',
	enabled: true,
	status: 200,
	headers: {},
});

export const ActionEditor: React.FC<ActionEditorProps> = ({ action, onChange }) => {
	const [activeTab, setActiveTab] = useState<string>('response');
	const [headerName, setHeaderName] = useState('');
	const [headerValue, setHeaderValue] = useState('');

	// Renderizar editor específico para cada tipo de ação
	const renderActionEditor = () => {
		switch (action.type) {
			case 'mock':
				return renderMockActionEditor(action as MockAction);
			case 'delay':
				return renderDelayActionEditor(action);
			case 'transform':
				return renderTransformActionEditor(action);
			case 'breakpoint':
				return renderBreakpointActionEditor(action as BreakpointAction);
			default:
				return null;
		}
	};

	// Editor para ação de mock
	const renderMockActionEditor = (mockAction: MockAction) => {
		const hasBody = mockAction.body !== undefined;
		const latencyMode = mockAction.latency?.mode ?? 'none';

		// Adicionar um novo header
		const addHeader = () => {
			if (!headerName.trim() || !headerValue.trim()) return;

			const newHeaders = {
				...mockAction.headers,
				[headerName.trim()]: headerValue.trim(),
			};

			onChange({
				...mockAction,
				headers: newHeaders,
			});

			setHeaderName('');
			setHeaderValue('');
		};

		// Remover um header
		const removeHeader = (name: string) => {
			const newHeaders = { ...mockAction.headers };
			delete newHeaders[name];

			onChange({
				...mockAction,
				headers: newHeaders,
			});
		};

		const updateContentType = (value: string) => {
			const updatedAction = { ...mockAction };
			const trimmedValue = value.trim();
			if (trimmedValue) {
				updatedAction.contentType = trimmedValue;
			} else {
				updatedAction.contentType = undefined;
			}
			onChange(updatedAction);
		};

		const updateStatusPhrase = (value: string) => {
			const updatedAction = { ...mockAction };
			const trimmedValue = value.trim();
			if (trimmedValue) {
				updatedAction.statusPhrase = trimmedValue;
			} else {
				updatedAction.statusPhrase = undefined;
			}
			onChange(updatedAction);
		};

		const updateBodyEnabled = (checked: boolean) => {
			const updatedAction = { ...mockAction };
			if (checked) {
				updatedAction.body = mockAction.body ?? '';
			} else {
				updatedAction.body = undefined;
			}
			onChange(updatedAction);
		};

		const updateLatency = (latency?: MockLatency) => {
			const updatedAction = { ...mockAction };
			if (latency) {
				updatedAction.latency = latency;
			} else {
				updatedAction.latency = undefined;
			}
			onChange(updatedAction);
		};

		const parseLatencyValue = (value: string): number | null => {
			const parsedValue = Number.parseInt(value, 10);
			return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
		};

		return (
			<div className="space-y-4">
				<div>
					<Label className="font-medium">Tipo de Resposta</Label>
					<Select
						value={mockAction.type}
						onValueChange={(value: 'mock' | 'breakpoint') => {
							if (value === 'mock') {
								onChange({
									...mockAction,
									type: value,
								});
							} else if (value === 'breakpoint') {
								onChange({
									type: value,
									enabled: true,
									description: 'Pausar para inspeção manual',
								});
							}
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Selecione o tipo de ação" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="mock">Mock Response</SelectItem>
							<SelectItem value="breakpoint">Breakpoint</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="w-full mb-4">
						<TabsTrigger value="response" className="flex-1">
							Resposta
						</TabsTrigger>
						<TabsTrigger value="headers" className="flex-1">
							Headers
						</TabsTrigger>
						<TabsTrigger value="body" className="flex-1">
							Body
						</TabsTrigger>
						<TabsTrigger value="latency" className="flex-1">
							Latência
						</TabsTrigger>
					</TabsList>

					<TabsContent value="response" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<Label>Status Code</Label>
								<Input
									type="number"
									value={mockAction.status}
									onChange={(e) => {
										const status = Number.parseInt(e.target.value);
										if (!Number.isNaN(status)) {
											onChange({
												...mockAction,
												status,
											});
										}
									}}
									placeholder="200"
								/>
							</div>
							<div>
								<Label>Status Text</Label>
								<Input
									value={mockAction.statusPhrase ?? ''}
									onChange={(e) => updateStatusPhrase(e.target.value)}
									placeholder="Created"
								/>
							</div>
							<div>
								<Label>Content-Type</Label>
								<Input
									value={mockAction.contentType ?? ''}
									onChange={(e) => updateContentType(e.target.value)}
									placeholder="application/json"
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="headers" className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Nome do Header</Label>
								<Input
									value={headerName}
									onChange={(e) => setHeaderName(e.target.value)}
									placeholder="Content-Type"
								/>
							</div>
							<div>
								<Label>Valor do Header</Label>
								<div className="flex space-x-2">
									<Input
										value={headerValue}
										onChange={(e) => setHeaderValue(e.target.value)}
										placeholder="application/json"
									/>
									<Button
										type="button"
										onClick={addHeader}
										disabled={!headerName.trim() || !headerValue.trim()}
									>
										Adicionar
									</Button>
								</div>
							</div>
						</div>

						<div className="border rounded-md p-3 bg-background">
							<h4 className="text-sm font-medium mb-2">Headers Configurados</h4>
							{Object.keys(mockAction.headers).length > 0 ? (
								<div className="space-y-2">
									{Object.entries(mockAction.headers).map(([name, value]) => (
										<div
											key={name}
											className="flex justify-between items-center p-2 bg-muted rounded-md"
										>
											<div>
												<span className="font-medium">{name}:</span> {value}
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => removeHeader(name)}
												className="h-8 w-8 p-0 text-destructive"
											>
												<span className="sr-only">Remover</span>×
											</Button>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">Nenhum header configurado</p>
							)}
						</div>
					</TabsContent>

					<TabsContent value="body" className="space-y-4">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="mock-response-body-enabled"
								checked={hasBody}
								onCheckedChange={(checked) => updateBodyEnabled(checked === true)}
							/>
							<Label htmlFor="mock-response-body-enabled">Enviar body na resposta mockada</Label>
						</div>
						<div>
							<Label>Corpo da Resposta</Label>
							<Textarea
								value={mockAction.body ?? ''}
								onChange={(e) => {
									onChange({
										...mockAction,
										body: e.target.value,
									});
								}}
								placeholder='{"success": true, "message": "Resposta mockada"}'
								className="font-mono h-64"
								disabled={!hasBody}
							/>
							{!hasBody && (
								<p className="mt-2 text-sm text-muted-foreground">
									O mock será enviado sem corpo de resposta.
								</p>
							)}
						</div>
					</TabsContent>

					<TabsContent value="latency" className="space-y-4">
						<div>
							<Label>Latência artificial</Label>
							<Select
								value={latencyMode}
								onValueChange={(value: 'none' | 'fixed' | 'range') => {
									if (value === 'none') {
										updateLatency();
									} else if (value === 'fixed') {
										const delayMs =
											mockAction.latency?.mode === 'fixed' ? mockAction.latency.delayMs : 0;
										updateLatency({ mode: 'fixed', delayMs });
									} else {
										const previousDelay =
											mockAction.latency?.mode === 'fixed' ? mockAction.latency.delayMs : 0;
										const minMs =
											mockAction.latency?.mode === 'range'
												? mockAction.latency.minMs
												: previousDelay;
										const maxMs =
											mockAction.latency?.mode === 'range'
												? mockAction.latency.maxMs
												: previousDelay;
										updateLatency({ mode: 'range', minMs, maxMs });
									}
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione a latência" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Sem latência artificial</SelectItem>
									<SelectItem value="fixed">Fixa</SelectItem>
									<SelectItem value="range">Range dinâmico</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{mockAction.latency?.mode === 'fixed' && (
							<div>
								<Label>Delay em ms</Label>
								<Input
									type="number"
									min={0}
									value={mockAction.latency.delayMs}
									onChange={(e) => {
										const delayMs = parseLatencyValue(e.target.value);
										if (delayMs !== null) {
											updateLatency({ mode: 'fixed', delayMs });
										}
									}}
								/>
							</div>
						)}

						{mockAction.latency?.mode === 'range' && (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<Label>Delay mínimo em ms</Label>
									<Input
										type="number"
										min={0}
										value={mockAction.latency.minMs}
										onChange={(e) => {
											const minMs = parseLatencyValue(e.target.value);
											if (minMs !== null && mockAction.latency?.mode === 'range') {
												updateLatency({ ...mockAction.latency, minMs });
											}
										}}
									/>
								</div>
								<div>
									<Label>Delay máximo em ms</Label>
									<Input
										type="number"
										min={0}
										value={mockAction.latency.maxMs}
										onChange={(e) => {
											const maxMs = parseLatencyValue(e.target.value);
											if (maxMs !== null && mockAction.latency?.mode === 'range') {
												updateLatency({ ...mockAction.latency, maxMs });
											}
										}}
									/>
								</div>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		);
	};

	// Editor para ação de delay (placeholder para futuras implementações)
	const renderDelayActionEditor = (delayAction: Action) => (
		<div className="space-y-4">
			<div>
				<Label className="font-medium">Tipo de Ação</Label>
				<Select
					value={delayAction.type}
					onValueChange={(value: 'mock' | 'breakpoint') => {
						if (value === 'mock') {
							onChange(createEmptyMockAction());
						} else if (value === 'breakpoint') {
							onChange({
								type: value,
								enabled: true,
								description: 'Pausar para inspeção manual',
							});
						}
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Selecione o tipo de ação" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="mock">Mock Response</SelectItem>
						<SelectItem value="breakpoint">Breakpoint</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<p className="text-sm text-muted-foreground">
				Apenas o tipo "Mock Response" está disponível nesta versão.
			</p>
		</div>
	);

	// Editor para ação de transformação (placeholder para futuras implementações)
	const renderTransformActionEditor = (transformAction: Action) => (
		<div className="space-y-4">
			<div>
				<Label className="font-medium">Tipo de Ação</Label>
				<Select
					value={transformAction.type}
					onValueChange={(value: 'mock' | 'breakpoint') => {
						if (value === 'mock') {
							onChange(createEmptyMockAction());
						} else if (value === 'breakpoint') {
							onChange({
								type: value,
								enabled: true,
								description: 'Pausar para inspeção manual',
							});
						}
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Selecione o tipo de ação" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="mock">Mock Response</SelectItem>
						<SelectItem value="breakpoint">Breakpoint</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<p className="text-sm text-muted-foreground">
				Apenas o tipo "Mock Response" está disponível nesta versão.
			</p>
		</div>
	);

	// Editor para ação de breakpoint
	const renderBreakpointActionEditor = (breakpointAction: BreakpointAction) => (
		<div className="space-y-4">
			<div>
				<Label className="font-medium">Tipo de Ação</Label>
				<Select
					value={breakpointAction.type}
					onValueChange={(value: 'mock' | 'breakpoint') => {
						if (value === 'mock') {
							onChange(createEmptyMockAction());
						} else {
							onChange({
								...breakpointAction,
								type: value,
							});
						}
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Selecione o tipo de ação" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="mock">Mock Response</SelectItem>
						<SelectItem value="breakpoint">Breakpoint</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label className="font-medium">Descrição (opcional)</Label>
				<Textarea
					value={breakpointAction.description || ''}
					onChange={(e) => {
						onChange({
							...breakpointAction,
							description: e.target.value,
						});
					}}
					placeholder="Descrição para exibir quando a requisição for pausada"
					className="h-24"
				/>
			</div>

			<div className="bg-blue-50 p-4 rounded-md border border-blue-200">
				<h4 className="text-sm font-medium text-blue-800 mb-2">Sobre o Breakpoint</h4>
				<p className="text-sm text-blue-700">
					O breakpoint pausa a requisição e permite que você inspecione e modifique a resposta
					manualmente. Quando uma requisição corresponder a esta regra, ela aparecerá na aba
					"Interceptação" aguardando sua ação.
				</p>
			</div>
		</div>
	);

	return <div className="space-y-4">{renderActionEditor()}</div>;
};
