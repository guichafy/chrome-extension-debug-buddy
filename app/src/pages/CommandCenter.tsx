import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';
import { useRequestSelection } from '@/hooks/useRequestSelection';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
import { cn } from '@/lib/utils';
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
	const {
		filteredRequests,
		filter,
		setFilter,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		clearAllRequests,
	} = useAllRequests();
	const { approveResponse, ignoreResponse } = useResponses();
	const { rules } = useRules();
	const { selectedId, selected, select, clear } = useRequestSelection(filteredRequests);

	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [quickMockOpen, setQuickMockOpen] = useState(false);
	const [recentRuleId, setRecentRuleId] = useState<string | null>(null);

	// Limpar o id da regra recém-criada quando o usuário troca de request selecionado.
	// selectedId é dependência intencional: o efeito deve disparar a cada troca de seleção.
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedId é o gatilho da limpeza
	useEffect(() => {
		setRecentRuleId(null);
	}, [selectedId]);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = (_request: InterceptedResponse, _requestId: string) => {
		setQuickMockOpen(true);
	};

	return (
		<div className="flex h-full min-h-0 flex-col lg:flex-row">
			<section
				className={cn(
					'flex min-h-0 flex-col overflow-hidden p-4',
					selectedId ? 'lg:w-[34%] lg:min-w-[320px] lg:flex-shrink-0' : 'flex-1',
				)}
			>
				<RequestTimeline
					requests={filteredRequests}
					selectedId={selectedId}
					onSelect={select}
					searchValue={filter}
					onSearchChange={setFilter}
					onClearHistory={() => setClearDialogOpen(true)}
					autoRefreshEnabled={autoRefreshEnabled}
					pauseAutoRefresh={pauseAutoRefresh}
					enableAutoRefresh={enableAutoRefresh}
				/>
			</section>

			{selectedId && (
				<section className="flex min-h-0 flex-1 flex-col overflow-hidden border-t lg:border-l lg:border-t-0">
					<RequestInspector
						request={
							selected
								? {
										...selected,
										generatedRuleId: recentRuleId ?? selected.generatedRuleId,
									}
								: null
						}
						requestId={selectedId}
						onApprove={approveResponse}
						onIgnore={ignoreResponse}
						onCreateMock={handleCreateMock}
						onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
						onClose={clear}
						rules={rules}
					/>
				</section>
			)}

			{quickMockOpen && selected && selectedId && (
				<QuickMockPanel
					open={quickMockOpen}
					onOpenChange={setQuickMockOpen}
					request={selected}
					requestId={selectedId}
					onCreated={(rule) => setRecentRuleId(rule.id)}
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
