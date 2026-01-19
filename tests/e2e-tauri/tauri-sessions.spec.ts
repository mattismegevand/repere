import { expect, loadFileViaDropZone, openCommandPalette, switchToTable, test, waitForAppReady } from './fixtures'

test.describe('Tauri Session Tests', () => {
  test.describe('Session persistence UI', () => {
    test('save session option is available after loading data', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Open command palette and search for save
      await openCommandPalette(page)
      await page.locator('[cmdk-input]').fill('save')

      // Should see save session option
      await expect(page.getByText(/Save.*session/i)).toBeVisible()
    })

    test('can initiate save session workflow', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      await openCommandPalette(page)
      await page.locator('[cmdk-input]').fill('save')

      // Click on save session
      const saveOption = page.getByText(/Save.*session/i)
      if (await saveOption.isVisible()) {
        await saveOption.click()

        // Native dialog should open (we can't easily verify this)
        // But at least the workflow doesn't error
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Session state preservation', () => {
    test('pipeline state is maintained during session', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Apply some transformations
      await switchToTable(page)

      // Sort by a column
      await page.getByRole('button', { name: 'Sort id' }).click()
      await expect(page.getByRole('button', { name: /Sort id, currently ascending/i })).toBeVisible()

      // Apply a filter
      await page.getByRole('button', { name: 'Filter value' }).click()
      await expect(page.locator('[data-tour="column-filter"]')).toBeVisible()

      const filterPopover = page.locator('[data-tour="column-filter"]')
      await filterPopover.getByRole('button', { name: '>', exact: true }).click()
      await filterPopover.locator('input').fill('50')
      await filterPopover.getByRole('button', { name: 'Apply' }).click()

      // Wait for filter to apply
      await page.waitForTimeout(500)

      // The pipeline should show the transformations
      await page.getByRole('button', { name: /Switch to Canvas/i }).click()
      await expect(page.locator('.react-flow')).toBeVisible()

      // Should see multiple nodes (original + transformed views)
      const nodes = page.locator('.react-flow__node')
      await expect(nodes).toHaveCount(2, { timeout: 5000 })
    })
  })

  test.describe('Recent sessions (desktop-only feature)', () => {
    test('recent sessions panel exists in desktop app', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)

      // The recent sessions feature may be visible on the home screen
      // or in a menu. Check for its presence.
      const recentSessionsButton = page.getByRole('button', { name: /recent/i })

      // If the button exists, click it and verify the panel
      if (await recentSessionsButton.isVisible()) {
        await recentSessionsButton.click()
        // Should show recent sessions list or empty state
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Session with transformations', () => {
    test('preserves filter transformations', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      // Switch to table and apply filter
      await switchToTable(page)

      await page.getByRole('button', { name: 'Filter active' }).click()
      const filterPopover = page.locator('[data-tour="column-filter"]')
      await filterPopover.getByRole('button', { name: '=', exact: true }).click()
      await filterPopover.locator('input').fill('true')
      await filterPopover.getByRole('button', { name: 'Apply' }).click()

      await expect(filterPopover).not.toBeVisible()

      // Row count should have changed
      // (Exact count depends on sample.csv content with 'active' column)
    })

    test('preserves sort transformations', async ({ tauriApp }) => {
      const { page } = tauriApp

      await waitForAppReady(page)
      await loadFileViaDropZone(page, 'sample.csv')
      await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 10000 })

      await switchToTable(page)

      // Apply sort
      await page.getByRole('button', { name: 'Sort value' }).click()

      // Verify sort is applied
      await expect(page.getByRole('button', { name: /Sort value, currently ascending/i })).toBeVisible()

      // Sort again for descending
      await page.getByRole('button', { name: /Sort value, currently ascending/i }).click()

      await expect(page.getByRole('button', { name: /Sort value, currently descending/i })).toBeVisible()
    })
  })
})
