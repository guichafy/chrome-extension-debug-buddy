import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const CONTENT_SCRIPT_ENTRIES = ['probe-main', 'probe-bridge', 'rrweb-recorder'];

/**
 * Vite/Rollup faz code-splitting de módulos compartilhados (ex: src/probe/protocol.ts)
 * em chunks separados, emitindo `import` statements nos entry chunks. Manifest V3
 * carrega content_scripts como CLASSIC SCRIPTS — `import` falha com SyntaxError no
 * load da página debugada.
 *
 * Solução: após o bundle do Vite terminar, re-bundle cada entry de content script
 * via esbuild com `bundle: true, format: 'iife'`. Tudo é inlinado em um único
 * arquivo, sem `import` statements. O plugin sobrescreve os 3 arquivos no dist/.
 *
 * Trade-off: protocol.ts (270 bytes) duplica em probe-main.js + probe-bridge.js.
 * Aceitável — content scripts são raramente atualizados e a duplicação é micro.
 */
export function inlineContentScripts(distDir: string): Plugin {
	return {
		name: 'debug-buddy:inline-content-scripts',
		apply: 'build',
		async closeBundle() {
			for (const entry of CONTENT_SCRIPT_ENTRIES) {
				const entryFile = path.resolve(distDir, `${entry}.js`);
				try {
					await fs.access(entryFile);
				} catch {
					// Arquivo não existe (build mudou) — pula sem falhar
					continue;
				}
				const result = await esbuild.build({
					entryPoints: [entryFile],
					bundle: true,
					format: 'iife',
					platform: 'browser',
					write: false,
					charset: 'ascii',
					target: 'es2022',
					sourcemap: false,
					logLevel: 'silent',
					// Permite resolver `./assets/protocol-*.js` relativo ao entry no dist/
					absWorkingDir: distDir,
				});
				const code = result.outputFiles[0]?.text;
				if (typeof code !== 'string') {
					throw new Error(`[inline-content-scripts] esbuild não produziu código para ${entry}`);
				}
				await fs.writeFile(entryFile, code, 'utf-8');
			}
		},
	};
}
