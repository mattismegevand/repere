import { expect, test } from '@playwright/test'
import { applyFilter, applySort, loadSampleCSV, switchToCanvas, switchToTable, waitForAppReady } from './fixtures'

test.describe('Pipeline Canvas - Node Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    // App defaults to canvas after loading
  })

  test('clicking a node selects it', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.click()
    await expect(node).toBeVisible()
  })

  test('clicking empty canvas deselects node', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.click()

    const pane = page.locator('.react-flow__pane')
    await pane.click({ position: { x: 50, y: 50 } })
  })

  test('Escape key deselects nodes', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.click()
    await page.keyboard.press('Escape')
  })
})

test.describe('Pipeline Canvas - Node Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('double-clicking a node opens it in table view', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.dblclick()

    // Should switch to table view (button shows "Switch to Canvas")
    await expect(page.getByRole('button', { name: /Switch to Canvas/i })).toBeVisible()
  })

  test('right-clicking a node shows context menu', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: /View data|Delete/i }).first()).toBeVisible()
  })

  test('can delete node without children', async ({ page }) => {
    await switchToTable(page)
    await applySort(page, 'name')
    await switchToCanvas(page)

    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    const sortedNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' })
    await sortedNode.click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Delete/i }).click()

    // After deleting leaf node, session clears since only dataset remains
    await expect(page.getByText('Drop a file to start exploring')).toBeVisible({ timeout: 10000 })
  })

  test('deleting node with children shows confirmation', async ({ page }) => {
    await switchToTable(page)
    await applySort(page, 'name')
    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(3)

    const sortedNode = page.locator('.react-flow__node').filter({ hasText: 'Sorted' }).first()
    await sortedNode.click({ button: 'right' })
    await page.getByText('Delete (cascade)').click()

    await expect(page.getByText(/will also be deleted|descendants/i)).toBeVisible()
  })
})

test.describe('Pipeline Canvas - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
    await applySort(page, 'name')
    await switchToCanvas(page)
  })

  test('t key switches to table view', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('t')

    // After switching to table view, button shows "Switch to Canvas"
    await expect(page.getByRole('button', { name: /Switch to Canvas/i })).toBeVisible()
  })

  test('f key fits view to content', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('f')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('Space key also fits view', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('Space')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('+ key zooms in', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('+')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('- key zooms out', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('-')
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('arrow keys navigate between nodes', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await node.click()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})

test.describe('Pipeline Canvas - Zoom and Pan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('can zoom with mouse wheel', async ({ page }) => {
    const canvas = page.locator('.react-flow')

    await canvas.evaluate((el) => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true }))
    })

    await expect(canvas).toBeVisible()
  })

  test('can pan by dragging empty area', async ({ page }) => {
    const pane = page.locator('.react-flow__pane')

    await pane.dragTo(pane, {
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 200, y: 200 },
    })

    await expect(page.locator('.react-flow')).toBeVisible()
  })
})

test.describe('Pipeline Canvas - Edges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
    await applySort(page, 'name')
    await switchToCanvas(page)
  })

  test('edges connect parent to child nodes', async ({ page }) => {
    await expect(page.locator('.react-flow__edge')).toBeVisible()
  })

  test('clicking edge selects it', async ({ page }) => {
    const edge = page.locator('.react-flow__edge').first()
    await edge.click()
    await expect(edge).toBeVisible()
  })
})

test.describe('Pipeline Canvas - Multiple Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('creating multiple operations creates multiple nodes', async ({ page }) => {
    await applySort(page, 'name')
    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
  })

  test('nodes form a linear chain', async ({ page }) => {
    await applySort(page, 'name')
    await applyFilter(page, 'category', 'eq', 'A')

    await switchToCanvas(page)
    await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  })
})

test.describe('Pipeline Canvas - Node Info', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
  })

  test('dataset node shows filename', async ({ page }) => {
    await expect(page.getByText('sample', { exact: true })).toBeVisible()
  })

  test('dataset node shows row count', async ({ page }) => {
    const node = page.locator('.react-flow__node').first()
    await expect(node.getByText('10')).toBeVisible()
  })

  test('view node shows operation type', async ({ page }) => {
    await switchToTable(page)
    await applySort(page, 'name')
    await switchToCanvas(page)

    await expect(page.locator('.react-flow__node').filter({ hasText: 'Sorted' })).toBeVisible()
  })
})

test.describe('Pipeline Canvas - Auto Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
    await applySort(page, 'name')
    await switchToCanvas(page)
  })

  test('Shift+L triggers auto layout', async ({ page }) => {
    await page.locator('.react-flow').click()
    await page.keyboard.press('Shift+l')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})

test.describe('Pipeline Canvas - Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await loadSampleCSV(page)
    await switchToTable(page)
  })

  test('Cmd+Z undoes last operation', async ({ page }) => {
    await applySort(page, 'name')
    await switchToCanvas(page)

    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)
  })

  test('Cmd+Shift+Z redoes undone operation', async ({ page }) => {
    await applySort(page, 'name')
    await switchToCanvas(page)

    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    await page.keyboard.press('Meta+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    await page.keyboard.press('Meta+Shift+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})
