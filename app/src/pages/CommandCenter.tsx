import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import { useAppOutlet } from '@/types/outletContext';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import { EditResponseSheet } from '@/components/command-center/EditResponseSheet';
import { cn } from '@/lib/utils';
import { filtersEqualUrl, parseFiltersFromUrl, serializeFiltersToUrl } from '@/lib/filterUrl';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CommandCenter: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	const {
		filteredRequests,
		filters,
		setFilters,
		clearAllRequests,
		approveResponseWithEdit,
		pendingResponses,
		rules,
		selectedId,
		selected,
		select,
		clear,
	} = useAppOutlet();

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);

	// Hidrata `filters` a partir da URL na primeira renderização e mantém a URL
	// sincronizada conforme o FilterBar muda. A flag de hidratação evita o ciclo
	// "URL → filters → URL → filters" — depois do mount, o estado da hook é o
	// dono dos filtros e a URL apenas espelha.
	const hydratedFromUrlRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: hidrata uma única vez
	useEffect(() => {
		if (hydratedFromUrlRef.current) return;
		hydratedFromUrlRef.current = true;
		const fromUrl = parseFiltersFromUrl(searchParams);
		if (fromUrl.length > 0) setFilters(fromUrl);
	}, []);

	useEffect(() => {
		if (!hydratedFromUrlRef.current) return;
		const desired = serializeFiltersToUrl(filters);
		const current = searchParams.getAll('filter');
		if (filtersEqualUrl(desired, current)) return;
		const next = new URLSearchParams(searchParams);
		next.delete('filter');
		for (const value of desired) next.append('filter', value);
		setSearchParams(next, { replace: true });
	}, [filters, searchParams, setSearchParams]);

	// Limpar o id da regra recém-criada quando o usuário troca de request selecionado.
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	// Quando o request selecionado some do snapshot (ex.: foi aprovado/ignorado e
	// removido da fila pendente, ou o histórico foi limpo), descartamos a seleção
	// para o layout voltar ao estado de tela cheia da timeline em vez de travar
	// no placeholder "Selecione uma requisição".
	useEffect(() => {
		if (selectedId && !selected) clear();
	}, [selectedId, selected, clear]);

	// Hidratação de ?edit / ?mock vinda da URL. Param toma precedência sobre
	// state local — assim o navigate('/command-center?edit=<id>') do Layout
	// (vindo do Dock em qualquer rota) abre o sheet correto. Edit precede Mock
	// quando ambos chegam juntos (regra simples para resolver conflito).
	const editParam = searchParams.get('edit');
	const mockParam = searchParams.get('mock');

	const editSheetTargetId = editParam;
	const quickMockTargetId = !editParam && mockParam ? mockParam : null;

	const editTarget = editSheetTargetId ? (pendingResponses[editSheetTargetId] ?? null) : null;
	const quickMockTarget = quickMockTargetId
		? (filteredRequests[quickMockTargetId] ?? pendingResponses[quickMockTargetId] ?? null)
		: null;

	// Limpar params inválidos da URL — sem fallback silencioso, conforme regra
	// do projeto. Se o id no URL não existe (ou alvo sumiu após aprovação),
	// remove o param em vez de mostrar UI vazia.
	useEffect(() => {
		const next = new URLSearchParams(searchParams);
		let changed = false;
		if (editParam && !editTarget) {
			next.delete('edit');
			changed = true;
		}
		if (mockParam && !quickMockTarget && !editParam) {
			next.delete('mock');
			changed = true;
		}
		// Se edit está válido, remover mock (mutuamente exclusivos)
		if (editParam && editTarget && mockParam) {
			next.delete('mock');
			changed = true;
		}
		if (changed) setSearchParams(next, { replace: true });
	}, [editParam, mockParam, editTarget, quickMockTarget, searchParams, setSearchParams]);

	const closeEditSheet = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('edit');
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const closeQuickMock = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.delete('mock');
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const openQuickMockFor = useCallback(
		(requestId: string) => {
			const next = new URLSearchParams(searchParams);
			next.set('mock', requestId);
			next.delete('edit');
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = (_request: InterceptedResponse, requestId: string) => {
		openQuickMockFor(requestId);
	};

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden lg:flex-row">
			<section
				className={cn(
					'flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-4',
					selected ? 'lg:w-[28%] lg:min-w-[320px] lg:flex-shrink-0' : 'flex-1',
				)}
			>
				<RequestTimeline
					requests={filteredRequests}
					selectedId={selectedId}
					onSelect={select}
					filters={filters}
					onFiltersChange={setFilters}
					onClearHistory={() => setClearDialogOpen(true)}
				/>
			</section>

			{selected && selectedId && (
				<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t lg:border-l lg:border-t-0">
					<RequestInspector
						request={{
							...selected,
							generatedRuleId: recentRuleId ?? selected.generatedRuleId,
						}}
						requestId={selectedId}
						onCreateMock={handleCreateMock}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{quickMockTarget && quickMockTargetId && (
				<QuickMockPanel
					open
					onOpenChange={(open) => {
						if (!open) closeQuickMock();
					}}
					request={quickMockTarget}
					requestId={quickMockTargetId}
					onCreated={(rule) => setRecentRuleId(rule.id)}
				/>
			)}

			{editTarget && editSheetTargetId && (
				<EditResponseSheet
					open
					onOpenChange={(open) => {
						if (!open) closeEditSheet();
					}}
					request={editTarget}
					requestId={editSheetTargetId}
					onSubmit={approveResponseWithEdit}
				/>
			)}

			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove todas as requisições. Não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleClearHistory} className="bg-red-500 hover:bg-red-600">
							Limpar histórico
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default CommandCenter;
