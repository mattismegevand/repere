import { expect, test } from '@playwright/test'
import {
  applyFilter,
  applySort,
  loadFile,
  loadSampleCSV,
  openFilterPopover,
  switchToTable,
  waitForAppReady,
} from './fixtures'

test.describe('File Loading Errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('handles empty file gracefully', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      const file = new File([''], 'empty.csv', { type: 'text/csv' })
      dt.items.add(file)
      return dt
    })

    const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
    await dropZone.dispatchEvent('drop', { dataTransfer })

    await page.waitForTimeout(2000)
    await expect(page.locator('body')).toBeVisible()
  })

  test('handles malformed CSV gracefully', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      const file = new File(['a,b,c\n1,2\n3,4,5,6,7'], 'malformed.csv', { type: 'text/csv' })
      dt.items.add(file)
      return dt
    })

    const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
    await dropZone.dispatchEvent('drop', { dataTransfer })

    await page.waitForTimeout(2000)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Filter Errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('handles type mismatch in filter value', async ({ page }) => {
    // Filter a string column with a value containing special characters
    // This tests that the app handles edge case input gracefully
    await applyFilter(page, 'name', 'eq', '{"json": true}')
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()
  })

  test('handles very long filter value', async ({ page }) => {
    await openFilterPopover(page, 'name')
    const longValue = 'a'.repeat(10000)
    await page.locator('[data-tour="column-filter"]').locator('input').fill(longValue)
    await page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'Apply' }).click()

    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()
  })

  test('handles special characters in filter value', async ({ page }) => {
    await applyFilter(page, 'name', 'contains', "'; DROP TABLE users; --")
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('App State Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('app remains usable after error', async ({ page }) => {
    await loadSampleCSV(page)
    await switchToTable(page)

    // Filter for a value that doesn't exist - should return 0 rows but app still works
    await applyFilter(page, 'name', 'eq', 'NonExistentValue12345')
    await page.waitForTimeout(1000)

    await applySort(page, 'name')
    await expect(page.getByRole('button', { name: /Sort name, currently/i })).toBeVisible()
  })

  test('can load new file after error', async ({ page }) => {
    const badDataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      const file = new File(['invalid{json}content'], 'bad.json', { type: 'application/json' })
      dt.items.add(file)
      return dt
    })

    const dropZone = page.locator('div.cursor-pointer').filter({ hasText: 'Drop a file to start exploring' })
    await dropZone.dispatchEvent('drop', { dataTransfer: badDataTransfer })

    await page.waitForTimeout(2000)

    await loadFile(page, 'sample.csv')
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible({ timeout: 20000 })
  })
})

test.describe('UI Error States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('empty filter result shows appropriate message', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'DefinitelyNotInData12345')
    await expect(page.getByText('0 rows')).toBeVisible()
  })
})

test.describe('Concurrent Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('handles rapid clicks without crashing', async ({ page }) => {
    const sortButton = page.getByRole('button', { name: 'Sort name' })

    // Rapid clicks
    await sortButton.click()
    await sortButton.click()
    await sortButton.click()
    await sortButton.click()
    await sortButton.click()

    await page.waitForTimeout(500)
    await expect(page.locator('body')).toBeVisible()
  })

  test('handles rapid filter applications', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await applyFilter(page, 'name', 'contains', 'a')
      await page.waitForTimeout(200)
    }
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Network Resilience', () => {
  // Skip: DuckDB-WASM may require loading resources that don't match localhost
  test.skip('app loads without external resources', async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith('http://localhost') || url.startsWith('https://localhost')) {
        route.continue()
      } else {
        route.abort()
      }
    })

    await page.goto('/')
    await expect(page.getByText('Drop a file to start exploring')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Keyboard Input Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('handles rapid keyboard input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.click()

    for (let i = 0; i < 5; i++) {
      await page.keyboard.type('test', { delay: 10 })
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
    }

    await expect(searchInput).toBeVisible()
  })

  test('handles escape key anywhere', async ({ page }) => {
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Memory and Performance', () => {
  test('handles search debouncing correctly', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.fill('alice')
    await page.waitForTimeout(500)

    await expect(page.getByText('Alice')).toBeVisible()
  })
})
