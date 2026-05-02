import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import fs from 'fs';

// Plugin que resolve specifiers virtuais `rrweb-player-umd?raw` e
// `rrweb-player-css?raw` lendo direto do disco e retornando como módulo ESM
// que exporta uma string default.
//
// Por que não usar `?raw` nativo do Vite com alias:
// 1. O package `rrweb-player` tem `exports` field travado — bloqueia import
//    de `dist/rrweb-player.umd.min.cjs` direto.
// 2. Aliases que devolvem path real `.css` fazem o Vite passar pelo pipeline
//    de CSS modules, que ignora o `?raw` e devolve string vazia.
// 3. Virtual modules com `\0` prefix evitam ambos os problemas — Vite trata
//    como conteúdo opaco.
function rrwebPlayerRawResolver(rootDir: string): Plugin {
	const VIRT_UMD = 'rrweb-player-umd?raw';
	const VIRT_CSS = 'rrweb-player-css?raw';
	const RESOLVED_UMD = '\0rrweb-player-umd-raw';
	const RESOLVED_CSS = '\0rrweb-player-css-raw';
	const umdPath = path.resolve(
		rootDir,
		'node_modules/rrweb-player/dist/rrweb-player.umd.min.cjs',
	);
	const cssPath = path.resolve(rootDir, 'node_modules/rrweb-player/dist/style.css');
	return {
		name: 'debug-buddy:rrweb-player-raw-resolver',
		enforce: 'pre',
		resolveId(source) {
			if (source === VIRT_UMD) return RESOLVED_UMD;
			if (source === VIRT_CSS) return RESOLVED_CSS;
			return null;
		},
		load(id) {
			if (id === RESOLVED_UMD) {
				const content = fs.readFileSync(umdPath, 'utf8');
				return `export default ${JSON.stringify(content)};`;
			}
			if (id === RESOLVED_CSS) {
				const content = fs.readFileSync(cssPath, 'utf8');
				return `export default ${JSON.stringify(content)};`;
			}
			return null;
		},
	};
}

const REACT_DEVTOOLS_URL = 'http://localhost:8097';

// Injeta o standalone React DevTools (npm run devtools) em options.html/sidepanel.html
// somente quando mode === 'development'. A extensão React Developer Tools do Chrome
// não consegue inspecionar páginas chrome-extension://, então usamos a versão Electron
// que escuta WebSocket em localhost:8097.
function reactDevtoolsHtmlInject(mode: string): Plugin {
	return {
		name: 'debug-buddy:inject-react-devtools',
		apply: 'build',
		transformIndexHtml: {
			order: 'pre',
			handler(_html, ctx) {
				if (mode !== 'development') return;
				const file = ctx.filename.replace(/\\/g, '/');
				if (!/\/(options|sidepanel)\.html$/.test(file)) return;
				return [
					{
						tag: 'script',
						attrs: { src: REACT_DEVTOOLS_URL },
						injectTo: 'head-prepend',
					},
				];
			},
		},
	};
}

export default defineConfig(({ mode }) => {
	if (mode === 'development') {
		// `vite build` força NODE_ENV=production por default no processo Node, mesmo
		// com --mode development. Isso fazia @vitejs/plugin-react escolher jsx-runtime
		// em vez de jsx-dev-runtime, e sem ele o Babel não injeta __source/__self —
		// resultado: o React DevTools cai no stack-trace fallback e mostra o arquivo
		// bundled (routes-*.js) em vez do .tsx original. Forçar NODE_ENV aqui é
		// suficiente porque este callback roda antes do plugin react ser instanciado.
		process.env.NODE_ENV = 'development';
	}
	return {
		root: '.',
		build: {
			outDir: 'dist',
			emptyOutDir: true,
			rollupOptions: {
				input: {
					options: path.resolve(__dirname, 'options.html'),
					sidepanel: path.resolve(__dirname, 'sidepanel.html'),
					sandbox: path.resolve(__dirname, 'sandbox.html'),
					offscreen: path.resolve(__dirname, 'offscreen.html'),
					background: path.resolve(__dirname, 'src/entrypoints/background.ts'),
					main: path.resolve(__dirname, 'src/entrypoints/options/main.tsx'),
					'probe-main': path.resolve(__dirname, 'src/probe/main.ts'),
					'probe-bridge': path.resolve(__dirname, 'src/probe/bridge.ts'),
					'rrweb-recorder': path.resolve(__dirname, 'src/probe/rrwebRecorder.ts'),
				},
				output: {
					entryFileNames: '[name].js',
				},
			},
			sourcemap: mode !== 'production',
			minify: mode === 'production',
		},
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
			extensions: ['.tsx', '.ts', '.js', '.jsx'],
		},
		plugins: [
			rrwebPlayerRawResolver(__dirname),
			react(),
			tailwindcss(),
			reactDevtoolsHtmlInject(mode),
			viteStaticCopy({
				targets: [
					{
						src: 'manifest.json',
						dest: '.',
						transform: (content) => {
							if (mode !== 'development') return content;
							const manifest = JSON.parse(content.toString());
							manifest.content_security_policy = {
								extension_pages: `script-src 'self' ${REACT_DEVTOOLS_URL}; object-src 'self'`,
							};
							return JSON.stringify(manifest, null, 2);
						},
					},
					{ src: 'images', dest: '.' },
				],
			}),
		],
	};
});
