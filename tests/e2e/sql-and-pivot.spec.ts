import { expect, test } from '@playwright/test'
import { loadSampleCSV, openCommandPalette, switchToCanvas, switchToTable, waitForAppReady } from './fixtures'

test.describe('SQL panel', () => {
  // Skip SQL tests - CodeMirror has a dependency conflict causing panel to crash
  // Error: multiple instances of @codemirror/state are loaded
  test.skip('runs a query and creates a SQL node', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    // Open SQL panel via command palette
    await openCommandPalette(page)
    // Search for SQL in the command palette
    await page.locator('[cmdk-input]').fill('sql')
    await page.getByText('Custom SQL').click()
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Run' }).click()
    await expect(page.getByText(/rows? in \d+ms/)).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Create view' }).click()
    // Wait for SQL panel to close
    await expect(page.getByRole('button', { name: 'Run' })).not.toBeVisible({ timeout: 5000 })

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL' })).toBeVisible()
  })

  test.skip('adds queries to history and restores them', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    // Open SQL panel via command palette
    await openCommandPalette(page)
    await page.locator('[cmdk-input]').fill('sql')
    await page.getByText('Custom SQL').click()
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible({ timeout: 5000 })

    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.press('Meta+a')
    await page.keyboard.type('select 1 as one;')

    await page.getByRole('button', { name: 'Run' }).click()
    await expect(page.getByText(/1 row in \d+ms/)).toBeVisible({ timeout: 20000 })

    // Click History button and select from dropdown
    await page.getByRole('button', { name: 'History' }).click()
    await page
      .getByText(/select 1 as one/i)
      .first()
      .click()

    // Verify the query was restored
    await expect(editor).toContainText('select 1 as one')
  })
})

test.describe('Pivot panel', () => {
  test('builds a pivot preview from drag and drop', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    await page.keyboard.press('Meta+k')
    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('Pivot Table Fields')).toBeVisible()

    const pivotPanel = page.getByText('Pivot Table Fields').locator('..').locator('..')
    const categoryField = pivotPanel.getByText('category', { exact: true })
    const valueField = pivotPanel.getByText('value', { exact: true })

    const rowsZone = pivotPanel.getByText('Drag fields for row grouping')
    const valuesZone = pivotPanel.getByText('Drag fields to aggregate')

    await categoryField.dragTo(rowsZone)
    await valueField.dragTo(valuesZone)

    await expect(pivotPanel.getByRole('button', { name: 'Remove' })).toBeVisible()
    await expect(page.getByText('Configure your pivot table')).not.toBeVisible({ timeout: 20000 })
  })

  test('clicking pivot cell creates a filtered view', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    await page.keyboard.press('Meta+k')
    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('Pivot Table Fields')).toBeVisible()

    const pivotPanel = page.getByText('Pivot Table Fields').locator('..').locator('..')
    const categoryField = pivotPanel.getByText('category', { exact: true })
    const valueField = pivotPanel.getByText('value', { exact: true })

    const rowsZone = pivotPanel.getByText('Drag fields for row grouping')
    const valuesZone = pivotPanel.getByText('Drag fields to aggregate')

    await categoryField.dragTo(rowsZone)
    await valueField.dragTo(valuesZone)

    await expect(page.getByRole('columnheader', { name: 'Row Labels' })).toBeVisible({ timeout: 20000 })

    const pivotRow = page.locator('table tbody tr').filter({ hasText: 'A' }).first()
    await pivotRow.locator('td').nth(1).click()

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Filtered' })).toBeVisible()
  })
})
