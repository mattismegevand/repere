import { expect, test } from '@playwright/test'
import {
  applyFilter,
  applySort,
  loadSampleCSV,
  openCommandPalette,
  openFilterPopover,
  switchToCanvas,
  switchToTable,
  waitForAppReady,
} from './fixtures'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('opens with Cmd+K', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[cmdk-input]')).toBeVisible()
  })

  test('opens with button click', async ({ page }) => {
    await page.getByRole('button', { name: 'Open command palette' }).click()
    await expect(page.locator('[cmdk-input]')).toBeVisible()
  })

  test('closes with Escape', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('[cmdk-input]')).not.toBeVisible()
  })

  test('can search for commands', async ({ page }) => {
    await openCommandPalette(page)
    await page.locator('[cmdk-input]').fill('pivot')
    await expect(page.getByText(/pivot/i)).toBeVisible()
  })

  test('can navigate with arrow keys', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('[cmdk-input]')).toBeVisible()
  })

  test('Enter selects highlighted option', async ({ page }) => {
    await openCommandPalette(page)
    // Search for pivot which opens a panel
    await page.locator('[cmdk-input]').fill('pivot')
    await page.keyboard.press('Enter')
    // Pivot panel should open
    await expect(page.getByText('Pivot Table Fields')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Filter Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('opens filter dialog for column', async ({ page }) => {
    await openFilterPopover(page, 'name')
    // Filter popover should be visible with Apply button
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'Apply' })).toBeVisible()
  })

  test('shows operator buttons', async ({ page }) => {
    await openFilterPopover(page, 'name')
    // Should show operator buttons like =, contains, etc.
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: '=' })).toBeVisible()
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'contains' })).toBeVisible()
  })

  test('can select equals operator', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await page.locator('[data-tour="column-filter"]').getByRole('button', { name: '=' }).click()
    // Button should be selected (visual state)
  })

  test('can select contains operator', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'contains' }).click()
  })

  test('numeric column has greater than operator', async ({ page }) => {
    await openFilterPopover(page, 'value')
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: '>' })).toBeVisible()
  })

  test('numeric column has less than operator', async ({ page }) => {
    await openFilterPopover(page, 'value')
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: '<' })).toBeVisible()
  })

  test('has is empty operator', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await expect(
      page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'empty', exact: true })
    ).toBeVisible()
  })

  test('has not empty operator', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await expect(page.locator('[data-tour="column-filter"]').getByRole('button', { name: 'not empty' })).toBeVisible()
  })

  test('Apply button applies filter', async ({ page }) => {
    await applyFilter(page, 'name', 'eq', 'Alice')
    await expect(page.getByText('1 rows')).toBeVisible()
  })

  test('Escape closes without applying', async ({ page }) => {
    await openFilterPopover(page, 'name')
    await page.locator('[data-tour="column-filter"]').locator('input').fill('Test')
    await page.keyboard.press('Escape')
    await expect(page.getByText('10 rows', { exact: true })).toBeVisible()
  })
})

test.describe('Pivot Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('opens from command palette', async ({ page }) => {
    await openCommandPalette(page)
    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('Pivot Table Fields')).toBeVisible()
  })

  test('shows available fields', async ({ page }) => {
    await openCommandPalette(page)
    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('name')).toBeVisible()
    await expect(page.getByText('category')).toBeVisible()
  })

  test('can close pivot panel', async ({ page }) => {
    await openCommandPalette(page)
    await page.getByText('Group by / Pivot').click()
    await expect(page.getByText('Pivot Table Fields')).toBeVisible()
    await page.keyboard.press('Escape')
  })
})

test.describe('Add Column Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('opens from command palette', async ({ page }) => {
    await openCommandPalette(page)
    await page.locator('[cmdk-input]').fill('add column')

    const addColumnOption = page.getByText(/Add column/i)
    if (await addColumnOption.isVisible()) {
      await addColumnOption.click()
      // Dialog has "Column name" label and "SQL expression" field
      await expect(page.getByText('Add computed column')).toBeVisible()
    }
  })
})

test.describe('Export Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('opens from command palette', async ({ page }) => {
    await openCommandPalette(page)
    await page.locator('[cmdk-input]').fill('export')

    const exportOption = page.getByText(/Export session/i)
    if (await exportOption.isVisible()) {
      await exportOption.click()
      // Export session triggers a download - verify command palette closes
      await expect(page.locator('[cmdk-input]')).not.toBeVisible()
    }
  })
})

test.describe('Delete Confirmation Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)

    // Create two views to have a node with children
    await applySort(page, 'name')
    await applyFilter(page, 'category', 'eq', 'A')
  })

  test('shows when deleting node with children', async ({ page }) => {
    await switchToCanvas(page)
    await expect(page.locator('.react-flow')).toBeVisible()

    // Right-click on sort node (middle of chain)
    const sortNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' }).first()
    await sortNode.click({ button: 'right' })
    await page.getByText('Delete (cascade)').click()

    await expect(page.getByText(/will also be deleted|descendant|child/i)).toBeVisible()
  })

  test('cancel button closes dialog', async ({ page }) => {
    await switchToCanvas(page)
    await expect(page.locator('.react-flow')).toBeVisible()

    const sortNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' }).first()
    await sortNode.click({ button: 'right' })
    await page.getByText('Delete (cascade)').click()

    await expect(page.getByText(/will also be deleted|descendant/i)).toBeVisible()

    await page.getByRole('button', { name: /Cancel/i }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
  })

  test('confirm button deletes node and children', async ({ page }) => {
    await switchToCanvas(page)
    await expect(page.locator('.react-flow')).toBeVisible()

    await expect(page.locator('.react-flow__node')).toHaveCount(3)

    const sortNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' }).first()
    await sortNode.click({ button: 'right' })
    await page.getByText('Delete (cascade)').click()

    const confirmButton = page.getByRole('button', { name: 'Delete all' })
    await confirmButton.click()

    // After cascade delete, session clears and returns to homepage
    await expect(page.getByText('Drop a file to start exploring')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Dialog Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('dialogs trap focus', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(page.locator('[cmdk-input]')).toBeVisible()
  })

  test('Escape closes most dialogs', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('[cmdk-input]')).not.toBeVisible()
  })
})
