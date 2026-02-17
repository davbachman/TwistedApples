import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const pagesBase = isGitHubActions ? '/TwistedApples/' : '/';

export default defineConfig({
  base: pagesBase,
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        calibrate: resolve(__dirname, 'calibrate.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
  },
});
