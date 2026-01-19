import { expect, loadFileViaDropZone, switchToTable, test, waitForAppReady } from './fixtures'

test.describe('Tauri App Basic Tests', () => {
  test('app launches and shows home screen', async ({ tauriApp }) => {
    const { page } = tauriApp

    // Wait for the app to be ready
    await waitForAppReady(page)

    // Verify the main UI elements are present
    await expect(page.getByText('repere')).toBeVisible()
    await expect(page.getByText('Drop a file to start exploring')).toBeVisible()
  })

  test('DuckDB initializes correctly', async ({ tauriApp }) => {
    const { page } = tauriApp

    await waitForAppReady(page)

    // Load a sample file to verify DuckDB works
    await loadFileViaDropZone(page, 'sample.csv')

    // Should show row count after loading
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('can load CSV file and display data', async ({ tauriApp }) => {
    const { page } = tauriApp

    await waitForAppReady(page)
    await loadFileViaDropZone(page, 'sample.csv')
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

    // Switch to table view
    await switchToTable(page)

    // Verify data is displayed
    await expect(page.getByRole('grid')).toBeVisible()

    // Check that column headers are present
    await expect(page.getByRole('columnheader', { name: /id/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /value/i })).toBeVisible()
  })

  test('can switch between canvas and table views', async ({ tauriApp }) => {
    const { page } = tauriApp

    await waitForAppReady(page)
    await loadFileViaDropZone(page, 'sample.csv')
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

    // Default should be canvas view after loading
    await expect(page.locator('.react-flow')).toBeVisible()

    // Switch to table
    await page.getByRole('button', { name: /Switch to Table/i }).click()
    await expect(page.getByRole('grid')).toBeVisible()

    // Switch back to canvas
    await page.getByRole('button', { name: /Switch to Canvas/i }).click()
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('keyboard shortcuts work', async ({ tauriApp }) => {
    const { page } = tauriApp

    await waitForAppReady(page)

    // Test command palette shortcut
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[cmdk-input]')).toBeVisible()

    // Close it
    await page.keyboard.press('Escape')
    await expect(page.locator('[cmdk-input]')).not.toBeVisible()
  })
})
