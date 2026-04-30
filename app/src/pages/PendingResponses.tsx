import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useResponses } from '@/hooks/useResponses';
import { formatDuration, getDurationColorClass } from '@/components/requests/duration';
import { getRequestState, getStateBadgeMeta } from '@/lib/requestState';
import { cn } from '@/lib/utils';

const PendingResponses: React.FC = () => {
	const { pendingResponses, approveResponse, ignoreResponse } = useResponses();

	const rows = useMemo(() => {
		return Object.entries(pendingResponses)
			.filter(([, response]) => response.isWaiting === true)
			.sort((a, b) => (a[1].timestamp ?? 0) - (b[1].timestamp ?? 0))
			.map(([id, response]) => ({ id, response }));
	}, [pendingResponses]);

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
							<TableHead className="w-48 text-right">Ações</TableHead>
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
												size="sm"
												variant="default"
												onClick={() => approveResponse(id, {})}
												className="gap-1"
											>
												<LucideIcon name="check" className="h-3.5 w-3.5" />
												Aprovar
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => ignoreResponse(id)}
												className="gap-1"
											>
												<LucideIcon name="x" className="h-3.5 w-3.5" />
												Ignorar
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};

export default PendingResponses;
