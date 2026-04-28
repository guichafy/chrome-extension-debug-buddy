import React, { useState, useEffect } from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/ui/components/shadcn/card';
import { Button } from '@/ui/components/shadcn/button';
import RequestTable from '../components/RequestTable';
import ResponseDialog from '../components/ResponseDialog';
import { useAllRequests } from '../hooks/useAllRequests';
import { useResponses } from '../hooks/useResponses';
import { useRules } from '../hooks/useRules';
import { useLocation } from 'react-router-dom';
import { Matcher, MockAction } from '@/backend/types/rules';
import type { InterceptedResponse } from '@/backend/types/intercepted';
import { indexedDBService } from '@/backend/services/indexedDB';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/ui/components/shadcn/alert-dialog';

type HistoryView = 'all' | 'pending' | 'history' | 'mocked' | 'failed';

const historyViews: Array<{ value: HistoryView; label: string }> = [
	{ value: 'all', label: 'Todos' },
	{ value: 'pending', label: 'Aguardando ação' },
	{ value: 'history', label: 'Histórico' },
	{ value: 'mocked', label: 'Mockadas' },
	{ value: 'failed', label: 'Falhas' },
];

const getInitialView = (search?: string): HistoryView => {
	const view = new URLSearchParams(search ?? '').get('view');
	return historyViews.some((item) => item.value === view) ? (view as HistoryView) : 'all';
};

const matchesView = (request: InterceptedResponse, view: HistoryView): boolean => {
	if (view === 'all') return true;
	if (view === 'pending') return request.isWaiting === true;
	if (view === 'history') return request.isWaiting !== true;
	if (view === 'mocked') return request.isMocked === true;
	return Boolean(request.captureError);
};

const getResponseHeaders = (request: InterceptedResponse): Record<string, string> =>
	request.response?.headers ?? request.headers;

const getResponseBody = (request: InterceptedResponse): string | undefined =>
	request.response && 'body' in request.response ? request.response.body : request.body;

const RequestHistory: React.FC = () => {
	// Use location to force re-render when route changes
	const location = useLocation();

	// Log para debug
	React.useEffect(() => {
		console.log('RequestHistory component rendered, path:', location.pathname);
	}, [location]);

	// Initialize IndexedDB when component mounts
	useEffect(() => {
		const initDB = async () => {
			try {
				await indexedDBService.init();
				// Database initialized successfully
			} catch (error) {
				console.error('Error initializing IndexedDB:', error);
			}
		};

		initDB();
	}, []);

	const { approveResponse, ignoreResponse, clearCurrentResponse } = useResponses();

	const {
		allRequests,
		filteredRequests,
		currentRequestId,
		currentRequest,
		getRequestDetails,
		clearCurrentRequest,
		filter,
		setFilter,
		pauseAutoRefresh,
		enableAutoRefresh,
		autoRefreshEnabled,
		clearAllRequests,
	} = useAllRequests();

	const { addRule } = useRules();
	const [isEditing, setIsEditing] = useState(false);
	const [ruleCreated, setRuleCreated] = useState(false);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [activeView, setActiveView] = useState<HistoryView>(() => getInitialView(location.search));

	useEffect(() => {
		setActiveView(getInitialView(location.search));
	}, [location.search]);

	const counts = React.useMemo<Record<HistoryView, number>>(() => {
		const requests = Object.values(allRequests ?? {});
		return {
			all: requests.length,
			pending: requests.filter((request) => matchesView(request, 'pending')).length,
			history: requests.filter((request) => matchesView(request, 'history')).length,
			mocked: requests.filter((request) => matchesView(request, 'mocked')).length,
			failed: requests.filter((request) => matchesView(request, 'failed')).length,
		};
	}, [allRequests]);

	const visibleRequests = React.useMemo<Record<string, InterceptedResponse>>(() => {
		const selected: Record<string, InterceptedResponse> = {};
		for (const [id, request] of Object.entries(filteredRequests ?? {})) {
			if (matchesView(request, activeView)) {
				selected[id] = request;
			}
		}
		return selected;
	}, [filteredRequests, activeView]);

	const handleEditResponse = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		clearCurrentRequest();
		clearCurrentResponse();
	};

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			setIsEditing(false);
			clearCurrentRequest();
			clearCurrentResponse();
		}
	};

	const handleClearHistory = async () => {
		try {
			const success = await clearAllRequests();
			if (success) {
				// Fechar o diálogo
				setClearDialogOpen(false);
			} else {
				console.error('Falha ao limpar histórico de requisições');
			}
		} catch (error) {
			console.error('Erro ao limpar histórico de requisições:', error);
		}
	};

	const handleCreateMock = async () => {
		if (currentRequest) {
			if (currentRequest.captureError) {
				alert('Não é possível criar mock a partir de uma resposta com falha de captura.');
				return;
			}

			if (!currentRequest.method) {
				alert('Não é possível criar mock sem o método HTTP original da requisição.');
				return;
			}

			try {
				// Extrair o URL base da requisição para o mock
				const url = currentRequest.url;
				const urlObj = new URL(url);
				const urlPattern = urlObj.hostname + urlObj.pathname;
				const responseBody = getResponseBody(currentRequest);

				// Criar matchers para a regra
				const matchers: Matcher[] = [
					{
						type: 'url',
						enabled: true,
						pattern: urlPattern,
						isRegex: false,
					},
					{
						type: 'method',
						enabled: true,
						method: currentRequest.method,
					},
				];

				// Criar ação de mock
				const mockAction: MockAction = {
					type: 'mock',
					enabled: true,
					status: currentRequest.status,
					headers: getResponseHeaders(currentRequest),
					...(currentRequest.statusText ? { statusPhrase: currentRequest.statusText } : {}),
					...(responseBody !== undefined ? { body: responseBody } : {}),
					...(currentRequest.mimeType !== undefined
						? { contentType: currentRequest.mimeType }
						: {}),
				};

				// Adicionar a regra
				const success = await addRule(`Mock para ${urlPattern}`, matchers, mockAction);

				if (success) {
					setRuleCreated(true);
					// Fechar o diálogo após criar a regra
					setTimeout(() => {
						setDialogOpen(false);
						setRuleCreated(false);
					}, 1500);
				}
			} catch (error) {
				console.error('Erro ao criar regra de mock:', error);
			}
		}
	};

	const handleSelectRequest = async (requestId: string) => {
		await getRequestDetails(requestId);
		setDialogOpen(true);
	};

	return (
		<>
			<Card className="panel">
				<CardHeader>
					<CardTitle>Histórico de Requisições</CardTitle>
					<CardDescription>
						Histórico de todas as requisições capturadas enquanto o debugger estava ativo, incluindo
						as interceptadas e as apenas observadas.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div
						className="mb-4 flex flex-wrap gap-2"
						role="tablist"
						aria-label="Filtros do histórico de requisições"
					>
						{historyViews.map(({ value, label }) => (
							<Button
								key={value}
								type="button"
								variant={activeView === value ? 'default' : 'outline'}
								size="sm"
								className="gap-2"
								onClick={() => setActiveView(value)}
							>
								<span>{label}</span>
								<span
									className={`rounded-full px-2 py-0.5 text-xs ${
										activeView === value
											? 'bg-primary-foreground/20 text-primary-foreground'
											: 'bg-muted text-muted-foreground'
									}`}
								>
									{counts[value]}
								</span>
							</Button>
						))}
					</div>
					<RequestTable
						requests={visibleRequests}
						onSelect={handleSelectRequest}
						searchValue={filter}
						onSearchChange={setFilter}
						pauseAutoRefresh={pauseAutoRefresh}
						enableAutoRefresh={enableAutoRefresh}
						autoRefreshEnabled={autoRefreshEnabled}
						onClearHistory={() => setClearDialogOpen(true)}
					/>
					{Object.keys(visibleRequests || {}).length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							Nenhuma requisição encontrada no histórico.
						</div>
					)}
				</CardContent>
			</Card>

			<ResponseDialog
				open={dialogOpen}
				onOpenChange={handleDialogOpenChange}
				response={currentRequest}
				requestId={currentRequestId}
				onApprove={approveResponse}
				onIgnore={ignoreResponse}
				onMock={handleCreateMock}
				onEdit={handleEditResponse}
				onCancel={handleCancelEdit}
				isEditing={isEditing}
				readOnly={currentRequest?.isWaiting !== true}
				ruleCreated={ruleCreated}
			/>

			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Limpar histórico de requisições</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação irá remover permanentemente todas as requisições do histórico. Esta ação não
							pode ser desfeita.
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
		</>
	);
};

export default RequestHistory;
