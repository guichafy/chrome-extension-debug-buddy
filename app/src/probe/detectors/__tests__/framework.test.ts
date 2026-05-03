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

	it('detecta React 18 via fallback __reactContainer$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactContainer$xyz = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React 17 via fallback __reactFiber$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactFiber$abc = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React 16 via fallback __reactInternalInstance$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactInternalInstance$xyz = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React via renderers em formato Record', () => {
		(
			window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }
		).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: { '1': { version: '17.0.2' } },
		};
		expect(detectFramework()).toEqual({ name: 'react', version: '17.0.2' });
	});

	it('ignora window.ng quando objeto não tem APIs do Angular (false positive guard)', () => {
		// AngularJS e libs que squatam window.ng não devem virar Angular detection
		(window as unknown as { ng: unknown }).ng = { version: 'AngularJS 1.x' };
		expect(detectFramework()).toEqual({ name: 'vanilla' });
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

	it('detectAngular detecta via app-root sem ng-version (prod build)', () => {
		document.body.innerHTML = '<app-root></app-root>';
		const result = detectFramework();
		expect(result.name).toBe('angular');
		expect(result.version).toBeUndefined();
	});

	it('detectAngular detecta via _ngcontent attribute', () => {
		document.body.innerHTML = '<div _ngcontent-abc="" class="app">x</div>';
		const result = detectFramework();
		expect(result.name).toBe('angular');
	});

	it('detectAngular não confunde div sem markers (vanilla)', () => {
		document.body.innerHTML = '<div class="app">x</div>';
		const result = detectFramework();
		expect(result.name).toBe('vanilla');
	});
});
