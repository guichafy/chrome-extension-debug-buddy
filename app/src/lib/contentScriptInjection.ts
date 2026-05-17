// Tabs criadas ANTES da extensão instalar/atualizar não recebem auto-injection
// dos content scripts declarados no manifest. Resultado prático: o background
// tenta `chrome.tabs.sendMessage(tabId, { action: '__rrweb_start' })`, recebe
// "Could not establish connection. Receiving end does not exist." e a sessão
// de gravação nasce zumbi (sem rrweb events; UI sem dot pulsante). O usuário
// vê depois "Sessão gravada antes da Fase 2 ou com rrweb desabilitado".
//
// Esta função é o fallback: ping primeiro (rápido se já injetado); se rejeita
// com o erro específico de "no listener", injetamos via chrome.scripting.
// Outros erros (tab fechada, URL proibida, sem permissão) propagam — o caller
// decide se aborta ou segue em modo degradado.

const CONNECTION_FAILED_FRAGMENT = 'Could not establish connection';

export interface ContentScriptFile {
	file: string;
	world: chrome.scripting.ExecutionWorld;
}

// Espelha exatamente o que o manifest declara em content_scripts. Mantemos a
// lista aqui para que a injeção manual seja simétrica.
export const CONTENT_SCRIPT_FILES: ContentScriptFile[] = [
	{ file: 'probe-main.js', world: 'MAIN' },
	{ file: 'probe-bridge.js', world: 'ISOLATED' },
	{ file: 'rrweb-recorder.js', world: 'ISOLATED' },
];

export interface InjectionDeps {
	sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
	executeScript: (
		injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
	) => Promise<chrome.scripting.InjectionResult<unknown>[]>;
}

const defaultDeps: InjectionDeps = {
	sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
	executeScript: (injection) => chrome.scripting.executeScript(injection),
};

export async function ensureContentScriptsInjected(
	tabId: number,
	deps: InjectionDeps = defaultDeps,
): Promise<{ injected: boolean }> {
	try {
		await deps.sendMessage(tabId, { action: '__contentScriptPing' });
		return { injected: false };
	} catch (err) {
		if (!String(err).includes(CONNECTION_FAILED_FRAGMENT)) {
			throw err;
		}
	}
	for (const { file, world } of CONTENT_SCRIPT_FILES) {
		await deps.executeScript({
			target: { tabId },
			files: [file],
			world,
		});
	}
	return { injected: true };
}
