import { defineConfig, type Plugin } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Espelha o resolver custom de vite.config.mts. Vê o comentário detalhado
// lá pro racional — `rrweb-player` tem `exports` travado e o pipeline de
// CSS modules do Vite ignora `?raw` em arquivos `.css`. Solução: virtual
// module que lê o arquivo direto do disco e exporta como string.
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

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: [
			'src/**/__tests__/**/*.{ts,tsx}',
			'src/**/*.{test,spec}.{ts,tsx}',
		],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	plugins: [rrwebPlayerRawResolver(__dirname)],
});

