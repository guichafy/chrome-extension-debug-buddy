import { useState, useEffect, useCallback } from 'react';

export interface TargetTabState {
	id: number | null;
	title: string;
	url: string;
	// `closed: true` significa que a aba previamente selecionada foi fechada
	// (e ainda não houve nova seleção). `id` fica `null` nesse caso, mas
	// title/url são preservados para que a UI possa identificar qual aba
	// sumiu — ex.: "Aba indisponível: GitHub – issues".
	closed: boolean;
}

export function useDebugging() {
	const [isDebugging, setIsDebugging] = useState(false);
	const [loading, setLoading] = useState(true);
	const [targetTab, setTargetTab] = useState<TargetTabState>({
		id: null,
		title: '',
		url: '',
		closed: false,
	});

	// Verificar o status de debugging
	const checkDebuggingStatus = useCallback(async () => {
		setLoading(true);
		try {
			const response = await chrome.runtime.sendMessage({ action: 'getDebuggingStatus' });
			setIsDebugging(response && response.isDebugging);
		} catch (error) {
			console.error('Erro ao verificar status de debugging:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Iniciar debugging
	const startDebugging = useCallback(async (): Promise<boolean> => {
		try {
			const response = await chrome.runtime.sendMessage({ action: 'startDebugging' });
			if (response && response.success) {
				setIsDebugging(true);
				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error('Erro ao iniciar debugging:', error);
			return false;
		}
	}, []);

	// Parar debugging
	const stopDebugging = useCallback(async (): Promise<boolean> => {
		try {
			const response = await chrome.runtime.sendMessage({ action: 'stopDebugging' });
			if (response && response.success) {
				setIsDebugging(false);
				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error('Erro ao parar debugging:', error);
			return false;
		}
	}, []);

	// Selecionar aba alvo
	const selectTargetTab = useCallback(async (): Promise<boolean> => {
		try {
			const response = await chrome.runtime.sendMessage({ action: 'selectTargetTab' });
			return response && response.success;
		} catch (error) {
			console.error('Erro ao selecionar aba alvo:', error);
			return false;
		}
	}, []);

	// Carregar informações da aba alvo do armazenamento
	const loadTargetTabInfo = useCallback(async () => {
		try {
			const result = await chrome.storage.local.get(['targetTabInfo']);
			if (result.targetTabInfo) {
				setTargetTab({
					id: typeof result.targetTabInfo.id === 'number' ? result.targetTabInfo.id : null,
					title: result.targetTabInfo.title || '',
					url: result.targetTabInfo.url || '',
					closed: result.targetTabInfo.closed === true,
				});
				console.log('Informações da aba alvo carregadas:', result.targetTabInfo);
			}
		} catch (error) {
			console.error('Erro ao carregar informações da aba alvo:', error);
		}
	}, []);

	// Verificar status de debugging ao montar o componente
	useEffect(() => {
		// Carregar status e informações da aba alvo
		checkDebuggingStatus();
		loadTargetTabInfo();

		// Configurar intervalo para verificar o status periodicamente
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				checkDebuggingStatus();
			}
		}, 2000);

		// Listener para receber atualizações sobre a aba selecionada
		const messageListener = (message: any) => {
			if (message.action === 'targetTabSelected') {
				setTargetTab({
					id: typeof message.tabId === 'number' ? message.tabId : null,
					title: message.tabTitle || '',
					url: message.tabUrl || '',
					closed: false,
				});
			} else if (message.action === 'targetTabUpdated') {
				// O background envia o snapshot completo (tabId/title/url) sempre
				// que algum dos três muda. Usamos `prev` como rede de segurança
				// caso uma versão anterior do background omita algum campo (deploy
				// com SW novo + UI antiga ainda aberta).
				setTargetTab((prev) => ({
					id: typeof message.tabId === 'number' ? message.tabId : prev.id,
					title: message.tabTitle ?? prev.title,
					url: message.tabUrl ?? prev.url,
					closed: false,
				}));
			} else if (message.action === 'targetTabClosed') {
				// `id` vira null mas preservamos title/url do último estado conhecido
				// para que o usuário identifique qual aba sumiu.
				setTargetTab((prev) => ({
					id: null,
					title: message.tabTitle || prev.title,
					url: message.tabUrl || prev.url,
					closed: true,
				}));
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		return () => {
			clearInterval(interval);
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, [checkDebuggingStatus, loadTargetTabInfo]);

	return {
		isDebugging,
		loading,
		targetTab,
		startDebugging,
		stopDebugging,
		selectTargetTab,
		checkDebuggingStatus,
	};
}
