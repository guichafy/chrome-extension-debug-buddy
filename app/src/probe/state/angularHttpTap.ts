import { PROBE_NAMESPACE } from '../protocol';

interface AngularHttpTagPayload {
	url: string;
	method: string;
	timestampHint: number;
	confidence: 'high' | 'medium' | 'low';
}

interface AngularGlobals {
	ng?: {
		getComponent?: (el: unknown) => unknown;
		getContext?: (el: unknown) => unknown;
	};
}

function detectAngularContext(): boolean {
	const ng = (window as unknown as AngularGlobals).ng;
	if (ng?.getComponent && ng?.getContext) return true;
	const hasAppRoot = !!document.querySelector('app-root');
	const hasNgContent =
		!!document.querySelector('[_ngcontent-ng-c0]') ||
		document.documentElement.outerHTML.includes('_ngcontent-');
	return hasAppRoot && hasNgContent;
}

function isHttpClientCallSite(stackString: string): boolean {
	if (/HttpClient\.|HttpHandler\.|HttpInterceptor/.test(stackString)) return true;
	if (/_HttpClient|HttpXhrBackend/.test(stackString)) return true;
	return false;
}

// NOTA: o teste unitário desta função em jsdom cobre apenas o ciclo
// install/uninstall — mockar o stack do Error globalmente é frágil. A heurística
// `isHttpClientCallSite` é exercitada em apps Angular reais durante uso normal.
export function installAngularHttpTap(): { uninstall: () => void } | null {
	if (!detectAngularContext()) return null;

	const origOpen = XMLHttpRequest.prototype.open;
	const origSend = XMLHttpRequest.prototype.send;

	type TaggedXhr = XMLHttpRequest & {
		__dbb_method?: string;
		__dbb_url?: string;
		__dbb_isAngular?: boolean;
	};

	XMLHttpRequest.prototype.open = function (
		this: TaggedXhr,
		method: string,
		url: string | URL,
		...rest: unknown[]
	) {
		this.__dbb_method = String(method).toUpperCase();
		this.__dbb_url = typeof url === 'string' ? url : url.toString();
		const stack = new Error().stack ?? '';
		this.__dbb_isAngular = isHttpClientCallSite(stack);
		return origOpen.apply(this, [method, url, ...rest] as Parameters<typeof origOpen>);
	};

	XMLHttpRequest.prototype.send = function (
		this: TaggedXhr,
		body?: Document | XMLHttpRequestBodyInit | null,
	) {
		if (this.__dbb_isAngular && this.__dbb_url && this.__dbb_method) {
			const payload: AngularHttpTagPayload = {
				url: this.__dbb_url,
				method: this.__dbb_method,
				timestampHint: Date.now(),
				confidence: 'high',
			};
			window.postMessage(
				{ ns: PROBE_NAMESPACE, type: 'probe:angular-http-tag', payload },
				location.origin,
			);
		}
		return origSend.call(this, body ?? null);
	};

	return {
		uninstall: () => {
			XMLHttpRequest.prototype.open = origOpen;
			XMLHttpRequest.prototype.send = origSend;
		},
	};
}
