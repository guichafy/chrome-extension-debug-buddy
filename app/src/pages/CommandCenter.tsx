import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InterceptedResponse } from '@/types/intercepted';
import { useAllRequests } from '@/hooks/useAllRequests';
import { useResponses } from '@/hooks/useResponses';
import { useRules } from '@/hooks/useRules';
import { useRequestSelection } from '@/hooks/useRequestSelection';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { RequestInspector } from '@/components/command-center/RequestInspector';
import { QuickMockPanel } from '@/components/command-center/QuickMockPanel';
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
	const [recentRuleName, setRecentRuleName] = useState<string | null>(null);

	const handleClearHistory = async () => {
		await clearAllRequests();
		setClearDialogOpen(false);
		clear();
	};

	const handleCreateMock = (_request: InterceptedResponse, _requestId: string) => {
		setQuickMockOpen(true);
	};

	return (
		<div className="grid h-[calc(100vh-3.5rem)] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,38%)]">
			<section className="min-h-0 overflow-auto p-4">
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

			<section className="min-h-0 overflow-hidden border-t lg:border-l lg:border-t-0">
				<RequestInspector
					request={
						selected
							? {
									...selected,
									// Sentinela provisória: indica que existe uma regra recém-criada via Quick Mock
									// vinculada a esta request. O id real será exposto em task futura (issue follow-up).
									generatedRuleId: recentRuleName ? 'pending-link' : selected.generatedRuleId,
								}
							: null
					}
					requestId={selectedId}
					onApprove={approveResponse}
					onIgnore={ignoreResponse}
					onCreateMock={handleCreateMock}
					onOpenInRulesLab={(ruleId) => navigate(`/rules-lab?rule=${ruleId}`)}
					onReplay={() => {
						/* Tratado dentro da aba Replay do inspector — Phase 5 */
					}}
					onClose={clear}
					rules={rules}
				/>
			</section>

			{quickMockOpen && selected && selectedId && (
				<QuickMockPanel
					open={quickMockOpen}
					onOpenChange={setQuickMockOpen}
					request={selected}
					requestId={selectedId}
					onCreated={(name) => setRecentRuleName(name)}
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
