export {};

// Sandbox para execução de scripts avançados de Transform.
//
// Esta página é declarada em `manifest.json` como `sandbox.pages` — Chrome
// MV3 a serve em uma origem nula sem acesso a APIs de extensão e sem o CSP
// padrão de extension_pages, permitindo `new Function(...)` necessário para
// avaliar o código do usuário no preview do editor.
//
// Comunicação acontece via `postMessage`. O parent envia
// `{ id, script, response }` e recebe `{ id, ok: true, output } |
// { id, ok: false, error }`.

interface SandboxRequest {
	id: string;
	script: string;
	response: unknown;
}

interface SandboxOk {
	id: string;
	ok: true;
	output: unknown;
}

interface SandboxFail {
	id: string;
	ok: false;
	error: string;
}

type SandboxReply = SandboxOk | SandboxFail;

function isRequest(value: unknown): value is SandboxRequest {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === 'string' && typeof v.script === 'string' && 'response' in v;
}

window.addEventListener('message', (event: MessageEvent) => {
	const data = event.data;
	if (!isRequest(data)) return;

	const reply = (msg: SandboxReply) => {
		// Sandbox pages enviam para a janela parent — origem null exige '*'.
		if (event.source && 'postMessage' in event.source) {
			(event.source as Window).postMessage(msg, { targetOrigin: '*' });
		}
	};

	let fn: (response: unknown) => unknown;
	try {
		// O script é o corpo de uma função `(response) => ...`. Usamos
		// `Function` para aceitar tanto expressões (`{ ... }`) quanto blocos
		// com `return`. O parser tenta primeiro como bloco; se falhar com
		// SyntaxError, tenta como expressão.
		fn = new Function('response', data.script) as (response: unknown) => unknown;
	} catch (err) {
		reply({ id: data.id, ok: false, error: `Erro de sintaxe: ${(err as Error).message}` });
		return;
	}

	try {
		const output = fn(data.response);
		// Garante que o resultado é serializável via structured clone.
		reply({ id: data.id, ok: true, output });
	} catch (err) {
		reply({
			id: data.id,
			ok: false,
			error: `Erro de execução: ${(err as Error).message}`,
		});
	}
});

// Sinaliza que o sandbox está pronto. O parent pode ignorar ou usar para
// ativar o painel de preview apenas após o iframe carregar.
window.parent?.postMessage({ type: 'debug-buddy-sandbox-ready' }, '*');
