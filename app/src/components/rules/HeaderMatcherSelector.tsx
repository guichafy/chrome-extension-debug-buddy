import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { isSensitiveHeader, maskHeaderValue } from '@/domain/sensitiveHeaders';
import type { HeaderMatcher, Matcher } from '@/types/rules';

export interface HeaderMatcherSource {
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
}

interface HeaderMatcherSelectorProps {
	headers: HeaderMatcherSource;
	matchers: Matcher[];
	onChange: (next: Matcher[]) => void;
}

interface Row {
	headerType: 'request' | 'response';
	name: string;
	value: string;
	sensitive: boolean;
}

function buildRows(source: HeaderMatcherSource): Row[] {
	const rows: Row[] = [];
	for (const [name, value] of Object.entries(source.requestHeaders)) {
		rows.push({ headerType: 'request', name, value, sensitive: isSensitiveHeader(name) });
	}
	for (const [name, value] of Object.entries(source.responseHeaders)) {
		rows.push({ headerType: 'response', name, value, sensitive: isSensitiveHeader(name) });
	}
	return rows;
}

function findExistingIndex(
	matchers: Matcher[],
	headerType: 'request' | 'response',
	name: string,
): number {
	return matchers.findIndex(
		(m) => m.type === 'header' && m.headerType === headerType && m.name === name,
	);
}

export function HeaderMatcherSelector({ headers, matchers, onChange }: HeaderMatcherSelectorProps) {
	const { t } = useTranslation('ruleEditor');
	const rows = buildRows(headers);

	if (rows.length === 0) {
		return (
			<div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
				{t('headerMatchers.empty')}
			</div>
		);
	}

	const handleToggle = (row: Row) => {
		const idx = findExistingIndex(matchers, row.headerType, row.name);
		if (idx >= 0) {
			const next = [...matchers];
			next.splice(idx, 1);
			onChange(next);
			return;
		}
		const matcher: HeaderMatcher = {
			type: 'header',
			enabled: true,
			headerType: row.headerType,
			name: row.name,
			value: row.value,
		};
		onChange([...matchers, matcher]);
	};

	const selectedCount = rows.reduce(
		(acc, row) => (findExistingIndex(matchers, row.headerType, row.name) >= 0 ? acc + 1 : acc),
		0,
	);

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className="text-sm font-medium">{t('headerMatchers.title')}</h4>
				<span
					className="text-xs text-muted-foreground"
					data-testid="header-matcher-count"
					aria-live="polite"
				>
					{selectedCount > 0
						? t('headerMatchers.selected', { count: selectedCount, total: rows.length })
						: t('headerMatchers.available', { count: rows.length })}
				</span>
			</div>
			<p className="text-xs text-muted-foreground">{t('headerMatchers.help')}</p>
			{/* Scroll nativo: scrollbar sempre visível em overflow (diferente do Radix
			    ScrollArea type="hover", que escondia a indicação de "tem mais"). Cap
			    responsivo via max-h-[40vh] adapta a viewports maiores; min-h-40 garante
			    pelo menos ~5 linhas visíveis mesmo em modais pequenos. thead sticky
			    mantém os rótulos das colunas ao rolar. */}
			<div
				className="min-h-40 max-h-[40vh] overflow-y-auto rounded-md border"
				data-testid="header-matcher-scroll"
			>
				<table className="w-full text-sm">
					<thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
						<tr>
							<th className="px-3 py-2 text-left">{t('headerMatchers.columns.include')}</th>
							<th className="px-3 py-2 text-left">{t('headerMatchers.columns.type')}</th>
							<th className="px-3 py-2 text-left">{t('headerMatchers.columns.name')}</th>
							<th className="px-3 py-2 text-left">{t('headerMatchers.columns.value')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const checked = findExistingIndex(matchers, row.headerType, row.name) >= 0;
							return (
								<tr
									key={`${row.headerType}-${row.name}`}
									className="border-t"
									data-testid={`header-matcher-row-${row.headerType}-${row.name}`}
								>
									<td className="px-3 py-2">
										<Checkbox
											checked={checked}
											onCheckedChange={() => handleToggle(row)}
											disabled={row.sensitive && row.value.length === 0}
										/>
									</td>
									<td className="px-3 py-2 text-xs uppercase">{row.headerType}</td>
									<td className="px-3 py-2 font-mono text-xs">{row.name}</td>
									<td className="px-3 py-2 font-mono text-xs break-all">
										{row.sensitive ? maskHeaderValue(row.name, row.value) : row.value}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
