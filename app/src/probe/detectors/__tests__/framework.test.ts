import { afterEach, describe, expect, it } from 'vitest';
import { detectFramework } from '../framework';

declare global {
	interface Window {
		__REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
		ng?: unknown;
	}
}

describe('detectFramework', () => {
	afterEach(() => {
		(
			window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }
		).__REACT_DEVTOOLS_GLOBAL_HOOK__ = undefined;
		(window as unknown as { ng?: unknown }).ng = undefined;
		document.body.innerHTML = '';
	});

	it('detecta React via __REACT_DEVTOOLS_GLOBAL_HOOK__ com versão', () => {
		(
			window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }
		).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: new Map([[1, { version: '18.2.0' }]]),
		};
		expect(detectFramework()).toEqual({ name: 'react', version: '18.2.0' });
	});

	it('detecta React via hook sem versão (renderers vazio)', () => {
		(
			window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }
		).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: new Map(),
		};
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React via fallback (fiber em root)', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactContainer$xyz = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta Angular via window.ng + ng-version', () => {
		(window as unknown as { ng: unknown }).ng = { getComponent: () => null };
		const meta = document.createElement('app-root');
		meta.setAttribute('ng-version', '17.3.0');
		document.body.appendChild(meta);
		expect(detectFramework()).toEqual({ name: 'angular', version: '17.3.0' });
	});

	it('detecta Angular só via ng-version (sem window.ng)', () => {
		const meta = document.createElement('app-root');
		meta.setAttribute('ng-version', '14.0.0');
		document.body.appendChild(meta);
		expect(detectFramework()).toEqual({ name: 'angular', version: '14.0.0' });
	});

	it('retorna vanilla quando nada é detectado', () => {
		expect(detectFramework()).toEqual({ name: 'vanilla' });
	});
});
