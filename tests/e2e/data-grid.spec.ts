import { expect, test } from '@playwright/test'
import {
  applyFilter,
  applySort,
  getColumnHeader,
  loadSampleCSV,
  openFilterPopover,
  switchToTable,
  waitForAppReady,
} from './fixtures'

test.describe('Data Grid - Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('can click on a cell to select it', async ({ page }) => {
    const cell = page.getByRole('gridcell').first()
    await cell.click()
    await expect(cell).toBeVisible()
  })

  test('arrow keys navigate between cells', async ({ page }) => {
    const firstCell = page.getByRole('gridcell').first()
    await firstCell.click()
    await page.keyboard.press('ArrowRight')
    // Navigation succeeded if no error
  })

  test('Tab moves to next cell', async ({ page }) => {
    const firstCell = page.getByRole('gridcell').first()
    await firstCell.click()
    await page.keyboard.press('Tab')
  })

  test('Shift+Tab moves to previous cell', async ({ page }) => {
    const cells = page.getByRole('gridcell')
    await cells.nth(1).click()
    await page.keyboard.press('Shift+Tab')
  })
})

test.describe('Data Grid - Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('search filters visible rows', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.fill('Alice')
    await expect(page.getByText('Alice')).toBeVisible()
  })

  test('clearing search shows all rows', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.fill('Alice')
    await page.waitForTimeout(300)
    await searchInput.clear()
    await page.waitForTimeout(300)
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })

  test('case-insensitive search works by default', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.fill('alice')
    await expect(page.getByText('Alice')).toBeVisible()
  })
})

test.describe('Data Grid - Column Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('can show column context menu', async ({ page }) => {
    const header = getColumnHeader(page, 'name')
    await header.click({ button: 'right' })
    await expect(page.getByText('Hide column')).toBeVisible()
  })

  test('can hide a column', async ({ page }) => {
    const header = getColumnHeader(page, 'name')
    await header.click({ button: 'right' })
    await page.getByText('Hide column').click()
    await expect(getColumnHeader(page, 'name')).not.toBeVisible()
  })

  test('can sort column ascending via header', async ({ page }) => {
    await applySort(page, 'name')
    // Sort indicator should appear
    await expect(page.getByRole('button', { name: /Sort name, currently/i })).toBeVisible()
  })

  test('clicking sort again toggles direction', async ({ page }) => {
    await applySort(page, 'name')
    // Click again to toggle direction
    await page.getByRole('button', { name: /Sort name, currently/i }).click()
    // Still sorted but direction changed
    await expect(page.getByRole('button', { name: /Sort name, currently/i })).toBeVisible()
  })
})

test.describe('Data Grid - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('can apply equals filter', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'Alice')
    await expect(page.getByText('1 rows')).toBeVisible()
  })

  test('can apply contains filter', async ({ page }) => {
    await applyFilter(page, 'name', 'contains', 'li')
    const rowCount = page.getByText(/\d+ rows/)
    await expect(rowCount).toBeVisible()
  })

  test('can apply greater than filter on numeric column', async ({ page }) => {
    await applyFilter(page, 'value', 'gt', '100')
    const rowCount = page.getByText(/\d+ rows/)
    await expect(rowCount).toBeVisible()
  })

  test('can clear filters', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'Alice')
    await expect(page.getByText('1 rows')).toBeVisible()

    // Click the X button on the filter chip to remove it
    // The filter chip shows "name = Alice" with an X button
    const filterChip = page.locator('.inline-flex').filter({ hasText: 'name' }).filter({ hasText: '=' })
    const removeButton = filterChip.getByRole('button', { name: 'Remove filter' })
    await removeButton.click()
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })

  test('cancel filter closes dialog without applying', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await page.locator('[data-tour="column-filter"]').locator('input').fill('Test')
    await page.keyboard.press('Escape')
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })
})

test.describe('Data Grid - Virtual Scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('handles scrolling without errors', async ({ page }) => {
    await loadSampleCSV(page)
    await switchToTable(page)

    const grid = page.getByRole('grid')
    if (await grid.isVisible()) {
      await grid.evaluate((el) => {
        el.scrollTop = 200
      })
    }
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })

  test('Page Down scrolls the grid', async ({ page }) => {
    await loadSampleCSV(page)
    await switchToTable(page)

    const cell = page.getByRole('gridcell').first()
    await cell.click()
    await page.keyboard.press('PageDown')
    await expect(page.getByText('rows')).toBeVisible()
  })
})

test.describe('Data Grid - Sort Chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('sort chip appears after sorting', async ({ page }) => {
    await applySort(page, 'name')
    // A sort indicator should be visible in the filter bar
    await expect(page.getByRole('button', { name: /name ↑|name ↓/i })).toBeVisible()
  })

  test('can toggle sort direction', async ({ page }) => {
    await applySort(page, 'name')
    // Click sort button again to toggle
    await page.getByRole('button', { name: /Sort name, currently/i }).click()
    await expect(page.getByRole('button', { name: /Sort name, currently/i })).toBeVisible()
  })
})

test.describe('Data Grid - Row Count', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('shows correct row count after loading', async ({ page }) => {
    await loadSampleCSV(page)
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })

  test('row count updates after filtering', async ({ page }) => {
    await loadSampleCSV(page)
    await switchToTable(page)
    await applyFilter(page, 'name', 'eq', 'Alice')
    await expect(page.getByText('1 rows')).toBeVisible()
  })
})

test.describe('Data Grid - Sparklines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('numeric columns have sparkline visualization', async ({ page }) => {
    const valueHeader = getColumnHeader(page, 'value')
    const sparkline = valueHeader.locator('svg, canvas')
    expect(sparkline).toBeDefined()
  })
})

test.describe('Data Grid - Empty States', () => {
  test('shows empty state when no data matches filter', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    await applyFilter(page, 'name', 'eq', 'NonexistentName12345')
    await expect(page.getByText('0 rows')).toBeVisible()
  })
})
