import { useTranslation } from 'react-i18next';
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
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Matcher,
	UrlMatcher,
	MethodMatcher,
	HeaderMatcher,
	BodyMatcher,
	RuleStage,
} from '@/types/rules';

interface MatcherEditorProps {
	matcher: Matcher;
	onChange: (matcher: Matcher) => void;
	onRemove: () => void;
	canRemove: boolean;
	// Stage da regra que contém esse matcher. Usado para bloquear
	// `header.headerType='response'` em regras `stage='request'` (não há
	// resposta antes do envio) e ajustar labels do body matcher.
	stage?: RuleStage;
}

export const MatcherEditor: React.FC<MatcherEditorProps> = ({
	matcher,
	onChange,
	onRemove,
	canRemove,
	stage,
}) => {
	const { t } = useTranslation(['ruleEditor', 'rules']);
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
						{t('matcher.useRegex')}
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
					urlMatcher.isRegex ? t('matcher.urlRegexPlaceholder') : t('matcher.urlPlaceholder')
				}
			/>
			{urlMatcher.isRegex && (
				<p className="text-xs text-muted-foreground">{t('matcher.urlRegexHelp')}</p>
			)}
		</div>
	);

	// Editor para matcher de método HTTP. O schema aceita `method: string | string[]`
	// (multi-select usado pelo `UnifiedMatcherEditor` do wizard). Aqui na lista
	// avancada, exibimos apenas a primeira opcao da lista para o Select; ao salvar,
	// gravamos sempre como string unica.
	const renderMethodMatcherEditor = (methodMatcher: MethodMatcher) => {
		const selectedValue = Array.isArray(methodMatcher.method)
			? methodMatcher.method.includes('ANY')
				? 'ANY'
				: (methodMatcher.method[0] ?? 'ANY')
			: methodMatcher.method;
		return (
			<div className="space-y-2">
				<Label className="font-medium">{t('matcher.types.method')}</Label>
				<Select
					value={selectedValue}
					onValueChange={(value) => {
						onChange({
							...methodMatcher,
							method: value,
						});
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder={t('matcher.methodPlaceholder')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ANY">{t('matcher.anyMethod')}</SelectItem>
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
	};

	// Editor para matcher de header
	const renderHeaderMatcherEditor = (headerMatcher: HeaderMatcher) => {
		const stageBlocksResponse = stage === 'request';
		const invalidForStage = stageBlocksResponse && headerMatcher.headerType === 'response';
		return (
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="font-medium">{t('matcher.types.header')}</Label>
					<Select
						value={headerMatcher.headerType}
						onValueChange={(value: 'request' | 'response') => {
							if (stageBlocksResponse && value === 'response') return;
							onChange({
								...headerMatcher,
								headerType: value,
							});
						}}
					>
						<SelectTrigger className="w-[180px]" data-testid="header-matcher-type-trigger">
							<SelectValue placeholder={t('matcher.headerTypePlaceholder')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="request">{t('rules:stages.request')}</SelectItem>
							<SelectItem
								value="response"
								disabled={stageBlocksResponse}
								data-testid="header-matcher-type-response-option"
							>
								{stageBlocksResponse
									? t('matcher.responseUnavailableInRequest')
									: t('rules:stages.response')}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{invalidForStage && (
					<p
						className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300"
						data-testid="header-matcher-stage-warning"
						role="alert"
					>
						{t('matcher.responseHeaderInRequestStage')}
					</p>
				)}
				<div className="grid grid-cols-2 gap-2">
					<div>
						<Label className="text-sm">{t('matcher.name')}</Label>
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
						<Label className="text-sm">{t('matcher.value')}</Label>
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
	};

	// Editor para matcher de body. Em `stage='response'` casamos contra o corpo
	// retornado pelo servidor; em `stage='request'` (ou stage indefinido) contra
	// o `postData` enviado pelo cliente. O label muda pra deixar o alvo óbvio.
	const renderBodyMatcherEditor = (bodyMatcher: BodyMatcher) => {
		const bodyLabel = stage === 'response' ? t('matcher.bodyResponse') : t('matcher.bodyRequest');
		return (
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="font-medium" data-testid="body-matcher-label">
						{bodyLabel}
					</Label>
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
							{t('matcher.useRegex')}
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
					<p className="text-xs text-muted-foreground">{t('matcher.bodyRegexHelp')}</p>
				)}
				<div>
					<Label className="text-sm">{t('matcher.contentTypeOptional')}</Label>
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
	};

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
						{t(`matcher.types.${matcher.type}`)}
					</Label>
				</div>
				{canRemove && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-8 w-8 p-0 text-destructive"
					>
						<LucideIcon name="trash" className="h-4 w-4" />
						<span className="sr-only">{t('matcher.remove')}</span>
					</Button>
				)}
			</div>
			{renderMatcherEditor()}
		</div>
	);
};
