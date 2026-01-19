import { defineConfig } from '@playwright/test'

/**
 * Playwright config for Tauri E2E tests.
 *
 * These tests launch the actual Tauri desktop app and interact with it.
 * Unlike web E2E tests, these test native features like:
 * - File system access
 * - Native file dialogs
 * - Session persistence to disk
 * - Export to real files
 *
 * Prerequisites:
 * - Build the Tauri app first: `bun run tauri build --debug`
 * - Or run with dev mode: `bun run tauri dev`
 */
export default defineConfig({
  testDir: './tests/e2e-tauri',
  fullyParallel: false, // Run sequentially to avoid app conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for desktop app testing
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60000, // Longer timeout for desktop app startup
  expect: {
    timeout: 10000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
