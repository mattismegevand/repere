import { _electron, type BrowserContext, test as base, expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '../..')
const FIXTURES_DIR = path.join(__dirname, '../fixtures')

// Timeouts for Tauri app operations
const APP_STARTUP_TIMEOUT = 30000
const _DATA_LOAD_TIMEOUT = 10000

// Temp directory for test outputs
const TEMP_DIR = path.join(os.tmpdir(), 'repere-e2e-tests')

/**
 * Custom test fixture that launches the Tauri app
 */
export const test = base.extend<{
  tauriApp: { page: Page; context: BrowserContext; cleanup: () => Promise<void> }
  tempDir: string
}>({
  tauriApp: async (_deps, use) => {
    // Determine the app path based on platform
    const platform = process.platform
    let appPath: string

    if (platform === 'darwin') {
      appPath = path.join(PROJECT_ROOT, 'src-tauri/target/debug/bundle/macos/repere.app/Contents/MacOS/repere')
    } else if (platform === 'win32') {
      appPath = path.join(PROJECT_ROOT, 'src-tauri/target/debug/repere.exe')
    } else {
      appPath = path.join(PROJECT_ROOT, 'src-tauri/target/debug/repere')
    }

    // Check if the app binary exists
    if (!fs.existsSync(appPath)) {
      // Try the non-bundled debug binary
      appPath =
        platform === 'win32'
          ? path.join(PROJECT_ROOT, 'src-tauri/target/debug/repere.exe')
          : path.join(PROJECT_ROOT, 'src-tauri/target/debug/repere')
    }

    if (!fs.existsSync(appPath)) {
      throw new Error(`Tauri app not found at ${appPath}. Run "bun run tauri build --debug" first.`)
    }

    // Launch the Tauri app using Playwright's Electron API
    // Tauri apps use a webview, which we can control via the electron API
    const electronApp = await _electron.launch({
      executablePath: appPath,
      timeout: APP_STARTUP_TIMEOUT,
    })

    // Get the first window
    const page = await electronApp.firstWindow()
    const context = page.context()

    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded')

    await use({
      page,
      context,
      cleanup: async () => {
        await electronApp.close()
      },
    })

    // Cleanup
    await electronApp.close()
  },

  tempDir: async (_deps, use) => {
    // Create a temp directory for this test
    const testTempDir = path.join(TEMP_DIR, `test-${Date.now()}`)
    fs.mkdirSync(testTempDir, { recursive: true })

    await use(testTempDir)

    // Cleanup after test
    fs.rmSync(testTempDir, { recursive: true, force: true })
  },
})

export { expect }

/**
 * Wait for the app to be fully loaded and ready
 */
export async function waitForAppReady(page: Page) {
  await expect(page.getByText('Drop a file to start exploring')).toBeVisible({
    timeout: APP_STARTUP_TIMEOUT,
  })
}

/**
 * Load a file using the drop zone (similar to web tests but for Tauri)
 */
export async function loadFileViaDropZone(page: Page, filename: string, mimeType = 'text/csv') {
  const filePath = path.join(FIXTURES_DIR, filename)
  const buffer = fs.readFileSync(filePath)

  const dataTransfer = await page.evaluateHandle(
    ({ bufferData, name, mime }) => {
      const dt = new DataTransfer()
      const file = new File([new Uint8Array(bufferData)], name, { type: mime })
      dt.items.add(file)
      return dt
    },
    { bufferData: Array.from(buffer), name: filename, mime: mimeType }
  )

  const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
  await dropZone.dispatchEvent('drop', { dataTransfer })
}

/**
 * Copy a fixture file to the temp directory for native file loading tests
 */
function _copyFixtureToTemp(filename: string, tempDir: string): string {
  const srcPath = path.join(FIXTURES_DIR, filename)
  const destPath = path.join(tempDir, filename)
  fs.copyFileSync(srcPath, destPath)
  return destPath
}

/**
 * Switch to table view
 */
export async function switchToTable(page: Page) {
  const switchToTableBtn = page.getByRole('button', { name: /Switch to Table/i })
  if (await switchToTableBtn.isVisible()) {
    await switchToTableBtn.click()
  }
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 5000 })
}

/**
 * Switch to canvas view
 */
async function _switchToCanvas(page: Page) {
  const switchToCanvasBtn = page.getByRole('button', { name: /Switch to Canvas/i })
  if (await switchToCanvasBtn.isVisible()) {
    await switchToCanvasBtn.click()
  }
  await expect(page.locator('.react-flow')).toBeVisible()
}

/**
 * Open command palette
 */
export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[cmdk-input]')).toBeVisible()
}

export { FIXTURES_DIR }
