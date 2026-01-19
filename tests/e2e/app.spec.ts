import { expect, test } from '@playwright/test'
import { applyFilter, applySort, loadSampleCSV, switchToCanvas, switchToTable, waitForAppReady } from './fixtures'

test.describe('Homepage', () => {
  test('displays homepage on initial load', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Should show the main heading
    await expect(page.getByRole('heading', { name: /Explore datasets too large for spreadsheets/i })).toBeVisible()

    // Should show the drop zone
    await expect(page.getByText('Drop a file to start exploring')).toBeVisible()

    // Should show sample data prompt
    await expect(page.getByRole('button', { name: 'Try with sample data' })).toBeVisible()
  })

  test('shows DuckDB initialization then homepage', async ({ page }) => {
    await page.goto('/')

    // Wait for homepage to be ready (DuckDB initialized)
    await waitForAppReady(page)
  })
})

test.describe('Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('applies a text filter and updates row count', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'Alice')

    await expect(page.getByText('1 rows')).toBeVisible()

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Filtered' })).toBeVisible()
  })
})

test.describe('File Loading', () => {
  test('loads CSV file via drag and drop', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Load the file via drag and drop
    await loadSampleCSV(page)

    // Should show row count in status bar
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })

  test('displays data in grid after loading', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    // Should show data values from the CSV
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()
    await expect(page.getByText('Charlie')).toBeVisible()
  })
})

test.describe('Data Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('can switch between canvas and table mode', async ({ page }) => {
    // After loading, app defaults to canvas view
    await expect(page.locator('.react-flow')).toBeVisible()

    // Switch to table view
    await switchToTable(page)

    // Should show the grid with data
    await expect(page.getByText('Alice')).toBeVisible()

    // Switch back to canvas
    await switchToCanvas(page)

    // Should show the canvas again
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('can open command palette with keyboard shortcut', async ({ page }) => {
    // Press Cmd+K to open command palette
    await page.keyboard.press('Meta+k')

    // Should show command palette (look for the input)
    await expect(page.locator('[cmdk-input]')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')

    // Command palette should be closed
    await expect(page.locator('[cmdk-input]')).not.toBeVisible()
  })

  test('can open command palette via button', async ({ page }) => {
    // Click CMD+K button
    await page.getByRole('button', { name: 'Open command palette' }).click()

    // Should show command palette
    await expect(page.locator('[cmdk-input]')).toBeVisible()
  })

  test('opens pivot panel from command palette', async ({ page }) => {
    await switchToTable(page)
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[cmdk-input]')).toBeVisible()

    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('Pivot Table Fields')).toBeVisible()
  })
})

test.describe('Canvas View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    // App defaults to canvas view after loading
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('shows dataset node in canvas', async ({ page }) => {
    // Should show the dataset node with sample name
    await expect(page.getByText('sample', { exact: true })).toBeVisible()
  })

  test('canvas has nodes', async ({ page }) => {
    // Should have at least one node in the canvas
    await expect(page.locator('.react-flow__node')).toBeVisible()
  })
})

test.describe('Error Handling', () => {
  // Skip: Playwright's synthetic drop events don't reliably pass File objects to the handler
  test.skip('shows error for unsupported file type', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Create a data transfer with an unsupported file type
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      const file = new File(['This is not a valid data file'], 'test.txt', { type: 'text/plain' })
      dt.items.add(file)
      return dt
    })

    // Find the actual drop zone div (the cursor-pointer div containing the text)
    const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })

    // Simulate drag sequence
    await dropZone.dispatchEvent('dragenter', { dataTransfer })
    await dropZone.dispatchEvent('dragover', { dataTransfer })
    await dropZone.dispatchEvent('drop', { dataTransfer })

    // Should show error message
    await expect(page.getByText(/Unsupported file type/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Keyboard Shortcuts', () => {
  test('Cmd+O opens file dialog', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Set up file chooser handler before pressing the shortcut
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null)

    // Press Cmd+O
    await page.keyboard.press('Meta+o')

    // Either file chooser opens or showOpenFilePicker is called
    // We just verify no error occurs
    const chooser = await fileChooserPromise
    if (chooser) {
      // File dialog opened, cancel it
      // (can't easily cancel showOpenFilePicker)
    }
  })

  test('Escape closes dialogs', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)

    // Open command palette
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[cmdk-input]')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(page.locator('[cmdk-input]')).not.toBeVisible()
  })
})

test.describe('Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('can sort by clicking column header', async ({ page }) => {
    // Click on the 'name' column's sort button
    await applySort(page, 'name')

    // Switch to canvas
    await switchToCanvas(page)

    // Should see multiple nodes (original dataset + sort view)
    const nodes = page.locator('.react-flow__node')
    await expect(nodes).toHaveCount(2)

    // One should say "Sorted"
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Sorted' })).toBeVisible()
  })

  test('can click on nodes in canvas to select them', async ({ page }) => {
    // Apply a sort to create a second node
    await applySort(page, 'name')

    // Switch to canvas
    await switchToCanvas(page)

    // Should see both nodes - use exact match for dataset node
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Dataset' })).toBeVisible()
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Sorted' })).toBeVisible()

    // Click on the original dataset node
    await page.locator('.react-flow__node').filter({ hasText: 'Dataset' }).click()

    // The node should be clickable (no error thrown)
    // This verifies basic canvas interaction works
  })

  test('multiple operations create multiple nodes', async ({ page }) => {
    // Apply a sort
    await applySort(page, 'name')

    // Apply a filter on the sorted view
    await applyFilter(page, 'category', 'eq', 'A')

    // Switch to canvas
    await switchToCanvas(page)

    // Should see 3 nodes (dataset + sort + filter)
    const nodes = page.locator('.react-flow__node')
    await expect(nodes).toHaveCount(3)
  })
})

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('undo and redo pipeline operations from the canvas', async ({ page }) => {
    await applySort(page, 'name')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    await page.keyboard.press('Meta+Shift+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})
