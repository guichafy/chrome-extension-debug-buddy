import { defineConfig } from '@playwright/test';

// Config separada da suíte E2E: gera as screenshots do README em
// `docs/images/` (`npm run docs:screenshots`). Não roda em CI e não usa o
// globalSetup do E2E (que apaga `e2e/evidence`).
export default defineConfig({
	testDir: './e2e/docs',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 10_000 },
	reporter: 'list',
	webServer: {
		command: 'tsx e2e/docs/fixtures/demo-server.ts',
		port: 3200,
		reuseExistingServer: true,
		timeout: 10_000,
	},
});
