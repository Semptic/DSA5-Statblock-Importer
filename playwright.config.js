import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:30000',
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  workers: 1,
})
