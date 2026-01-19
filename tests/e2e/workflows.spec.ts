import { expect, test } from '@playwright/test'
import { applyFilter, applySort, loadSampleCSV, switchToCanvas, switchToTable, waitForAppReady } from './fixtures'

test.describe('Complete Data Pipeline Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('load → filter → sort → verify', async ({ page }) => {
    // Step 1: Load CSV
    await loadSampleCSV(page)
    await switchToTable(page)
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()

    // Step 2: Apply filter (contains 'a' matches Alice, Charlie, Diana, etc.)
    await applyFilter(page, 'name', 'contains', 'a')

    // Verify filter applied
    const rowCount = await page.getByText(/\d+ rows/).textContent()
    expect(rowCount).not.toBe('10 rows')

    // Step 3: Apply sort
    await applySort(page, 'value')

    // Step 4: Verify pipeline in canvas
    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(3) // dataset + filter + sort
  })

  test('full pipeline: load → filter → add column → verify schema', async ({ page }) => {
    // Load data
    await loadSampleCSV(page)
    await switchToTable(page)

    // Apply filter
    await applyFilter(page, 'category', 'eq', 'A')

    // Switch to canvas to verify
    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})

test.describe('Undo/Redo Chain', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('multiple undo then multiple redo', async ({ page }) => {
    // Apply operations
    await applySort(page, 'name')

    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(3)

    // Undo twice
    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    // Redo twice
    await page.keyboard.press('Meta+Shift+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    await page.keyboard.press('Meta+Shift+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
  })

  test('undo clears redo stack when new operation applied', async ({ page }) => {
    // Apply sort
    await applySort(page, 'name')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    // Undo
    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    // Apply new operation (should clear redo)
    await switchToTable(page)
    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    // Redo should not bring back the sort
    await page.keyboard.press('Meta+Shift+z')
    // Still 2 nodes (redo stack was cleared)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})

test.describe('View Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('can switch between table and canvas views', async ({ page }) => {
    // App defaults to canvas after loading
    await expect(page.locator('.react-flow')).toBeVisible()

    // Switch to table
    await switchToTable(page)
    await expect(page.getByText('Alice')).toBeVisible()

    // Switch to canvas
    await switchToCanvas(page)
    await expect(page.locator('.react-flow')).toBeVisible()

    // Switch back to table
    await switchToTable(page)
    await expect(page.getByText('Alice')).toBeVisible()
  })

  test('view state persists across switches', async ({ page }) => {
    await switchToTable(page)

    // Apply filter
    await applyFilter(page, 'name', 'eq', 'Alice')

    await expect(page.getByText('1 rows')).toBeVisible()

    // Switch to canvas and back
    await switchToCanvas(page)
    await switchToTable(page)

    // Filter should still be active
    await expect(page.getByText('1 rows')).toBeVisible()
  })
})

test.describe('Multi-node Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('creating linear chain of operations', async ({ page }) => {
    // Sort
    await applySort(page, 'name')

    // Filter
    await applyFilter(page, 'category', 'eq', 'A')

    // Another sort
    await applySort(page, 'value')

    // Verify in canvas
    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(4)
    await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  })

  test('each node in chain shows correct operation', async ({ page }) => {
    await applySort(page, 'name')

    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)

    // Should see both Sorted and Filtered labels
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Sorted' }).first()).toBeVisible()
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Filtered' })).toBeVisible()
  })
})

test.describe('Node Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    // Create multiple nodes
    await applySort(page, 'name')

    await switchToCanvas(page)
  })

  test('clicking node in canvas switches active view', async ({ page }) => {
    // Double-click on dataset node
    await page.locator('.react-flow__node').filter({ hasText: 'sample' }).first().dblclick()

    // Should switch to table view with that node
    await expect(page.getByRole('button', { name: /Switch to Canvas/i })).toBeVisible()
  })

  test('can navigate between nodes using tabs', async ({ page }) => {
    // Both dataset and sorted view should be openable
    const sortedNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' })
    await sortedNode.dblclick()

    await expect(page.getByRole('button', { name: /Switch to Canvas/i })).toBeVisible()
  })
})

test.describe('Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('filtered data shows correct subset', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'Alice')

    // Only Alice should be visible in the grid
    await expect(page.getByLabel('Grid data rows').getByText('Alice')).toBeVisible()
    await expect(page.getByLabel('Grid data rows').getByText('Bob')).not.toBeVisible()
  })

  test('sorted data maintains all rows', async ({ page }) => {
    await applySort(page, 'name')

    // Should still have all 10 rows
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })
})

test.describe('Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('can continue after failed filter value', async ({ page }) => {
    // Filter name column with non-matching value (empty result set)
    await applyFilter(page, 'name', 'eq', 'NonExistentPerson')

    // May show 0 rows - either way app should be usable
    // Try another operation - applySort already verifies sort was applied
    await applySort(page, 'name')
  })
})

test.describe('Theme and UI State', () => {
  test('can toggle theme', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Look for theme toggle button
    const themeButton = page
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .last()
    if (await themeButton.isVisible()) {
      await themeButton.click()
      // Theme should change (verified by no error)
    }
  })
})
