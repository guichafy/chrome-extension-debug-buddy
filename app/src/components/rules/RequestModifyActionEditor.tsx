import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { HeaderOps, RequestModifyAction } from '@/types/rules';
import { HeaderOpsEditor } from './HeaderOpsEditor';

interface RequestModifyActionEditorProps {
	action: RequestModifyAction;
	onChange: (action: RequestModifyAction) => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

// Extrai apenas o subset HeaderOps de um RequestModifyAction.
function pickHeaderOps(action: RequestModifyAction): HeaderOps {
	return {
		setHeaders: action.setHeaders,
		addHeaders: action.addHeaders,
		removeHeaders: action.removeHeaders,
	};
}

export const RequestModifyActionEditor: React.FC<RequestModifyActionEditorProps> = ({
	action,
	onChange,
}) => {
	const [activeTab, setActiveTab] = useState('basic');
	const overrideUrl = action.url !== undefined;
	const overrideMethod = action.method !== undefined;
	const overrideBody = action.body !== undefined;

	const handleUrlEnabled = (next: boolean) => {
		if (next) {
			onChange({ ...action, url: action.url ?? '' });
		} else {
			const { url: _omit, ...rest } = action;
			onChange(rest);
		}
	};

	const handleUrlChange = (value: string) => {
		onChange({ ...action, url: value });
	};

	const handleMethodEnabled = (next: boolean) => {
		if (next) {
			onChange({ ...action, method: action.method ?? 'GET' });
		} else {
			const { method: _omit, ...rest } = action;
			onChange(rest);
		}
	};

	const handleMethodChange = (value: string) => {
		onChange({ ...action, method: value });
	};

	const handleBodyEnabled = (next: boolean) => {
		if (next) {
			onChange({ ...action, body: action.body ?? '' });
		} else {
			const { body: _omit, ...rest } = action;
			onChange(rest);
		}
	};

	const handleBodyChange = (value: string) => {
		onChange({ ...action, body: value });
	};

	const handleHeaderOpsChange = (next: HeaderOps) => {
		onChange({
			...action,
			setHeaders: next.setHeaders,
			addHeaders: next.addHeaders,
			removeHeaders: next.removeHeaders,
		});
	};

	return (
		<div className="space-y-4" data-testid="request-modify-action-editor">
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full">
					<TabsTrigger value="basic" className="flex-1">
						URL & Método
					</TabsTrigger>
					<TabsTrigger value="headers" className="flex-1">
						Headers
					</TabsTrigger>
					<TabsTrigger value="body" className="flex-1">
						Body
					</TabsTrigger>
				</TabsList>

				<TabsContent value="basic" className="space-y-4">
					<div className="rounded-md border bg-card p-3">
						<div className="mb-2 flex items-center gap-2">
							<Checkbox
								id="request-modify-url-enabled"
								checked={overrideUrl}
								onCheckedChange={(checked) => handleUrlEnabled(checked === true)}
								data-testid="request-modify-url-enabled"
							/>
							<Label htmlFor="request-modify-url-enabled" className="font-medium">
								Sobrescrever URL
							</Label>
						</div>
						<Input
							value={action.url ?? ''}
							onChange={(e) => handleUrlChange(e.target.value)}
							placeholder="https://api.exemplo.com/users/42"
							disabled={!overrideUrl}
							data-testid="request-modify-url-input"
						/>
						<p className="mt-2 text-xs text-muted-foreground">
							Substitui completamente a URL antes do envio (útil pra redirecionar pra outro host ou
							caminho).
						</p>
					</div>

					<div className="rounded-md border bg-card p-3">
						<div className="mb-2 flex items-center gap-2">
							<Checkbox
								id="request-modify-method-enabled"
								checked={overrideMethod}
								onCheckedChange={(checked) => handleMethodEnabled(checked === true)}
								data-testid="request-modify-method-enabled"
							/>
							<Label htmlFor="request-modify-method-enabled" className="font-medium">
								Sobrescrever método HTTP
							</Label>
						</div>
						<Select
							value={action.method ?? 'GET'}
							onValueChange={handleMethodChange}
							disabled={!overrideMethod}
						>
							<SelectTrigger
								id="request-modify-method-select"
								data-testid="request-modify-method-trigger"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HTTP_METHODS.map((m) => (
									<SelectItem key={m} value={m}>
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</TabsContent>

				<TabsContent value="headers" className="space-y-3">
					<HeaderOpsEditor
						value={pickHeaderOps(action)}
						onChange={handleHeaderOpsChange}
						testIdPrefix="request-modify-headers"
					/>
				</TabsContent>

				<TabsContent value="body" className="space-y-3">
					<div className="flex items-center gap-2">
						<Checkbox
							id="request-modify-body-enabled"
							checked={overrideBody}
							onCheckedChange={(checked) => handleBodyEnabled(checked === true)}
							data-testid="request-modify-body-enabled"
						/>
						<Label htmlFor="request-modify-body-enabled" className="font-medium">
							Substituir body
						</Label>
					</div>
					<Textarea
						value={action.body ?? ''}
						onChange={(e) => handleBodyChange(e.target.value)}
						placeholder='{"foo": "bar"}'
						className="h-48 font-mono text-sm"
						disabled={!overrideBody}
						data-testid="request-modify-body-textarea"
					/>
					<p className="text-xs text-muted-foreground">
						O conteúdo substitui o <code>postData</code> da requisição original. Para edições
						pontuais (JSONPath), prefira <code>bodyOperations</code> (em breve no editor).
					</p>
				</TabsContent>
			</Tabs>

			<div
				className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/30"
				data-testid="request-modify-action-info"
			>
				<h4 className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
					<LucideIcon name="info" className="h-4 w-4" />
					Modificador de request
				</h4>
				<p className="text-xs text-blue-800/90 dark:text-blue-200/80">
					Roda no estágio <strong>Request</strong>, antes de a requisição sair pra rede. A chain
					continua após o modify — combine com outras actions (mock, block) na mesma regra.
				</p>
			</div>
		</div>
	);
};

export default RequestModifyActionEditor;
