import { ScrollArea } from '@/components/ui/scroll-area';
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
	const rows = buildRows(headers);

	if (rows.length === 0) {
		return (
			<div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
				Nenhum header capturado nesta request.
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

	return (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">Header matchers (opcional)</h4>
			<p className="text-xs text-muted-foreground">
				Marque headers para exigir o mesmo valor na request original. Headers sensíveis ficam
				mascarados.
			</p>
			<ScrollArea className="max-h-72 rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
						<tr>
							<th className="px-3 py-2 text-left">Inc.</th>
							<th className="px-3 py-2 text-left">Tipo</th>
							<th className="px-3 py-2 text-left">Nome</th>
							<th className="px-3 py-2 text-left">Valor</th>
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
			</ScrollArea>
		</div>
	);
}
