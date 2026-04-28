import React from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Matcher, UrlMatcher, MethodMatcher, HeaderMatcher, BodyMatcher } from '@/types/rules';

interface MatcherEditorProps {
	matcher: Matcher;
	onChange: (matcher: Matcher) => void;
	onRemove: () => void;
	canRemove: boolean;
}

export const MatcherEditor: React.FC<MatcherEditorProps> = ({
	matcher,
	onChange,
	onRemove,
	canRemove,
}) => {
	// Renderizar editor específico para cada tipo de matcher
	const renderMatcherEditor = () => {
		switch (matcher.type) {
			case 'url':
				return renderUrlMatcherEditor(matcher as UrlMatcher);
			case 'method':
				return renderMethodMatcherEditor(matcher as MethodMatcher);
			case 'header':
				return renderHeaderMatcherEditor(matcher as HeaderMatcher);
			case 'body':
				return renderBodyMatcherEditor(matcher as BodyMatcher);
			default:
				return null;
		}
	};

	// Editor para matcher de URL
	const renderUrlMatcherEditor = (urlMatcher: UrlMatcher) => (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="font-medium">URL</Label>
				<div className="flex items-center space-x-2">
					<Checkbox
						id={`url-regex-${urlMatcher.pattern}`}
						checked={urlMatcher.isRegex}
						onCheckedChange={(checked) => {
							onChange({
								...urlMatcher,
								isRegex: checked === true,
							});
						}}
					/>
					<Label htmlFor={`url-regex-${urlMatcher.pattern}`} className="text-sm">
						Usar Regex
					</Label>
				</div>
			</div>
			<Input
				value={urlMatcher.pattern}
				onChange={(e) => {
					onChange({
						...urlMatcher,
						pattern: e.target.value,
					});
				}}
				placeholder={
					urlMatcher.isRegex ? '^https://api\\.exemplo\\.com/.*$' : 'api.exemplo.com/endpoint'
				}
			/>
			{urlMatcher.isRegex && (
				<p className="text-xs text-muted-foreground">
					Use expressões regulares para interceptar URLs com padrões mais complexos.
				</p>
			)}
		</div>
	);

	// Editor para matcher de método HTTP
	const renderMethodMatcherEditor = (methodMatcher: MethodMatcher) => (
		<div className="space-y-2">
			<Label className="font-medium">Método HTTP</Label>
			<Select
				value={methodMatcher.method}
				onValueChange={(value) => {
					onChange({
						...methodMatcher,
						method: value,
					});
				}}
			>
				<SelectTrigger>
					<SelectValue placeholder="Selecione um método" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="ANY">Qualquer método</SelectItem>
					<SelectItem value="GET">GET</SelectItem>
					<SelectItem value="POST">POST</SelectItem>
					<SelectItem value="PUT">PUT</SelectItem>
					<SelectItem value="DELETE">DELETE</SelectItem>
					<SelectItem value="PATCH">PATCH</SelectItem>
					<SelectItem value="HEAD">HEAD</SelectItem>
					<SelectItem value="OPTIONS">OPTIONS</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);

	// Editor para matcher de header
	const renderHeaderMatcherEditor = (headerMatcher: HeaderMatcher) => (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="font-medium">Header</Label>
				<Select
					value={headerMatcher.headerType}
					onValueChange={(value: 'request' | 'response') => {
						onChange({
							...headerMatcher,
							headerType: value,
						});
					}}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Tipo de Header" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="request">Request</SelectItem>
						<SelectItem value="response">Response</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<div>
					<Label className="text-sm">Nome</Label>
					<Input
						value={headerMatcher.name}
						onChange={(e) => {
							onChange({
								...headerMatcher,
								name: e.target.value,
							});
						}}
						placeholder="Content-Type"
					/>
				</div>
				<div>
					<Label className="text-sm">Valor</Label>
					<Input
						value={headerMatcher.value}
						onChange={(e) => {
							onChange({
								...headerMatcher,
								value: e.target.value,
							});
						}}
						placeholder="application/json"
					/>
				</div>
			</div>
		</div>
	);

	// Editor para matcher de body
	const renderBodyMatcherEditor = (bodyMatcher: BodyMatcher) => (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="font-medium">Body</Label>
				<div className="flex items-center space-x-2">
					<Checkbox
						id={`body-regex-${bodyMatcher.pattern}`}
						checked={bodyMatcher.isRegex}
						onCheckedChange={(checked) => {
							onChange({
								...bodyMatcher,
								isRegex: checked === true,
							});
						}}
					/>
					<Label htmlFor={`body-regex-${bodyMatcher.pattern}`} className="text-sm">
						Usar Regex
					</Label>
				</div>
			</div>
			<Input
				value={bodyMatcher.pattern}
				onChange={(e) => {
					onChange({
						...bodyMatcher,
						pattern: e.target.value,
					});
				}}
				placeholder={bodyMatcher.isRegex ? '"id":\\s*\\d+' : '"id": 123'}
			/>
			{bodyMatcher.isRegex && (
				<p className="text-xs text-muted-foreground">
					Use expressões regulares para encontrar padrões no corpo da requisição.
				</p>
			)}
			<div>
				<Label className="text-sm">Content-Type (opcional)</Label>
				<Input
					value={bodyMatcher.contentType || ''}
					onChange={(e) => {
						onChange({
							...bodyMatcher,
							contentType: e.target.value,
						});
					}}
					placeholder="application/json"
				/>
			</div>
		</div>
	);

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center space-x-2">
					<Checkbox
						id={`matcher-enabled-${matcher.type}`}
						checked={matcher.enabled}
						onCheckedChange={(checked) => {
							onChange({
								...matcher,
								enabled: checked === true,
							});
						}}
					/>
					<Label htmlFor={`matcher-enabled-${matcher.type}`} className="font-medium">
						{matcher.type === 'url'
							? 'URL'
							: matcher.type === 'method'
								? 'Método HTTP'
								: matcher.type === 'header'
									? 'Header'
									: 'Body'}
					</Label>
				</div>
				{canRemove && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-8 w-8 p-0 text-destructive"
					>
						<Icon name="delete" className="h-4 w-4" />
						<span className="sr-only">Remover</span>
					</Button>
				)}
			</div>
			{renderMatcherEditor()}
		</div>
	);
};
