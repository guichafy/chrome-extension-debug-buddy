import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';
import { formatDuration, getDurationColorClass } from '@/components/requests/duration';
import { getRequestState, getStateBadgeMeta } from '@/lib/requestState';
import { PendingResponseActions } from '@/components/command-center/PendingResponseActions';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import { cn } from '@/lib/utils';
import type { InterceptedResponse } from '@/types/intercepted';

interface QuickMockTarget {
	request: InterceptedResponse;
	requestId: string;
}

const PendingResponses: React.FC = () => {
	const navigate = useNavigate();
	const { pendingResponses, approveResponse, approveResponseWithEdit, ignoreResponse } =
		useResponses();
	const { rules } = useRules();

	const [inspectingId, setInspectingId] = useState<string | null>(null);
	const [quickMockTarget, setQuickMockTarget] = useState<QuickMockTarget | null>(null);

	const rows = useMemo(() => {
		return Object.entries(pendingResponses)
			.filter(([, response]) => response.isWaiting === true)
			.sort((a, b) => (a[1].timestamp ?? 0) - (b[1].timestamp ?? 0))
			.map(([id, response]) => ({ id, response }));
	}, [pendingResponses]);

	// Fecha o sheet automaticamente quando a request inspecionada deixa de estar
	// pausada (aprovada/ignorada por outro caminho ou pelo split button da própria
	// linha). Sem isso, o sheet ficaria mostrando placeholder ou estado obsoleto.
	useEffect(() => {
		if (inspectingId && !pendingResponses[inspectingId]) {
			setInspectingId(null);
		}
	}, [inspectingId, pendingResponses]);

	const handleApproveRow = useCallback((id: string) => approveResponse(id, {}), [approveResponse]);

	const handleCreateMock = useCallback((request: InterceptedResponse, requestId: string) => {
		setQuickMockTarget({ request, requestId });
	}, []);

	const handleOpenRulesLab = useCallback(
		(ruleId: string) => {
			navigate(`/rules-lab?rule=${ruleId}`);
		},
		[navigate],
	);

	const inspectingRequest = inspectingId ? pendingResponses[inspectingId] : null;

	if (rows.length === 0) {
		return (
			<div
				className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
				data-testid="pending-empty-state"
			>
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<LucideIcon name="hourglass" className="h-7 w-7" />
				</div>
				<h2 className="text-lg font-semibold">Nenhuma response aguardando decisão</h2>
				<p className="max-w-md text-sm text-muted-foreground">
					Quando regras de breakpoint pausarem requisições, elas aparecerão aqui em formato de
					tabela com ações inline.
				</p>
				<Button asChild variant="outline" size="sm">
					<Link to="/command-center">
						<LucideIcon name="layout" className="mr-2 h-4 w-4" />
						Ir para o Command Center
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 p-4">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Responses pausadas</h1>
					<p className="text-xs text-muted-foreground">
						{rows.length === 1
							? '1 requisição aguardando sua decisão'
							: `${rows.length} requisições aguardando sua decisão`}
					</p>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-auto rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-20">Método</TableHead>
							<TableHead>URL</TableHead>
							<TableHead className="w-32">Status</TableHead>
							<TableHead className="w-24">Tempo</TableHead>
							<TableHead className="w-56 text-right">Ações</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map(({ id, response }) => {
							const stateMeta = getStateBadgeMeta(getRequestState(response));
							const durationClass = getDurationColorClass(response.duration);
							return (
								<TableRow key={id} data-testid={`pending-row-${id}`}>
									<TableCell className="font-mono text-xs font-medium">
										{response.method ?? 'Método ausente'}
									</TableCell>
									<TableCell
										className="max-w-[480px] truncate font-mono text-xs"
										title={response.url}
									>
										{response.url}
									</TableCell>
									<TableCell>
										<Badge
											variant={stateMeta.variant}
											className={cn(
												'inline-flex items-center gap-1 text-xs',
												stateMeta.pulse && 'animate-pulse',
											)}
										>
											<LucideIcon name={stateMeta.iconName} className="h-3 w-3" />
											{typeof response.status === 'number' && response.status > 0
												? `${stateMeta.label} · ${response.status}`
												: stateMeta.label}
										</Badge>
									</TableCell>
									<TableCell className={cn('text-xs font-medium', durationClass)}>
										{formatDuration(response.duration)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => setInspectingId(id)}
												aria-label={`Inspecionar ${response.method ?? ''} ${response.url}`}
												className="h-9 w-9"
												data-testid={`pending-row-inspect-${id}`}
											>
												<LucideIcon name="search" className="h-4 w-4" />
											</Button>
											<PendingResponseActions
												request={response}
												requestId={id}
												isWaiting
												onApprove={handleApproveRow}
												onIgnore={ignoreResponse}
												onCreateMock={handleCreateMock}
												onApproveWithEdit={approveResponseWithEdit}
												hotkeysEnabled={false}
												size="sm"
											/>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			<Sheet
				open={inspectingId !== null && inspectingRequest !== null}
				onOpenChange={(open) => {
					if (!open) setInspectingId(null);
				}}
			>
				<SheetContent
					side="right"
					className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
					data-testid="pending-inspect-sheet"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Inspecionar requisição pausada</SheetTitle>
						<SheetDescription>
							Visualize detalhes e tome decisões sobre a requisição selecionada sem sair da tabela.
						</SheetDescription>
					</SheetHeader>
					{inspectingId && inspectingRequest && (
						<RequestInspector
							request={inspectingRequest}
							requestId={inspectingId}
							onApprove={approveResponse}
							onIgnore={ignoreResponse}
							onCreateMock={handleCreateMock}
							onApproveWithEdit={approveResponseWithEdit}
							onOpenInRulesLab={handleOpenRulesLab}
							onClose={() => setInspectingId(null)}
							rules={rules}
						/>
					)}
				</SheetContent>
			</Sheet>

			{quickMockTarget && (
				<QuickMockPanel
					open={quickMockTarget !== null}
					onOpenChange={(open) => {
						if (!open) setQuickMockTarget(null);
					}}
					request={quickMockTarget.request}
					requestId={quickMockTarget.requestId}
				/>
			)}
		</div>
	);
};

export default PendingResponses;
