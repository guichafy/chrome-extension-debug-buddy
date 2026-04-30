import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { HeaderMatcher, BodyMatcher, Matcher, MethodMatcher, UrlMatcher } from '@/types/rules';
import { explainMatchers } from '@/domain/ruleMatching';
import { MatcherEditor } from './MatcherEditor';

const HTTP_METHODS = ['ANY', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

interface UnifiedMatcherEditorProps {
	matchers: Matcher[];
	onChange: (matchers: Matcher[]) => void;
}

interface UnifiedView {
	url: UrlMatcher;
	method: MethodMatcher;
	urlIndex: number;
	methodIndex: number;
	others: Matcher[];
}

function methodToArray(value: string | string[]): string[] {
	if (Array.isArray(value)) return value;
	if (!value) return [];
	return [value];
}

function buildUnifiedView(matchers: Matcher[]): UnifiedView {
	const urlIndex = matchers.findIndex((m) => m.type === 'url');
	const methodIndex = matchers.findIndex((m) => m.type === 'method');

	const url: UrlMatcher =
		urlIndex >= 0 && matchers[urlIndex].type === 'url'
			? (matchers[urlIndex] as UrlMatcher)
			: { type: 'url', enabled: true, pattern: '', isRegex: false };

	const method: MethodMatcher =
		methodIndex >= 0 && matchers[methodIndex].type === 'method'
			? (matchers[methodIndex] as MethodMatcher)
			: { type: 'method', enabled: true, method: 'ANY' };

	const others = matchers.filter((m) => m.type !== 'url' && m.type !== 'method');

	return { url, method, urlIndex, methodIndex, others };
}

function commitUrl(matchers: Matcher[], updated: UrlMatcher): Matcher[] {
	const idx = matchers.findIndex((m) => m.type === 'url');
	if (idx === -1) return [updated, ...matchers];
	const copy = [...matchers];
	copy[idx] = updated;
	return copy;
}

function commitMethod(matchers: Matcher[], updated: MethodMatcher): Matcher[] {
	const idx = matchers.findIndex((m) => m.type === 'method');
	if (idx === -1) {
		const urlIdx = matchers.findIndex((m) => m.type === 'url');
		const insertAt = urlIdx === -1 ? matchers.length : urlIdx + 1;
		const copy = [...matchers];
		copy.splice(insertAt, 0, updated);
		return copy;
	}
	const copy = [...matchers];
	copy[idx] = updated;
	return copy;
}

function commitOther(matchers: Matcher[], otherIndexInOthers: number, updated: Matcher): Matcher[] {
	const copy = [...matchers];
	let count = -1;
	for (let i = 0; i < copy.length; i++) {
		if (copy[i].type !== 'url' && copy[i].type !== 'method') {
			count++;
			if (count === otherIndexInOthers) {
				copy[i] = updated;
				return copy;
			}
		}
	}
	return copy;
}

function removeOther(matchers: Matcher[], otherIndexInOthers: number): Matcher[] {
	const copy = [...matchers];
	let count = -1;
	for (let i = 0; i < copy.length; i++) {
		if (copy[i].type !== 'url' && copy[i].type !== 'method') {
			count++;
			if (count === otherIndexInOthers) {
				copy.splice(i, 1);
				return copy;
			}
		}
	}
	return copy;
}

export const UnifiedMatcherEditor: React.FC<UnifiedMatcherEditorProps> = ({
	matchers,
	onChange,
}) => {
	const view = useMemo(() => buildUnifiedView(matchers), [matchers]);
	const { url, method, others } = view;

	const [testUrl, setTestUrl] = useState('https://api.exemplo.com/users/42');
	const [testMethod, setTestMethod] = useState<HttpMethod>('GET');

	const selectedMethods = methodToArray(method.method);
	const isAny = selectedMethods.includes('ANY');

	const urlPatternError = url.enabled && url.pattern.trim().length === 0;
	const methodSelectionError = method.enabled && selectedMethods.length === 0;

	const handleUrlPatternChange = (next: string) => {
		onChange(commitUrl(matchers, { ...url, pattern: next }));
	};

	const handleUrlIsRegexChange = (next: boolean) => {
		onChange(commitUrl(matchers, { ...url, isRegex: next }));
	};

	const handleUrlEnabledChange = (next: boolean) => {
		onChange(commitUrl(matchers, { ...url, enabled: next }));
	};

	const handleMethodEnabledChange = (next: boolean) => {
		onChange(commitMethod(matchers, { ...method, enabled: next }));
	};

	const toggleMethod = (target: HttpMethod) => {
		let nextMethods: string[];
		if (target === 'ANY') {
			nextMethods = isAny ? [] : ['ANY'];
		} else if (selectedMethods.includes(target)) {
			nextMethods = selectedMethods.filter((m) => m !== target && m !== 'ANY');
		} else {
			nextMethods = [...selectedMethods.filter((m) => m !== 'ANY'), target];
		}
		onChange(commitMethod(matchers, { ...method, method: nextMethods }));
	};

	const explanation = useMemo(
		() =>
			explainMatchers([url, method, ...others], {
				url: testUrl,
				method: testMethod === 'ANY' ? 'GET' : testMethod,
				headers: {},
			}),
		[url, method, others, testUrl, testMethod],
	);

	const addOtherMatcher = (type: 'header' | 'body') => {
		let next: Matcher;
		if (type === 'header') {
			next = {
				type: 'header',
				enabled: true,
				name: '',
				value: '',
				headerType: 'request',
			} satisfies HeaderMatcher;
		} else {
			next = {
				type: 'body',
				enabled: true,
				pattern: '',
				isRegex: false,
			} satisfies BodyMatcher;
		}
		onChange([...matchers, next]);
	};

	const updateOther = (otherIdx: number, updated: Matcher) => {
		onChange(commitOther(matchers, otherIdx, updated));
	};

	const removeOtherAt = (otherIdx: number) => {
		onChange(removeOther(matchers, otherIdx));
	};

	return (
		<div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,_22rem)]">
			{/* Coluna esquerda: editor */}
			<div className="space-y-5">
				<section
					data-testid="unified-matcher-url"
					className={cn(
						'rounded-lg border p-4 transition-colors',
						urlPatternError ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-card',
					)}
				>
					<div className="mb-3 flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Checkbox
								id="unified-url-enabled"
								checked={url.enabled}
								onCheckedChange={(checked) => handleUrlEnabledChange(checked === true)}
							/>
							<Label htmlFor="unified-url-enabled" className="font-medium">
								Padrão de URL
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="unified-url-regex"
								checked={url.isRegex}
								onCheckedChange={(checked) => handleUrlIsRegexChange(checked === true)}
							/>
							<Label htmlFor="unified-url-regex" className="text-sm text-muted-foreground">
								Regex
							</Label>
						</div>
					</div>
					<Input
						id="unified-url-pattern"
						value={url.pattern}
						onChange={(e) => handleUrlPatternChange(e.target.value)}
						placeholder={
							url.isRegex ? '^https://api\\.exemplo\\.com/.*$' : 'api.exemplo.com/users/*'
						}
						aria-invalid={urlPatternError || undefined}
						aria-describedby={urlPatternError ? 'unified-url-pattern-error' : undefined}
						data-testid="unified-url-input"
					/>
					{!url.isRegex && (
						<p className="mt-2 text-xs text-muted-foreground">
							Use <code className="rounded bg-muted px-1">*</code> como wildcard (qualquer sequência
							de caracteres). Sem wildcards, casa quando a URL contém o trecho.
						</p>
					)}
					{url.isRegex && (
						<p className="mt-2 text-xs text-muted-foreground">
							Expressão regular completa testada contra a URL.
						</p>
					)}
					{urlPatternError && (
						<p
							id="unified-url-pattern-error"
							role="alert"
							className="mt-2 text-xs font-medium text-destructive"
							data-testid="unified-url-error"
						>
							Informe um padrão de URL — não há valor padrão.
						</p>
					)}
				</section>

				<section
					data-testid="unified-matcher-method"
					className={cn(
						'rounded-lg border p-4',
						methodSelectionError
							? 'border-destructive/60 bg-destructive/5'
							: 'border-border bg-card',
					)}
				>
					<div className="mb-3 flex items-center gap-2">
						<Checkbox
							id="unified-method-enabled"
							checked={method.enabled}
							onCheckedChange={(checked) => handleMethodEnabledChange(checked === true)}
						/>
						<Label htmlFor="unified-method-enabled" className="font-medium">
							Métodos HTTP
						</Label>
					</div>
					<fieldset className="flex flex-wrap gap-2 border-0 p-0">
						<legend className="sr-only">Métodos HTTP</legend>
						{HTTP_METHODS.map((m) => {
							const active = m === 'ANY' ? isAny : selectedMethods.includes(m);
							return (
								<Button
									key={m}
									type="button"
									size="sm"
									variant={active ? 'default' : 'outline'}
									onClick={() => toggleMethod(m)}
									disabled={!method.enabled}
									aria-pressed={active}
									data-testid={`unified-method-${m}`}
									className={cn('h-8', active && 'shadow-sm')}
								>
									{m === 'ANY' ? 'ANY (qualquer)' : m}
								</Button>
							);
						})}
					</fieldset>
					<p className="mt-2 text-xs text-muted-foreground">
						Selecione um ou mais métodos. Use <strong>ANY</strong> para casar qualquer método HTTP.
					</p>
					{methodSelectionError && (
						<p
							role="alert"
							className="mt-2 text-xs font-medium text-destructive"
							data-testid="unified-method-error"
						>
							Selecione ao menos um método ou desative este matcher.
						</p>
					)}
				</section>

				{others.length > 0 && (
					<section className="space-y-2">
						<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Matchers avançados
						</div>
						{others.map((m, idx) => (
							<div key={`${m.type}-${idx}`} className="rounded-lg border bg-card p-3">
								<MatcherEditor
									matcher={m}
									onChange={(updated) => updateOther(idx, updated)}
									onRemove={() => removeOtherAt(idx)}
									canRemove={true}
								/>
							</div>
						))}
					</section>
				)}

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => addOtherMatcher('header')}
					>
						<LucideIcon name="plus" className="mr-1 h-4 w-4" />
						Adicionar header
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => addOtherMatcher('body')}>
						<LucideIcon name="plus" className="mr-1 h-4 w-4" />
						Adicionar body
					</Button>
				</div>
			</div>

			{/* Coluna direita: preview */}
			<aside data-testid="unified-matcher-preview" className="rounded-lg border bg-muted/30 p-4">
				<div className="mb-3 flex items-center gap-2">
					<LucideIcon name="zap" className="h-4 w-4 text-muted-foreground" />
					<div className="text-sm font-medium">Preview de match</div>
				</div>
				<p className="mb-3 text-xs text-muted-foreground">
					Cole uma URL de teste para ver se a regra casaria o request.
				</p>
				<div className="space-y-3">
					<div>
						<Label htmlFor="unified-test-url" className="text-xs">
							URL de teste
						</Label>
						<Input
							id="unified-test-url"
							value={testUrl}
							onChange={(e) => setTestUrl(e.target.value)}
							placeholder="https://api.exemplo.com/users/42"
							data-testid="unified-test-url-input"
						/>
					</div>
					<div>
						<Label htmlFor="unified-test-method" className="text-xs">
							Método de teste
						</Label>
						<Select value={testMethod} onValueChange={(v) => setTestMethod(v as HttpMethod)}>
							<SelectTrigger id="unified-test-method" data-testid="unified-test-method-trigger">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HTTP_METHODS.filter((m) => m !== 'ANY').map((m) => (
									<SelectItem key={m} value={m}>
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<output
						className={cn(
							'block rounded-md border p-3 text-sm font-medium',
							explanation.overall
								? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
								: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300',
						)}
						data-testid="unified-preview-result"
						aria-live="polite"
					>
						<div className="flex items-center gap-2">
							<LucideIcon
								name={explanation.overall ? 'check-circle' : 'x-circle'}
								className="h-4 w-4"
							/>
							<span>{explanation.overall ? 'Casa esta regra' : 'Não casa esta regra'}</span>
						</div>
					</output>
					<ul
						className="space-y-1.5 text-xs text-muted-foreground"
						data-testid="unified-preview-checks"
					>
						{explanation.checks.length === 0 && (
							<li>Adicione ao menos uma condição (URL ou método).</li>
						)}
						{explanation.checks.map((check, idx) => (
							<li
								key={idx}
								className="flex items-start gap-2"
								data-testid={`unified-preview-check-${idx}`}
							>
								<LucideIcon
									name={!check.matcher.enabled ? 'circle' : check.pass ? 'check' : 'x'}
									className={cn(
										'mt-0.5 h-3.5 w-3.5 shrink-0',
										!check.matcher.enabled
											? 'text-muted-foreground'
											: check.pass
												? 'text-emerald-500'
												: 'text-rose-500',
									)}
								/>
								<span className={cn(check.matcher.enabled && check.pass && 'text-foreground/80')}>
									{check.reason}
								</span>
							</li>
						))}
					</ul>
				</div>
			</aside>
		</div>
	);
};

export default UnifiedMatcherEditor;
