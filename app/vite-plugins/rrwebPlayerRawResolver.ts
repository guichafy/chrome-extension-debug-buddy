import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

// Plugin compartilhado entre vite.config.mts e vitest.config.ts.
// Resolve specifiers virtuais `rrweb-player-umd?raw` e `rrweb-player-css?raw`
// lendo direto do disco e devolvendo módulo ESM com export default string.
//
// Por que não `?raw` nativo do Vite com alias direto:
// 1. O package `rrweb-player` tem `exports` field travado — bloqueia import
//    de `dist/rrweb-player.umd.min.cjs` direto.
// 2. Aliases que devolvem path real `.css` fazem o Vite passar pelo pipeline
//    de CSS modules, que ignora o `?raw` e devolve string vazia.
// 3. Virtual modules com prefix `\0` evitam ambos — Vite trata como conteúdo
//    opaco e o load hook entrega o texto literal.
//
// Mantemos a fonte única aqui pra evitar drift de manutenção quando o path
// do bundle do rrweb-player mudar em alpha.21+.
export function rrwebPlayerRawResolver(rootDir: string): Plugin {
	const VIRT_UMD = 'rrweb-player-umd?raw';
	const VIRT_CSS = 'rrweb-player-css?raw';
	const RESOLVED_UMD = '\0rrweb-player-umd-raw';
	const RESOLVED_CSS = '\0rrweb-player-css-raw';
	const umdPath = path.resolve(rootDir, 'node_modules/rrweb-player/dist/rrweb-player.umd.min.cjs');
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
