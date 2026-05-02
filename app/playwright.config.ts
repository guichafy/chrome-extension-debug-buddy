import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e/tests',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: process.env.CI ? [['github'], ['html']] : 'list',
	use: {
		trace: 'on-first-retry',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	globalSetup: './e2e/helpers/global-setup.ts',
	webServer: {
		command: 'tsx e2e/fixtures/server.ts',
		port: 3100,
		reuseExistingServer: !process.env.CI,
		timeout: 10_000,
	},
});
