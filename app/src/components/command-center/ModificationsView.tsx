// Phase 7: visualizador de modificações request/response em diff side-by-side.
// Consome `requestModified` e `responseModified` populados pelo background no
// final do chain por stage. Quando nenhum dos dois está presente, renderiza
// um estado vazio explicativo.

import { Trans, useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import { type HeaderDiff, diffHeaderRecord } from '@/domain/modificationDiff';
import type {
	InterceptedResponse,
	RequestModificationSnapshot,
	ResponseModificationSnapshot,
} from '@/types/intercepted';

interface ModificationsViewProps {
	request: InterceptedResponse;
}

export function ModificationsView({ request }: ModificationsViewProps) {
	const { t } = useTranslation('commandCenter');
	const { requestModified, responseModified } = request;
	const hasAny = Boolean(requestModified || responseModified);

	if (!hasAny) {
		return (
			<div
				className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"
				data-testid="modifications-empty"
			>
				<Trans
					t={t}
					i18nKey="modifications.empty"
					components={{ code: <code className="px-1 font-mono" /> }}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4" data-testid="modifications-view">
			{requestModified && (
				<RequestModSection
					original={{
						url: request.url,
						method: request.method ?? '',
						headers: request.request?.headers ?? {},
						postData: request.request?.postData,
					}}
					modification={requestModified}
				/>
			)}
			{responseModified && (
				<ResponseModSection
					original={{
						status: request.status,
						statusPhrase: request.statusText,
						headers: request.response?.headers ?? request.headers,
						body: request.response?.body ?? request.body,
					}}
					modification={responseModified}
				/>
			)}
		</div>
	);
}

interface OriginalRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	postData?: string;
}

function RequestModSection({
	original,
	modification,
}: {
	original: OriginalRequest;
	modification: RequestModificationSnapshot;
}) {
	const { t } = useTranslation('commandCenter');
	const headerDiffs = modification.headers
		? diffHeaderRecord(original.headers, modification.headers)
		: [];

	return (
		<section
			className="rounded-md border bg-info/5 p-3"
			data-testid="modifications-section-request"
		>
			<SectionHeader iconName="upload" label={t('modifications.requestModified')} tone="info" />
			<dl className="mt-3 space-y-2">
				{modification.url !== undefined && (
					<DiffRow
						field="url"
						label={t('modifications.url')}
						before={original.url}
						after={modification.url}
					/>
				)}
				{modification.method !== undefined && (
					<DiffRow
						field="method"
						label={t('modifications.method')}
						before={original.method}
						after={modification.method}
					/>
				)}
				{headerDiffs.length > 0 && <HeadersDiff diffs={headerDiffs} />}
				{modification.postData !== undefined && (
					<DiffRow
						field="body"
						label={t('modifications.body')}
						before={original.postData ?? ''}
						after={modification.postData}
						multiline
					/>
				)}
			</dl>
		</section>
	);
}

interface OriginalResponse {
	status: number;
	statusPhrase: string;
	headers: Record<string, string>;
	body?: string;
}

function ResponseModSection({
	original,
	modification,
}: {
	original: OriginalResponse;
	modification: ResponseModificationSnapshot;
}) {
	const { t } = useTranslation('commandCenter');
	const headerDiffs = modification.headers
		? diffHeaderRecord(original.headers, modification.headers)
		: [];

	return (
		<section
			className="rounded-md border bg-success/5 p-3"
			data-testid="modifications-section-response"
		>
			<SectionHeader
				iconName="download"
				label={t('modifications.responseModified')}
				tone="success"
			/>
			<dl className="mt-3 space-y-2">
				{modification.status !== undefined && (
					<DiffRow
						field="status"
						label={t('modifications.status')}
						before={String(original.status)}
						after={String(modification.status)}
					/>
				)}
				{modification.statusPhrase !== undefined && (
					<DiffRow
						field="status-text"
						label={t('modifications.statusText')}
						before={original.statusPhrase}
						after={modification.statusPhrase}
					/>
				)}
				{headerDiffs.length > 0 && <HeadersDiff diffs={headerDiffs} />}
				{modification.body !== undefined && (
					<DiffRow
						field="body"
						label={t('modifications.body')}
						before={original.body ?? ''}
						after={modification.body}
						multiline
					/>
				)}
			</dl>
		</section>
	);
}

function SectionHeader({
	iconName,
	label,
	tone,
}: {
	iconName: 'upload' | 'download';
	label: string;
	tone: 'info' | 'success';
}) {
	return (
		<div className="flex items-center gap-2">
			<Badge
				variant="outline"
				className={cn(
					'gap-1.5 border px-2 py-0.5 text-[11px] font-medium',
					tone === 'info'
						? 'bg-info/15 text-info border-info/40'
						: 'bg-success/15 text-success border-success/40',
				)}
			>
				<LucideIcon name={iconName} className="h-3 w-3" />
				{label}
			</Badge>
		</div>
	);
}

function DiffRow({
	label,
	before,
	after,
	multiline = false,
	field,
}: {
	label: string;
	before: string;
	after: string;
	multiline?: boolean;
	// Identificador estável do campo (independente do idioma) para o test id.
	field: string;
}) {
	const { t } = useTranslation('commandCenter');
	return (
		<div
			className="grid gap-1 rounded border bg-background p-2"
			data-testid={`modifications-diff-${field}`}
		>
			<div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<DiffValue
				label={t('modifications.before')}
				value={before}
				kind="removed"
				multiline={multiline}
			/>
			<DiffValue
				label={t('modifications.after')}
				value={after}
				kind="added"
				multiline={multiline}
			/>
		</div>
	);
}

function DiffValue({
	label,
	value,
	kind,
	multiline,
}: {
	label: string;
	value: string;
	kind: 'added' | 'removed' | 'changed' | 'unchanged';
	multiline?: boolean;
}) {
	const toneClass =
		kind === 'added'
			? 'bg-success/10 text-success border-success/30'
			: kind === 'removed'
				? 'bg-destructive/10 text-destructive border-destructive/30'
				: kind === 'changed'
					? 'bg-warning/10 text-warning border-warning/30'
					: 'bg-muted text-muted-foreground border-border';

	const isEmpty = value.length === 0;
	return (
		<div
			className={cn(
				'flex items-start gap-2 rounded border px-2 py-1 font-mono text-xs',
				toneClass,
				multiline && 'whitespace-pre-wrap break-all',
			)}
		>
			<span className="shrink-0 select-none uppercase tracking-wide text-[10px] opacity-70">
				{label}
			</span>
			{isEmpty ? <span className="italic opacity-60">(vazio)</span> : <span>{value}</span>}
		</div>
	);
}

function HeadersDiff({ diffs }: { diffs: HeaderDiff[] }) {
	const { t } = useTranslation('commandCenter');
	const meaningful = diffs.filter((d) => d.kind !== 'unchanged');
	if (meaningful.length === 0) return null;
	return (
		<div className="rounded border bg-background p-2" data-testid="modifications-diff-headers">
			<div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				{t('modifications.headers')}
			</div>
			<ul className="mt-1 space-y-1">
				{meaningful.map((diff) => (
					<li
						key={`${diff.kind}-${diff.name}`}
						className="font-mono text-xs"
						data-testid={`header-diff-${diff.kind}-${diff.name.toLowerCase()}`}
					>
						{diff.kind === 'added' && (
							<span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
								+ {diff.name}: {diff.value}
							</span>
						)}
						{diff.kind === 'removed' && (
							<span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">
								− {diff.name}: {diff.previousValue}
							</span>
						)}
						{diff.kind === 'changed' && (
							<span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
								~ {diff.name}: {diff.previousValue} → {diff.value}
							</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

export default ModificationsView;
