import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Vite dev injects <style> tags and an HMR websocket, which the strict production CSP forbids. */
const devWithoutCsp = (): Plugin => ({
  name: 'dev-without-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, ''),
});

export default defineConfig({
  plugins: [svelte(), devWithoutCsp()],
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
