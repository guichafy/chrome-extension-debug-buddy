import type { FrameworkName } from '@/lib/session/types';

interface FrameworkResult {
	name: FrameworkName;
	version?: string;
}

interface ReactDevtoolsHook {
	renderers?: Map<number, { version?: string }> | Record<string, { version?: string }>;
}

function detectReact(): FrameworkResult | null {
	const hook = (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevtoolsHook })
		.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	if (hook?.renderers) {
		const renderers = hook.renderers;
		if (renderers instanceof Map) {
			for (const r of renderers.values()) {
				if (r.version) return { name: 'react', version: r.version };
			}
			if (renderers.size > 0) return { name: 'react' };
		} else {
			for (const r of Object.values(renderers)) {
				if (r.version) return { name: 'react', version: r.version };
			}
			if (Object.keys(renderers).length > 0) return { name: 'react' };
		}
	}
	if (hook) return { name: 'react' };

	// Fallback: fiber container em qualquer elemento root comum.
	// React 18: __reactContainer$. React 17: __reactFiber$. React 16: __reactInternalInstance$.
	const candidates = document.querySelectorAll('[data-reactroot], #root, #__next');
	for (const node of candidates) {
		const keys = Object.keys(node as unknown as Record<string, unknown>);
		if (
			keys.some(
				(k) =>
					k.startsWith('__reactContainer') ||
					k.startsWith('__reactFiber') ||
					k.startsWith('__reactInternalInstance'),
			)
		) {
			return { name: 'react' };
		}
	}
	return null;
}

interface AngularNgGlobal {
	getComponent?: unknown;
	getDirectives?: unknown;
	getDebugNode?: unknown;
}

function detectAngular(): FrameworkResult | null {
	const ngObj = (window as unknown as { ng?: AngularNgGlobal }).ng;
	// Guard contra false positive: AngularJS e libs que squatam `ng` não têm getComponent/etc.
	const hasNgApis =
		ngObj !== undefined &&
		ngObj !== null &&
		typeof ngObj === 'object' &&
		('getComponent' in ngObj || 'getDirectives' in ngObj || 'getDebugNode' in ngObj);
	const versioned = document.querySelector('[ng-version]');
	if (versioned) {
		const version = versioned.getAttribute('ng-version') ?? undefined;
		return { name: 'angular', version };
	}
	if (hasNgApis) return { name: 'angular' };
	return null;
}

export function detectFramework(): FrameworkResult {
	return detectReact() ?? detectAngular() ?? { name: 'vanilla' };
}
