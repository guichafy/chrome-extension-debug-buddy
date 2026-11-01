import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e/performance',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	grepInvert: process.env.PERF_SOAK === '1' ? undefined : /@soak/,
	outputDir: 'performance-results',
	reporter: [['list'], ['html', { outputFolder: 'performance-report', open: 'never' }]],
	globalSetup: './e2e/helpers/global-setup.ts',
	webServer: {
		command: 'tsx e2e/fixtures/server.ts',
		port: 3100,
		reuseExistingServer: !process.env.CI,
		timeout: 10_000,
	},
});
