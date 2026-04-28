import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: path.resolve(__dirname, 'options.html'),
        sidepanel: path.resolve(__dirname, 'sidepanel.html'),
        background: path.resolve(__dirname, 'src/entrypoints/background.ts'),
        main: path.resolve(__dirname, 'src/entrypoints/options/main.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'images', dest: '.' },
        { src: 'lib', dest: '.' },
      ],
    }),
  ],
}); 