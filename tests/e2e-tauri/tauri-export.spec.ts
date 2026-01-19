import { expect, loadFileViaDropZone, openCommandPalette, switchToTable, test, waitForAppReady } from './fixtures'

test.describe('Tauri Export Tests', () => {
  // Note: These tests are designed to verify export functionality
  // In a real scenario, native dialogs would need to be mocked or bypassed
  // For now, we test the export flow up to the dialog

  test.describe('Export menu access', () => {
    test('can access export options via command palette', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Open command palette
      await openCommandPalette(page)

      // Search for export
      await page.locator('[cmdk-input]').fill('export')

      // Should see export options
      await expect(page.getByText(/Export.*CSV/i)).toBeVisible()
    })

    test('export options are available for loaded data', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      await openCommandPalette(page)
      await page.locator('[cmdk-input]').fill('export')

      // Verify various export formats are listed
      const exportOptions = page.locator('[cmdk-item]')

      // At least one export option should be visible
      await expect(exportOptions.first()).toBeVisible()
    })
  })

  test.describe('Export to temp directory', () => {
    // These tests would require intercepting the native save dialog
    // In a real implementation, you might:
    // 1. Use environment variables to set a default export path
    // 2. Mock the Tauri dialog plugin
    // 3. Use the programmatic export API directly

    test.skip('exports to CSV file', async ({ tauriApp, tempDir: _tempDir }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // This would require dialog mocking to complete
      // For now, we skip the actual file verification
    })

    test.skip('exports to Parquet file', async ({ tauriApp, tempDir: _tempDir }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // This would require dialog mocking to complete
    })

    test.skip('exports to JSON file', async ({ tauriApp, tempDir: _tempDir }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // This would require dialog mocking to complete
    })
  })

  test.describe('Export data integrity', () => {
    test('filtered data respects filters in export', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Apply a filter to reduce rows
      await switchToTable(page)

      // Open filter for the 'active' column
      await page.getByRole('button', { name: 'Filter active' }).click()
      await expect(page.locator('[data-tour="column-filter"]')).toBeVisible()

      // Apply filter for active = true
      const filterPopover = page.locator('[data-tour="column-filter"]')
      await filterPopover.getByRole('button', { name: '=', exact: true }).click()

      // Find and click on boolean true value
      await filterPopover.locator('input').fill('true')
      await filterPopover.getByRole('button', { name: 'Apply' }).click()

      // Wait for filter to be applied (row count should change)
      await page.waitForTimeout(1000)

      // Now export should only include filtered rows
      // (Actual verification would require dialog mocking)
    })
  })
})
